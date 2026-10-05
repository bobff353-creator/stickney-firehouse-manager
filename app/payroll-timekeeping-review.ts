import { workedHours } from './payroll-hours.ts';
import { payrollReviewIssues, type ReviewStaffing } from './payroll-review.ts';
import type { PayrollReference } from './payroll-reference-export.ts';
import type { PayrollRules } from './payroll-calculation.ts';
export type TimekeepingEntry = { employeeId: string; workDate: string; category: string; hours: number };
export type TimekeepingMember = { id: string; name: string };
export type TimekeepingFlag = { employeeId: string; employeeName: string; date: string; message: string };
/** Reconciliation suggestions only. Manual duty pay can legitimately differ. */
export function timekeepingReview(members: TimekeepingMember[], entries: TimekeepingEntry[], staffing: ReviewStaffing[], from: string, through: string): TimekeepingFlag[] {
  const flags: TimekeepingFlag[] = [];
  for (const member of members) {
    const ownEntries = entries.filter(entry => entry.employeeId === member.id);
    const ownStaffing = staffing.filter(row => row.employeeId === member.id);
    for (const message of payrollReviewIssues(ownEntries, ownStaffing, { from, through })) flags.push({ employeeId: member.id, employeeName: member.name, date: message.slice(0, 10), message });
    for (const date of [...new Set(ownStaffing.map(row => row.logDate))].sort()) {
      if (date < from || date > through) continue;
      const tours = ownStaffing.filter(row => row.logDate === date);
      if (tours.some(row => !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.timeIn) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.timeOut))) continue;
      const attendance = tours.reduce((sum, row) => sum + workedHours(row.timeIn, row.timeOut), 0);
      const recorded = ownEntries.filter(entry => entry.workDate === date && ['shift', 'holiday', 'dpw', 'dailyLogDpw'].includes(entry.category)).reduce((sum, entry) => sum + entry.hours, 0);
      if (Number.isFinite(recorded) && Math.abs(attendance - recorded) > 0.011) flags.push({ employeeId: member.id, employeeName: member.name, date, message: `${date}: ${attendance.toFixed(2)} Daily Log duty hours versus ${recorded.toFixed(2)} recorded duty-pay hours. Verify the source or documented adjustment; callbacks, drills and stipends are excluded.` });
    }
  }
  return flags.sort((a, b) => a.date.localeCompare(b.date) || a.employeeName.localeCompare(b.employeeName) || a.message.localeCompare(b.message));
}
export function timekeepingReviewCsv(flags: TimekeepingFlag[], from: string, through: string) {
  const rows = [[`TIMEKEEPING REVIEW ${from} through ${through}`], ['Review flags only; no hours or approvals are changed'], ['Employee', 'Work date', 'Review flag'], ...flags.map(flag => [flag.employeeName, flag.date, flag.message])];
  return '\uFEFF' + rows.map(row => row.map(cell => {
    const safe = /^[\s]*[=+@-]/.test(cell) ? `'${cell}` : cell;
    return `"${safe.replaceAll('"', '""')}"`;
  }).join(',')).join('\r\n');
}
export function validatePayrollReference(report: PayrollReference) {
  const pay = report.headers.length - 1;
  const rate = pay - 1;
  const hours = pay - 2;
  if (!Number.isFinite(report.gross) || !Number.isFinite(report.workedHours) || report.workedHours < 0 || report.rows.some(row => row.cells.length !== report.headers.length || row.cells.slice(2).some(cell => typeof cell === 'number' && !Number.isFinite(cell)) || typeof row.cells[pay] !== 'number' || row.kind !== 'adjustment' && (typeof row.cells[rate] !== 'number' || Number(row.cells[hours]) < 0 || Number(row.cells[rate]) < 0))) throw Error('Payroll contains invalid hours, rates or totals. Review the saved records before exporting.');
  const grossCents = report.rows.reduce((sum, row) => sum + Math.round(Number(row.cells[pay]) * 100), 0);
  if (grossCents !== Math.round(report.gross * 100) || Number(report.totals[pay]) !== report.gross) throw Error('Payroll export totals do not match the pay rows. No file was created.');
  return report;
}
export function validatePayrollExportInputs(members: Array<TimekeepingMember & { regularRate: number }>, entries: TimekeepingEntry[], rules: PayrollRules & { configured?: boolean }, from: string, through: string) {
  const categories = new Set(['shift','drill','workDetail','callback','actingOfficer','holiday','dpw','dailyLogDpw']);
  const ids = new Set(members.map(member => member.id));
  if (ids.size !== members.length || members.some(member => !member.id || !Number.isFinite(member.regularRate) || member.regularRate < 0)) throw Error('Payroll employee mappings or rates need review. No file was created.');
  if (rules.configured === false || ![rules.overtimeThreshold,rules.actingOfficerPremium,rules.dpwMultiplier].every(value => Number.isFinite(value) && value >= 0)) throw Error('Payroll rules could not be confirmed. Review Rates & Rules before exporting.');
  if (entries.some(entry => !ids.has(entry.employeeId) || !categories.has(entry.category) || !Number.isFinite(entry.hours) || entry.hours < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(entry.workDate) || entry.workDate < from || entry.workDate > through || new Date(`${entry.workDate}T12:00:00Z`).toISOString().slice(0,10) !== entry.workDate)) throw Error('Recorded payroll entries have an invalid date, hours, category or employee mapping. Review the source before exporting.');
}
