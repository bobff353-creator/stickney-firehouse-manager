import { scheduleWindow } from './schedule-safety.ts';
type Entry = { workDate: string; category: string; hours: number };
export type ReviewStaffing = { employeeId: string; logDate: string; shiftKey: string; timeIn: string; timeOut: string };
export function payrollReviewIssues(entries: Entry[], staffing: ReviewStaffing[], range?: { from: string; through: string }) {
  const issues: string[] = [];
  const dates = new Set([...entries.map(e => e.workDate), ...staffing.map(s => s.logDate)]);
  for (const date of dates) {
    if (range && (date < range.from || date > range.through)) continue;
    if (!scheduleWindow(date,'00:00','00:00')) { issues.push(`${date}: invalid saved work date; verify attendance and entries`); continue; }
    const day = entries.filter(e => e.workDate === date);
    if (day.some(entry => !Number.isFinite(entry.hours) || entry.hours < 0)) issues.push(`${date}: invalid recorded hours; verify the saved entries`);
    const hours = (categories: string[]) => day.filter(e => categories.includes(e.category)).reduce((sum,e) => sum + e.hours, 0);
    if (hours(["shift", "holiday", "dpw"]) > 24) issues.push(`${date}: duty hours exceed 24; verify staffing and DPW entries`);
    if (hours(["actingOfficer"]) > hours(["shift", "holiday", "dpw", "callback", "drill", "workDetail"])) issues.push(`${date}: acting-officer hours exceed worked hours`);
    const intervals: Array<[number, number, string]> = [];
    for (const row of staffing.filter(s => s.logDate === date)) {
      const minutes = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? Number(v.slice(0,2))*60+Number(v.slice(3)) : NaN;
      let start = minutes(row.timeIn), end = minutes(row.timeOut);
      if (!Number.isFinite(start) || !Number.isFinite(end)) { issues.push(`${date}: incomplete or invalid staffing time`); continue; }
      if (start === end) issues.push(`${date}: identical in/out times count as 24 hours; verify the tour`);
      if (end <= start) end += 1440;
      if (row.shiftKey === "overnight" && start < 360) { start += 1440; end += 1440; }
      intervals.push([start,end,row.employeeId]);
    }
    intervals.sort((a,b)=>a[0]-b[0]);
    if (intervals.some((item,i)=>intervals.slice(0,i).some(prev=>prev[2]===item[2] && item[0]<prev[1]))) issues.push(`${date}: overlapping staffing rows; verify duplicates`);
  }
  // Absolute local-clock windows catch overnight duplicates across log dates.
  // Preserve the department's clock-hour pay basis; this is not a DST pay change.
  const windows = staffing.flatMap(row => {
    const window = scheduleWindow(row.logDate, row.timeIn, row.timeOut);
    if (!window) return [];
    if (row.shiftKey === 'overnight' && Number(row.timeIn.slice(0, 2)) < 6) { window.start += 1440; window.end += 1440; }
    return [{ ...window, row }];
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
