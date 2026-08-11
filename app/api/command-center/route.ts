import { ensureDatabase } from "../../../db/bootstrap";
import { buildPayrollDetails, buildStaffingDetails } from "../../command-center-analytics";
const ownerAdminEmails = ["bobff353@gmail.com"];
async function isAdmin(request: Request, db: Awaited<ReturnType<typeof ensureDatabase>>) { const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? ""; if (ownerAdminEmails.includes(email)) return true; const row = email ? await db.prepare("SELECT is_admin AS isAdmin FROM employee_profiles WHERE lower(email) = ? LIMIT 1").bind(email).first<{ isAdmin: number }>() : null; return Boolean(row?.isAdmin); }
function equipmentCount(raw: unknown) { try { return Object.values(JSON.parse(String(raw || "{}")) as Record<string, { status?: string }>).filter((item) => item.status && item.status !== "Present").length; } catch { return 0; } }
type Metric = { date: string; staffingGaps: number; overtimeHours: number; aoHours: number; calls: number; equipmentIssues: number; payrollCost: number };
function fiscalYear() {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const year = Number(today.slice(0, 4));
  const startYear = today.slice(5) >= "05-01" ? year : year - 1;
  return { startDate: `${startYear}-05-01`, endDate: `${startYear + 1}-04-30` };
}
export async function GET(request: Request) {
  try {
    const db = await ensureDatabase(); if (!await isAdmin(request, db)) return Response.json({ error: "Administrator privileges are required." }, { status: 403 });
    const [staffing, calls, callTiming, approvals, entries, settings, rateHistory] = await Promise.all([
      db.prepare("SELECT l.log_date AS date, shifts.shift_key AS shiftKey, COUNT(s.employee_id) AS filled FROM daily_logs l CROSS JOIN (SELECT 'morning' AS shift_key UNION ALL SELECT 'afternoon' UNION ALL SELECT 'overnight') shifts LEFT JOIN daily_log_staffing s ON s.log_date = l.log_date AND s.shift_key = shifts.shift_key AND s.employee_id IS NOT NULL WHERE date(l.log_date) >= date('now', '-365 day') GROUP BY l.log_date, shifts.shift_key").all(),
      db.prepare("SELECT log_date AS date, call_type AS callType, COUNT(*) AS count FROM daily_log_calls WHERE date(log_date) >= date('now', '-365 day') GROUP BY log_date, call_type").all(),
      db.prepare("SELECT log_date AS date, time_out AS timeOut FROM daily_log_calls WHERE date(log_date) >= date('now', '-365 day') ORDER BY log_date, time_out").all(),
      db.prepare("SELECT log_date AS date, sign_in_equipment AS signInEquipment, sign_out_equipment AS signOutEquipment FROM daily_log_approvals WHERE date(log_date) >= date('now', '-365 day')").all(),
      db.prepare("SELECT t.employee_id AS employeeId, t.period_start AS periodStart, t.work_date AS date, t.category, t.hours, ps.label AS rank, ps.id AS payScaleId, ps.regular_rate AS regularRate, ps.holiday_rate AS holidayRate FROM time_entries t JOIN employees e ON e.id = t.employee_id JOIN pay_scales ps ON ps.id = e.pay_scale_id WHERE date(t.work_date) >= date('now', '-365 day') ORDER BY t.employee_id, t.period_start, t.work_date, t.category").all(),
      db.prepare("SELECT overtime_threshold AS overtimeThreshold, acting_officer_premium AS actingOfficerPremium, dpw_multiplier AS dpwMultiplier FROM payroll_settings WHERE id = 1").first<{ overtimeThreshold: number; actingOfficerPremium: number; dpwMultiplier: number }>(),
      db.prepare("SELECT pay_scale_id AS payScaleId, effective_date AS effectiveDate, regular_rate AS regularRate, holiday_rate AS holidayRate FROM pay_rate_history ORDER BY pay_scale_id, effective_date DESC").all(),
    ]);
    const map = new Map<string, Metric>(); const metric = (date: string) => { if (!map.has(date)) map.set(date, { date, staffingGaps: 0, overtimeHours: 0, aoHours: 0, calls: 0, equipmentIssues: 0, payrollCost: 0 }); return map.get(date)!; };
    const staffingDetails = buildStaffingDetails((staffing.results as Array<Record<string, unknown>>).map((row) => ({ date: String(row.date), shiftKey: String(row.shiftKey), filled: Number(row.filled || 0) })));
    for (const row of staffingDetails) metric(row.date).staffingGaps += row.gaps;
    const responseTypes: Record<string, number> = {}; const responseTypeDaily: Array<{ date: string; callType: string; count: number }> = []; for (const row of calls.results as Array<Record<string, unknown>>) { metric(String(row.date)).calls += Number(row.count); responseTypes[String(row.callType)] = (responseTypes[String(row.callType)] || 0) + Number(row.count); responseTypeDaily.push({ date: String(row.date), callType: String(row.callType), count: Number(row.count) }); }
    for (const row of approvals.results as Array<Record<string, unknown>>) metric(String(row.date)).equipmentIssues += equipmentCount(row.signInEquipment) + equipmentCount(row.signOutEquipment);
    const payrollDetails = buildPayrollDetails(entries.results as never[], rateHistory.results as never[], settings ?? { overtimeThreshold: 106, actingOfficerPremium: 1, dpwMultiplier: 1.5 });
    for (const row of payrollDetails) { const day = metric(row.date); day.overtimeHours += row.overtimeHours; day.aoHours += row.category === "actingOfficer" ? row.hours : 0; day.payrollCost += row.cost; }
    const fiscal = fiscalYear();
    const daily = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
    const payToDate = daily.filter((row) => row.date >= fiscal.startDate && row.date <= fiscal.endDate).reduce((sum, row) => sum + row.payrollCost, 0);
    return Response.json({ daily, responseTypes, responseTypeDaily, callTiming: callTiming.results, staffingDetails, payrollDetails, fiscalYear: { ...fiscal, payToDate }, generatedAt: new Date().toISOString() });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Unable to load command center" }, { status: 500 }); }
}
