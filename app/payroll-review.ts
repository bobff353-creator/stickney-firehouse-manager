import { calendarWorkedHours, staffingInterval } from './staffing-time.ts';
import { scheduleWindow } from './schedule-safety.ts';
type Entry = { workDate: string; category: string; hours: number };
export type ReviewStaffing = { employeeId: string; logDate: string; shiftKey: string; timeIn: string; timeOut: string; timeInInstant?: string; timeOutInstant?: string };
export function payrollReviewIssues(entries: Entry[], staffing: ReviewStaffing[], range?: { from: string; through: string }) {
  const issues: string[] = [];
  const dates = new Set([...entries.map(e => e.workDate), ...staffing.map(s => s.logDate)]);
  for (const date of dates) {
    if (range && (date < range.from || date > range.through)) continue;
    if (!scheduleWindow(date,'00:00','00:00')) { issues.push(`${date}: invalid saved work date; verify attendance and entries`); continue; }
    const day = entries.filter(e => e.workDate === date);
    if (day.some(entry => !Number.isFinite(entry.hours) || entry.hours < 0)) issues.push(`${date}: invalid recorded hours; verify the saved entries`);
    const hours = (categories: string[]) => day.filter(e => categories.includes(e.category)).reduce((sum,e) => sum + e.hours, 0);
    const maximumTour = Math.max(24, calendarWorkedHours(date,"06:00","06:00"));
    if (hours(["shift", "holiday", "dpw", "dailyLogDpw"]) > maximumTour) issues.push(`${date}: duty hours exceed ${maximumTour}; verify staffing and DPW entries`);
    if (hours(["actingOfficer"]) > hours(["shift", "holiday", "dpw", "callback", "drill", "workDetail"])) issues.push(`${date}: acting-officer hours exceed worked hours`);
    const intervals: Array<[number, number, string]> = [];
    for (const row of staffing.filter(s => s.logDate === date)) {
      if (!row.timeIn || !row.timeOut) { issues.push(`${date}: incomplete or invalid staffing time`); continue; }
      try {
        const interval = staffingInterval(date,row)!;
        if (row.timeIn === row.timeOut) issues.push(`${date}: identical in/out times count as ${(interval.end-interval.start)/3600000} hours; verify the tour`);
        intervals.push([interval.start,interval.end,row.employeeId]);
      } catch (error) { issues.push(`${date}: ${error instanceof Error ? error.message : 'incomplete or invalid staffing time'}`); }
    }
    intervals.sort((a,b)=>a[0]-b[0]);
    if (intervals.some((item,i)=>intervals.slice(0,i).some(prev=>prev[2]===item[2] && item[0]<prev[1]))) issues.push(`${date}: overlapping staffing rows; verify duplicates`);
  }
  // Resolved instants keep overlap review consistent with payroll and AO guards.
  const windows = staffing.flatMap(row => {
    try {
      const window = staffingInterval(row.logDate,row);
      return window ? [{ ...window, row }] : [];
    } catch { return []; }
  }).sort((a, b) => a.start - b.start || a.end - b.end);
  for (let index = 0; index < windows.length; index++) {
    const current = windows[index];
    for (let prior = index - 1; prior >= 0; prior--) {
      const previous = windows[prior];
      if (previous.row.employeeId !== current.row.employeeId || previous.row.logDate === current.row.logDate || current.start >= previous.end) continue;
      for (const date of [previous.row.logDate, current.row.logDate]) {
        if (!range || date >= range.from && date <= range.through) issues.push(`${date}: overlapping staffing rows across log dates; verify overnight attendance`);
      }
    }
  }
  return [...new Set(issues)];
}
