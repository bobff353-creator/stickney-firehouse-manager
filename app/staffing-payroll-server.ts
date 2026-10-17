import {dailyLogPayrollEntries,dailyLogPayrollTotals} from './payroll-hours';
import type { ensureDatabase } from '../db/bootstrap';
import { addCalendarDays } from './operational-day';
import { assertActingOfficerCoverage, type ActingCoverage } from './staffing-time';

type Db = Awaited<ReturnType<typeof ensureDatabase>>;
export async function actingOfficerSaveGuards(db: Db, date: string, rows: ActingCoverage[]) {
  assertActingOfficerCoverage(date, rows);
  if (!rows.some(row => row.actingOfficer)) return [];
  const dates = [addCalendarDays(date, -1), addCalendarDays(date, 1)];
  // Coverage and versions come from ONE snapshot. Reading them separately could
  // bless an intervening assignment that was never checked for overlap.
  const { results } = await db.prepare('SELECT l.log_date AS logDate,l.save_version AS saveVersion,s.employee_id AS employeeId,s.time_in AS timeIn,s.time_out AS timeOut,s.time_in_instant AS timeInInstant,s.time_out_instant AS timeOutInstant,s.acting_officer AS actingOfficer FROM daily_logs l LEFT JOIN daily_log_staffing s ON s.log_date=l.log_date AND s.acting_officer=1 WHERE l.log_date IN (?,?)').bind(...dates).all<ActingCoverage & { logDate: string; saveVersion: number }>();
  assertActingOfficerCoverage(date, rows, results);
  const version = (day: string) => results.find(row => row.logDate === day)?.saveVersion ?? -1;
  // Existing batch RPCs serialize department writes. Recheck the neighboring
  // versions INSIDE that transaction, including absence of a previously missing
  // log. Concurrent staffing or approvals invalidate this snapshot and roll back.
  return [db.prepare('UPDATE daily_logs SET log_date=log_date WHERE log_date=? AND (SELECT COALESCE(MAX(save_version),-1) FROM daily_logs WHERE log_date=?)=? AND (SELECT COALESCE(MAX(save_version),-1) FROM daily_logs WHERE log_date=?)=?').bind(date, dates[0], version(dates[0]), dates[1], version(dates[1])).expectChanges(1)];
}

// A deployment or unrelated historical edit must not silently convert already
// posted clock-hour payroll. Paid/open legacy periods need independent review.
export async function historicalStaffingPayGuard(db: Db, date: string, today: string, dpw: Set<string>, holiday: {overnightOnly?: boolean;windowStart?: string;windowEnd?: string}|null, proposed: (ActingCoverage & {id?:unknown})[] = []) {
  if (date >= today) return;
  const {results:posted} = await db.prepare("SELECT employee_id AS employeeId,category,hours FROM time_entries WHERE work_date=? AND category IN ('shift','holiday','actingOfficer','dailyLogDpw')").bind(date).all<{employeeId:string;category:string;hours:number}>();
  if (!posted.length) return;
  const {results:rows} = await db.prepare('SELECT id,employee_id AS employeeId,time_in AS timeIn,time_out AS timeOut,time_in_instant AS timeInInstant,time_out_instant AS timeOutInstant,shift_key AS shiftKey,acting_officer AS actingOfficer FROM daily_log_staffing WHERE log_date=?').bind(date).all();
  const clock = dailyLogPayrollEntries(dailyLogPayrollTotals(rows,holiday),dpw);
  const resolvedRows=rows.map(row=>{
    const choice=proposed.find(candidate=>candidate.id===row.id&&candidate.timeIn===row.timeIn&&candidate.timeOut===row.timeOut);
    return {...row,timeInInstant:row.timeInInstant||choice?.timeInInstant,timeOutInstant:row.timeOutInstant||choice?.timeOutInstant};
  });
  let elapsed;
  try { elapsed = dailyLogPayrollEntries(dailyLogPayrollTotals(resolvedRows,holiday,date),dpw); }
  catch {const error=new Error('Historical posted attendance needs explicit occurrence and payroll reconciliation before correction. No staffing or payroll was changed.');error.name='HistoricalStaffingPayError';throw error;}
  for (const entry of clock) {
    const expected = elapsed.find(row => row.employeeId===entry.employeeId && row.category===entry.category)?.hours ?? 0;
    if (Math.abs(entry.hours-expected)<0.001) continue;
    const saved = posted.filter(row=>row.employeeId===entry.employeeId&&row.category===entry.category);
    if (saved.length && Math.abs(saved.reduce((sum,row)=>sum+Number(row.hours),0)-expected)>0.001) {
      const error = new Error('This historical log has posted payroll that differs under the clarified elapsed-time rule. No staffing or payroll was changed. Reconcile the original attendance and approved payroll export through an explicit correction review before editing this log.');
      error.name='HistoricalStaffingPayError'; throw error;
    }
  }
}
