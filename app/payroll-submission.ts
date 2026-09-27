import { calculateGrossPay, workDetailRateForRank } from "./payroll-calculation.ts";
import { dailyLogPayrollEntries, dailyLogPayrollTotals } from "./payroll-hours.ts";
import { scheduledStaffingForLog, type DepartmentScheduleAssignment } from "./department-schedule.ts";
import { holidayForDate } from "./holidays.ts";
import { payrollReviewIssues } from "./payroll-review.ts";

export const payrollCategories = ["shift", "drill", "workDetail", "callback", "actingOfficer", "holiday", "dpw"] as const;
export type PayCategory = typeof payrollCategories[number];
export type PayEntry = { id?: string; employeeId: string; workDate: string; category: PayCategory | "dailyLogDpw"; hours: number };
export type SubmissionEntry = Omit<PayEntry, "category"> & { category: PayCategory; basis: "recorded" | "schedule-estimate"; sourceIds: string[] };
export type PayEmployee = { id: string; name: string; rank: string; regularRate: number; overtimeRate: number; holidayRate: number; isDpw: number; payScaleId: string };
export type PaySettings = { overtimeThreshold: number; dpwMultiplier: number };
export type PayrollSources = {
  version: number; period: string; status: string;
  employees: PayEmployee[]; settings: PaySettings; entries: PayEntry[];
  schedule: DepartmentScheduleAssignment[];
  logs: { logDate: string; updatedBy: string }[];
  staffing: { employeeId: string; logDate: string; shiftKey: string; timeIn: string; timeOut: string }[];
  approvals: { logDate: string; shiftKey: string; signOutAt: string | null }[];
};
export type PayAdjustment = {
  id: string; sourcePeriod: string; targetPeriod: string; employeeId: string; employeeName: string;
  sequence: number; deltaCents: number; beforeCents: number; actualCents: number;
  changes: { workDate: string; category: PayCategory; submittedHours: number; actualHours: number }[];
  actualEntries: SubmissionEntry[]; note?: string; approvedBy?: string; approvedAt?: string;
};
export type SubmissionDocument = {
  schemaVersion: 1; period: string; end: string; staffingThrough: string; extrasThrough: string;
  employees: PayEmployee[]; settings: PaySettings; entries: SubmissionEntry[];
  incoming: PayAdjustment[]; grossCents: number; warnings: string[];
};
export type SavedSubmission = { id: string; period: string; document: SubmissionDocument; createdBy: string; createdAt: string };

export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + "T12:00:00Z")) && new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value;
}
export function addPayDays(value: string, count: number) {
  const date = new Date(value + "T12:00:00Z"); date.setUTCDate(date.getUTCDate() + count); return date.toISOString().slice(0, 10);
}
export function payPeriodEnd(period: string) {
  if (!validDate(period) || !["11", "26"].includes(period.slice(8))) throw new Error("Choose a pay period starting on the 11th or 26th.");
  if (period.endsWith("11")) return addPayDays(period, 14);
  const date = new Date(period + "T12:00:00Z"); date.setUTCMonth(date.getUTCMonth() + 1, 10); return date.toISOString().slice(0, 10);
}
export function payDates(period: string) {
  const end = payPeriodEnd(period), dates: string[] = [];
  for (let d = period; d <= end; d = addPayDays(d, 1)) dates.push(d);
  return dates;
}
const hundredths = (value: number) => Math.round(value * 100) / 100;
const key = (entry: Pick<PayEntry, "employeeId" | "workDate" | "category">) => `${entry.employeeId}|${entry.workDate}|${entry.category}`;
export function recordedEntries(entries: PayEntry[]): SubmissionEntry[] {
  const merged = new Map<string, SubmissionEntry>();
  const seen = new Set<string>();
  const cells = new Set<string>();
  for (const entry of entries) {
    if (!entry.id || seen.has(entry.id) || cells.has(key(entry)) || !validDate(entry.workDate) || !Number.isFinite(Number(entry.hours)) || Number(entry.hours) < 0 || ![...payrollCategories, "dailyLogDpw"].includes(entry.category)) throw new Error("Invalid or duplicate saved payroll entry. Review the source; no hours were guessed.");
    seen.add(entry.id);
    cells.add(key(entry));
    const row: SubmissionEntry = { ...entry, hours: Number(entry.hours), category: entry.category === "dailyLogDpw" ? "dpw" : entry.category, basis: "recorded", sourceIds: [entry.id] };
    const prior = merged.get(key(row));
    if (prior) { prior.hours = hundredths(prior.hours + row.hours); prior.sourceIds.push(entry.id); }
    else merged.set(key(row), row);
  }
  return [...merged.values()].sort((a, b) => key(a).localeCompare(key(b)));
}
export function employeeGrossCents(employee: PayEmployee, entries: PayEntry[], settings: PaySettings) {
  const total = (category: string) => entries.filter(e => e.employeeId === employee.id && e.category === category).reduce((sum, e) => sum + Number(e.hours), 0);
  const base = total("shift") + total("drill") + total("callback"), overtime = Math.max(base - settings.overtimeThreshold, 0);
  return Math.round(calculateGrossPay({ regularHours: base - overtime, overtimeHours: overtime, workDetailHours: total("workDetail"), holidayHours: total("holiday"), actingOfficerHours: total("actingOfficer"), dpwHours: total("dpw"), regularRate: employee.regularRate, overtimeRate: employee.overtimeRate, holidayRate: employee.holidayRate, workDetailRate: workDetailRateForRank(employee.rank, employee.regularRate, employee.overtimeRate), dpwMultiplier: settings.dpwMultiplier }) * 100);
}
function validateSources(source: PayrollSources) {
  const blockers: string[] = [];
  const ids = new Set(source.employees.map(e => e.id));
  if (ids.size !== source.employees.length) blockers.push("Duplicate employee identities must be resolved.");
  for (const e of source.employees) if (![e.regularRate, e.overtimeRate, e.holidayRate].every(v => Number.isFinite(v) && v >= 0)) blockers.push(`Missing or invalid configured pay rates for ${e.name}.`);
  if (![source.settings.overtimeThreshold, source.settings.dpwMultiplier].every(v => Number.isFinite(v) && v >= 0)) blockers.push("Missing or invalid payroll rules.");
  for (const e of source.entries) if (!ids.has(e.employeeId) || e.workDate < source.period || e.workDate > payPeriodEnd(source.period)) blockers.push("A payroll entry has an unmatched employee or an out-of-period work date.");
  return blockers;
}

export function buildSubmission(source: PayrollSources, staffingThrough: string, extrasThrough: string, incoming: PayAdjustment[] = []) {
  const end = payPeriodEnd(source.period), firstAllowed = addPayDays(source.period, -1);
  for (const cutoff of [staffingThrough, extrasThrough]) if (!validDate(cutoff) || cutoff < firstAllowed || cutoff > end) throw new Error("Each cutoff must be inside this period or the day immediately before it.");
  const blockers = validateSources(source), warnings: string[] = [];
  if (source.status === "finalized") blockers.push("This period was finalized. Existing submitted history cannot be reconstructed or replaced by this workflow.");
  const staffCategories = new Set(["shift", "holiday", "actingOfficer", "dailyLogDpw", "dpw"]);
  const included = source.entries.filter(e => staffCategories.has(e.category) ? e.workDate <= staffingThrough : ["callback", "workDetail"].includes(e.category) ? e.workDate <= extrasThrough : true);
  const entries = recordedEntries(included);
  const projectedDates = payDates(source.period).filter(d => d > staffingThrough);
  for (const date of payDates(source.period).filter(d => d <= staffingThrough)) {
    if (!source.logs.some(l => l.logDate === date && l.updatedBy !== "System")) blockers.push(`${date}: no saved Daily Log to support completed staffing. Review it before submission.`);
  }
  const byEmployee = new Map(source.employees.map(e => [e.id, e]));
  // Do not silently union overlapping assignments: two roles at the same time
  // are ambiguous payroll evidence, even when the names happen to match.
  const intervals = new Map<string, { start: number; end: number }[]>();
  for (const row of source.schedule.filter(s => s.status === "assigned")) {
    if (!row.employeeId || !byEmployee.has(row.employeeId) || !validDate(row.workDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.endTime)) { blockers.push("An assigned schedule position has an invalid employee, date, or time."); continue; }
    const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
    const start = Date.parse(row.workDate + "T00:00:00Z") / 60000 + minutes(row.startTime);
    let finish = Date.parse(row.workDate + "T00:00:00Z") / 60000 + minutes(row.endTime); if (finish <= start) finish += 1440;
    const projectionStart = Date.parse(addPayDays(staffingThrough, 1) + "T06:00:00Z") / 60000;
    const projectionEnd = Date.parse(addPayDays(end, 1) + "T06:00:00Z") / 60000;
    if (finish <= projectionStart || start >= projectionEnd) continue;
    const previous = intervals.get(row.employeeId) ?? [];
    if (previous.some(p => p.start < finish && p.end > start)) blockers.push(`Overlapping scheduled assignments for ${byEmployee.get(row.employeeId)!.name}; correct the schedule first.`);
    previous.push({ start, end: finish }); intervals.set(row.employeeId, previous);
  }
  for (const date of projectedDates) {
    const rows = scheduledStaffingForLog(source.schedule, date);
    if (!rows.length) blockers.push(`${date}: no assigned schedule positions. An empty schedule is not assumed to mean zero staffing.`);
    const projected = dailyLogPayrollEntries(dailyLogPayrollTotals(rows, holidayForDate(date)), new Set(source.employees.filter(e => e.isDpw).map(e => e.id)));
    for (const row of projected) entries.push({ ...row, workDate: date, category: row.category === "dailyLogDpw" ? "dpw" : row.category, basis: "schedule-estimate", sourceIds: rows.filter(r => r.employeeId === row.employeeId).map(r => r.id) });
  }
  if (projectedDates.length) warnings.push("Schedule estimates use the saved department schedule, not live Aladtec. Each work date covers 06:00 through 06:00 the following day. Acting Officer stipends are not inferred from a scheduled role; confirm them in the actual Daily Log.");
  if (source.entries.some(e => e.workDate > staffingThrough && staffCategories.has(e.category))) warnings.push("For estimated dates, schedule hours REPLACE recorded staffing hours in this copy; they are never added together. The recorded hours remain unchanged.");
  const deferred = source.entries.filter(e => ["callback", "workDetail"].includes(e.category) && e.workDate > extrasThrough);
  if (deferred.length) warnings.push(`${deferred.length} recorded callback/work-detail entries are outside the extras cutoff and are excluded from this submission. Reconcile them later.`);
  for (const employee of source.employees) {
    const issues = payrollReviewIssues(entries.filter(e => e.employeeId === employee.id), source.staffing.filter(s => s.employeeId === employee.id && s.logDate <= staffingThrough));
    blockers.push(...issues.map(issue => `${employee.name}: ${issue}`));
  }
  if (new Set(incoming.map(a => a.id)).size !== incoming.length || incoming.some(a => a.targetPeriod !== source.period)) blockers.push("Duplicate or misrouted incoming adjustments.");
  const document: SubmissionDocument = { schemaVersion: 1, period: source.period, end, staffingThrough, extrasThrough, employees: source.employees, settings: source.settings, entries: entries.sort((a, b) => key(a).localeCompare(key(b))), incoming, grossCents: source.employees.reduce((sum, e) => sum + employeeGrossCents(e, entries, source.settings), 0) + incoming.reduce((sum, a) => sum + a.deltaCents, 0), warnings };
  return { document, blockers: [...new Set(blockers)] };
}

export function reconcileSubmission(saved: SavedSubmission, actual: PayrollSources, ledger: PayAdjustment[], targetPeriod: string) {
  payPeriodEnd(targetPeriod);
  if (targetPeriod <= saved.document.end) throw new Error("Carry-forward adjustments must go to a later pay period.");
  const blockers = validateSources(actual), snapshot = saved.document;
  const dates = payDates(snapshot.period);
  // Missing/unreviewed attendance must never silently become a deduction.
  for (const date of dates) for (const shift of ["morning", "afternoon", "overnight"]) if (!actual.approvals.some(a => a.logDate === date && a.shiftKey === shift && a.signOutAt)) blockers.push(`${date} ${shift}: officer handoff is not complete; no deduction or addition can be approved yet.`);
  const entries = recordedEntries(actual.entries);
  for (const employee of actual.employees) blockers.push(...payrollReviewIssues(entries.filter(e => e.employeeId === employee.id), actual.staffing.filter(s => s.employeeId === employee.id)).map(issue => `${employee.name}: ${issue}`));
  const employees = new Map(snapshot.employees.map(e => [e.id, e]));
  for (const e of entries) if (!employees.has(e.employeeId)) blockers.push("An employee is missing from the submitted rate snapshot. A payroll administrator must resolve their original-period rate before adjustment.");
  const candidates: Omit<PayAdjustment, "id">[] = [];
  for (const employee of snapshot.employees) {
    const prior = ledger.filter(a => a.sourcePeriod === snapshot.period && a.employeeId === employee.id).sort((a, b) => a.sequence - b.sequence);
    const submitted = snapshot.entries.filter(e => e.employeeId === employee.id);
    const previousEntries = prior.at(-1)?.actualEntries ?? submitted;
    const nowEntries = entries.filter(e => e.employeeId === employee.id);
    const beforeCents = employeeGrossCents(employee, submitted, snapshot.settings) + prior.reduce((sum, a) => sum + a.deltaCents, 0);
    const actualCents = employeeGrossCents(employee, nowEntries, snapshot.settings);
    const changes: PayAdjustment["changes"] = [];
    const keys = new Set([...previousEntries, ...nowEntries].map(key));
    for (const k of [...keys].sort()) {
      const before = previousEntries.find(e => key(e) === k), after = nowEntries.find(e => key(e) === k);
      if (hundredths(before?.hours ?? 0) !== hundredths(after?.hours ?? 0)) changes.push({ workDate: (after ?? before)!.workDate, category: (after ?? before)!.category, submittedHours: before?.hours ?? 0, actualHours: after?.hours ?? 0 });
    }
    if (changes.length || actualCents !== beforeCents) candidates.push({ sourcePeriod: snapshot.period, targetPeriod, employeeId: employee.id, employeeName: employee.name, sequence: prior.length + 1, beforeCents, actualCents, deltaCents: actualCents - beforeCents, changes, actualEntries: nowEntries });
  }
  return { candidates, blockers: [...new Set(blockers)] };
}
