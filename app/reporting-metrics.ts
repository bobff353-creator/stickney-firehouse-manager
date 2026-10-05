/** Shared definitions for the chief report and the existing trend charts. */
export type SourceState = 'ready' | 'restricted' | 'unavailable';
export type AnalyticsSources = { calls: SourceState; staffing: SourceState; equipment: SourceState; payroll: SourceState };
export type ReportDay = { date: string; calls: number; staffingGaps: number; equipmentIssues: number; overtimeHours: number; aoHours: number; payrollCost: number };
export const metricSources = { calls: 'calls', staffingGaps: 'staffing', equipmentIssues: 'equipment', overtimeHours: 'payroll', aoHours: 'payroll', payrollCost: 'payroll' } as const;
export const reportDefinitions = [
  { key: 'calls', label: 'Saved Daily Log calls', definition: 'Saved call rows, including manual entries. CAD arrivals are a different source.', href: '/?display=portal&page=daily-log' },
  { key: 'staffingGaps', label: 'Unfilled staffing positions', definition: 'Four required positions minus filled positions, for each of the three legacy shifts on saved log dates. Not a configurable staffing compliance finding.', href: '/?display=portal&page=daily-log' },
  { key: 'equipmentIssues', label: 'Equipment issue observations', definition: 'Sign-in and sign-out statuses other than Present. The same issue can be observed twice; these are not unique repair tickets.', href: '/?display=portal&page=daily-log' },
  { key: 'overtimeHours', label: 'Calculated overtime hours', definition: 'Saved payroll entries and effective rates, using configured period thresholds. Not proof of payment.', href: '/?display=portal&page=payroll' },
  { key: 'aoHours', label: 'Acting Officer hours', definition: 'Saved Acting Officer payroll entries.', href: '/?display=portal&page=payroll' },
  { key: 'payrollCost', label: 'Calculated gross payroll', definition: 'Calculated gross pay before deductions. Not a paid or reconciled payroll total.', href: '/?display=portal&page=payroll' },
] as const;
export function callHour(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{1,2}):([0-5]\d)$|^(\d{3,4})$/);
  if (!match) return null;
  const digits = match[3]?.padStart(4, '0');
  const hour = Number(digits ? digits.slice(0, 2) : match[1]);
  const minute = Number(digits ? digits.slice(2) : match[2]);
  return hour < 24 && minute < 60 ? hour : null;
}
export function validReportDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function trendPeriodKeys(latest: string, mode: 'weekly' | 'monthly') {
  const date = new Date(`${latest}T12:00:00Z`);
  if (mode === 'weekly') date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() || 7) - 1));
  else date.setUTCDate(1);
  return Array.from({ length: 12 }, (_, index) => { const cursor = new Date(date); if (mode === 'weekly') cursor.setUTCDate(cursor.getUTCDate() - (11 - index) * 7); else cursor.setUTCMonth(cursor.getUTCMonth() - (11 - index)); return cursor.toISOString().slice(0, mode === 'weekly' ? 10 : 7); });
}
export function reportRange(start: string, end: string, earliest: string, latest: string) {
  if (![start, end].every(validReportDate) || start > end || start < earliest || end > latest) throw Error(`Choose dates from ${earliest} through ${latest}, with the start before the end.`);
  return { start, end };
}
export function restoredReportRange(search: string, earliest: string, latest: string) {
  const params = new URLSearchParams(search);
  try { return reportRange(params.get('reportStart') || '', params.get('reportEnd') || '', earliest, latest); }
  catch {
    const from = new Date(`${latest}T12:00:00Z`); from.setUTCDate(from.getUTCDate() - 29);
    return { start: [earliest, from.toISOString().slice(0, 10)].sort().at(-1)!, end: latest };
  }
}
export function chiefSummary(days: ReportDay[], sources: AnalyticsSources, start: string, end: string) {
  const selected = days.filter(day => day.date >= start && day.date <= end);
  return reportDefinitions.map(metric => {
    const state = sources[metricSources[metric.key]];
    return { ...metric, state, value: state === 'ready' ? selected.reduce((sum, day) => sum + day[metric.key], 0) : null };
  });
}
// Quote every cell and neutralize formula prefixes, including prefixes after whitespace.
export function csvCell(value: unknown) {
  const text = String(value ?? '');
  return `"${(/^[\s\uFEFF]*[=+@-]/.test(text) ? "'" : '') + text.replaceAll('"', '""')}"`;
}
export function chiefCsv(days: ReportDay[], sources: AnalyticsSources, start: string, end: string, generatedAt: string, origin: string) {
  const rows: unknown[][] = [['Chief report', start, end], ['Generated at', generatedAt], ['Metric', 'Value', 'Source status', 'Definition', 'Source link']];
  for (const metric of chiefSummary(days, sources, start, end)) rows.push([metric.label, metric.value ?? metric.state, metric.state, metric.definition, new URL(metric.href, origin).href]);
  rows.push([], ['Date', ...reportDefinitions.map(metric => metric.label)]);
  for (const day of days.filter(day => day.date >= start && day.date <= end)) rows.push([day.date, ...reportDefinitions.map(metric => sources[metricSources[metric.key]] === 'ready' ? day[metric.key] : sources[metricSources[metric.key]])]);
  rows.push([], ['Coverage', 'Only saved source rows. Missing days are not proof of no activity. Response and turnout intervals, training compliance, inspection completion, fleet downtime and spending are not measured by this report.']);
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}
