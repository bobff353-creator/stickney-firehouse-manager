import { chicagoLocalInstant, staffingInterval } from './staffing-time.ts';
import { addCalendarDays } from './operational-day.ts';
export type PayrollStaffingRow = {
  timeInInstant?: unknown;
  timeOutInstant?: unknown;
  employeeId?: unknown;
  timeIn?: unknown;
  timeOut?: unknown;
  shiftKey?: unknown;
  actingOfficer?: unknown;
};

export type DailyLogPayrollTotal = {
  shift: number;
  holiday: number;
  actingOfficer: number;
};

export function workedHours(timeIn: string, timeOut: string, logDate?: string, timeInInstant?: unknown,timeOutInstant?:unknown) {
  if (logDate) { const interval = staffingInterval(logDate, { timeIn, timeOut,timeInInstant,timeOutInstant }); return interval ? (interval.end - interval.start) / 3600000 : 0; }
  const minutes = (value: string) => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return Number.NaN;
    const [hours, mins] = value.split(":").map(Number);
    if (!Number.isInteger(hours) || !Number.isInteger(mins) || hours < 0 || hours > 23 || mins < 0 || mins > 59) return Number.NaN;
    return hours * 60 + mins;
  };
  const start = minutes(timeIn);
  const rawEnd = minutes(timeOut);
  if (!Number.isFinite(start) || !Number.isFinite(rawEnd)) return 0;
  if (start === rawEnd) return 24;
  const end = rawEnd < start ? rawEnd + 1440 : rawEnd;
  return Math.max(0, Math.round(((end - start) / 60) * 100) / 100);
}

export function dailyLogPayrollTotals(
  rows: PayrollStaffingRow[],
  holiday: { overnightOnly?: boolean; windowStart?: string; windowEnd?: string } | null,
  logDate?: string,
) {
  const totals = new Map<string, DailyLogPayrollTotal>();
  for (const row of rows) {
    const employeeId = String(row.employeeId ?? "");
    const hours = workedHours(String(row.timeIn ?? ""), String(row.timeOut ?? ""), logDate,row.timeInInstant,row.timeOutInstant);
    if (!employeeId || hours <= 0) continue;
    const current = totals.get(employeeId) ?? { shift: 0, holiday: 0, actingOfficer: 0 };
    const holidayApplies = Boolean(holiday && (!holiday.overnightOnly || String(row.shiftKey ?? "") === "overnight"));
    let holidayHours=holidayApplies?hours:0;
    if(holidayApplies&&holiday?.overnightOnly&&holiday.windowStart&&holiday.windowEnd){
      if (logDate) {
        const interval = staffingInterval(logDate, row)!;
        const start = chicagoLocalInstant(logDate, holiday.windowStart);
        const end = chicagoLocalInstant(addCalendarDays(logDate,1), holiday.windowEnd);
        holidayHours = Math.max(0, Math.min(interval.end,end)-Math.max(interval.start,start))/3600000;
      } else {
        const minute=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(3));
        let start=minute(String(row.timeIn));
        if(start<360)start+=1440;const end=start+hours*60;
        const windowStart=minute(holiday.windowStart),windowEnd=minute(holiday.windowEnd)+1440;
        holidayHours=Math.min(hours,Math.round(Math.max(0,Math.min(end,windowEnd)-Math.max(start,windowStart))/60*100)/100);
      }
    }
    current.holiday+=holidayHours;
    current.shift+=Math.round((hours-holidayHours)*100)/100;
    if (row.actingOfficer) current.actingOfficer += hours;
    totals.set(employeeId, current);
  }
  return totals;
}

export function dailyLogPayrollEntries(
  totals: Map<string, DailyLogPayrollTotal>,
  dpwEmployees: Set<string>,
) {
  const entries: Array<{ employeeId: string; category: "shift" | "holiday" | "actingOfficer" | "dailyLogDpw"; hours: number }> = [];
  const rounded = (hours: number) => Math.round(hours * 100) / 100;
  for (const [employeeId, hours] of totals) {
    if (dpwEmployees.has(employeeId)) {
      const dpwHours = rounded(hours.shift + hours.holiday);
      if (dpwHours > 0) entries.push({ employeeId, category: "dailyLogDpw", hours: dpwHours });
    } else {
      if (hours.shift > 0) entries.push({ employeeId, category: "shift", hours: rounded(hours.shift) });
      if (hours.holiday > 0) entries.push({ employeeId, category: "holiday", hours: rounded(hours.holiday) });
    }
    if (hours.actingOfficer > 0) entries.push({ employeeId, category: "actingOfficer", hours: rounded(hours.actingOfficer) });
  }
  return entries;
}
