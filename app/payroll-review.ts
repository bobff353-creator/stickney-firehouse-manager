type Entry = { workDate: string; category: string; hours: number };
export type ReviewStaffing = { employeeId: string; logDate: string; shiftKey: string; timeIn: string; timeOut: string };
export function payrollReviewIssues(entries: Entry[], staffing: ReviewStaffing[]) {
  const issues: string[] = [];
  const dates = new Set([...entries.map(e => e.workDate), ...staffing.map(s => s.logDate)]);
  for (const date of dates) {
    const day = entries.filter(e => e.workDate === date);
    const hours = (categories: string[]) => day.filter(e => categories.includes(e.category)).reduce((sum,e) => sum + e.hours, 0);
    if (hours(["shift", "holiday", "dpw"]) > 24) issues.push(`${date}: duty hours exceed 24; verify staffing and DPW entries`);
    if (hours(["actingOfficer"]) > hours(["shift", "holiday", "dpw", "callback", "drill", "workDetail"])) issues.push(`${date}: acting-officer hours exceed worked hours`);
    const intervals: Array<[number, number]> = [];
    for (const row of staffing.filter(s => s.logDate === date)) {
      const minutes = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? Number(v.slice(0,2))*60+Number(v.slice(3)) : NaN;
      let start = minutes(row.timeIn), end = minutes(row.timeOut);
      if (!Number.isFinite(start) || !Number.isFinite(end)) { issues.push(`${date}: incomplete or invalid staffing time`); continue; }
      if (start === end) issues.push(`${date}: identical in/out times count as 24 hours; verify the tour`);
      if (row.shiftKey === "overnight" && start < 360) start += 1440;
      if (end <= start) end += 1440;
      intervals.push([start,end]);
    }
    intervals.sort((a,b)=>a[0]-b[0]);
    if (intervals.some((item,i)=>intervals.slice(0,i).some(prev=>item[0]<prev[1]))) issues.push(`${date}: overlapping staffing rows; verify duplicates`);
  }
  return [...new Set(issues)];
}
