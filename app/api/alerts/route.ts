import { ensureDatabase } from "../../../db/bootstrap";
const ownerAdminEmails = ["bobff353@gmail.com"];
function chicago() { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()); const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00"; return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) }; }
const shiftFor = (minutes: number) => minutes < 360 ? "overnight" : minutes < 720 ? "morning" : minutes < 1080 ? "afternoon" : "overnight";
const priorShift = (shift: string) => shift === "morning" ? "overnight" : shift === "afternoon" ? "morning" : "afternoon";
async function admin(request: Request, db: Awaited<ReturnType<typeof ensureDatabase>>) { const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? ""; if (ownerAdminEmails.includes(email)) return true; const row = email ? await db.prepare("SELECT is_admin AS isAdmin FROM employee_profiles WHERE lower(email) = ? LIMIT 1").bind(email).first<{ isAdmin: number }>() : null; return Boolean(row?.isAdmin); }
function issues(raw: unknown) { try { return Object.entries(JSON.parse(String(raw || "{}")) as Record<string, { status?: string; detail?: string }>).filter(([, value]) => value.status && value.status !== "Present"); } catch { return []; } }
const minutes = (value: unknown) => { const [h, m] = String(value || "").split(":").map(Number); return h * 60 + m; };

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase(), isAdmin = await admin(request, db), now = chicago(), shift = shiftFor(now.minutes), previous = priorShift(shift);
    const [approval, previousApproval, staffing, overlapRows, profileRows] = await Promise.all([
      db.prepare("SELECT sign_in_at AS signInAt, sign_in_equipment AS equipment FROM daily_log_approvals WHERE log_date = ? AND shift_key = ?").bind(now.date, shift).first<Record<string, unknown>>(),
      db.prepare("SELECT sign_out_at AS signOutAt FROM daily_log_approvals WHERE log_date = ? AND shift_key = ?").bind(now.date, previous).first<Record<string, unknown>>(),
      db.prepare("SELECT COUNT(*) AS count FROM daily_log_staffing WHERE log_date = ? AND shift_key = ? AND employee_id IS NOT NULL").bind(now.date, shift).first<{ count: number }>(),
      db.prepare("SELECT s.log_date AS logDate, s.employee_id AS employeeId, s.time_in AS timeIn, s.time_out AS timeOut, e.name FROM daily_log_staffing s JOIN employees e ON e.id = s.employee_id WHERE date(s.log_date) >= date(?, '-1 day') ORDER BY s.employee_id, s.log_date, s.time_in").bind(now.date).all(),
      db.prepare("SELECT e.name, ep.phone, ep.email, ep.driver_status AS driverStatus FROM employees e LEFT JOIN employee_profiles ep ON ep.employee_id = e.id WHERE e.active = 1 AND (COALESCE(ep.phone, '') = '' OR COALESCE(ep.email, '') = '' OR COALESCE(ep.driver_status, '') = '') ORDER BY e.name").all(),
    ]);
    const alerts: Array<{ id: string; severity: "critical" | "warning" | "info"; category: string; title: string; detail: string; page: string }> = [];
    if (!approval?.signInAt) alerts.push({ id: "missing-oic", severity: "critical", category: "Coverage", title: "Missing officer coverage", detail: `${shift} shift has no completed officer sign-in.`, page: "Daily Log" });
    if (Number(staffing?.count || 0) < 4) alerts.push({ id: "staffing-short", severity: "warning", category: "Coverage", title: "Staffing incomplete", detail: `${staffing?.count || 0} of 4 positions are filled for the current shift.`, page: "Daily Log" });
    if (!previousApproval?.signOutAt) alerts.push({ id: "unfinished-signout", severity: "warning", category: "Approval", title: "Unfinished shift sign-out", detail: `${previous} shift has not completed officer sign-out.`, page: "Daily Log" });
    for (const [item, issue] of issues(approval?.equipment)) alerts.push({ id: `equipment-${item}`, severity: issue.status === "Missing" ? "critical" : "warning", category: "Equipment", title: `${item} · ${issue.status}`, detail: issue.detail || "No equipment details were entered.", page: "Daily Log" });
    const byEmployee = new Map<string, Array<Record<string, unknown>>>(); for (const row of overlapRows.results as Array<Record<string, unknown>>) byEmployee.set(String(row.employeeId), [...(byEmployee.get(String(row.employeeId)) ?? []), row]);
    for (const rows of byEmployee.values()) for (let i = 0; i < rows.length; i += 1) for (let j = i + 1; j < rows.length; j += 1) { const a = rows[i], b = rows[j]; let aEnd = minutes(a.timeOut), bEnd = minutes(b.timeOut); const aStart = minutes(a.timeIn), bStart = minutes(b.timeIn); if (aEnd <= aStart) aEnd += 1440; if (bEnd <= bStart) bEnd += 1440; const dayOffset = String(a.logDate) === String(b.logDate) ? 0 : 1440; const overlap = Math.max(aStart, bStart + dayOffset) < Math.min(aEnd, bEnd + dayOffset); if (overlap) alerts.push({ id: `overlap-${a.employeeId}-${i}-${j}`, severity: "critical", category: "Time", title: "Overlapping employee hours", detail: `${a.name} has overlapping Daily Log assignments.`, page: "Daily Log" }); }
    if (isAdmin) { const profiles = profileRows.results as Array<Record<string, unknown>>; if (profiles.length) alerts.push({ id: "profiles", severity: "info", category: "Personnel", title: "Employee information needs attention", detail: `${profiles.length} active employee record${profiles.length === 1 ? " is" : "s are"} missing phone, email, or driver/qualification status.`, page: "Employees" }); }
    const rank = { critical: 0, warning: 1, info: 2 }; alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
    return Response.json({ alerts, count: alerts.length, generatedAt: new Date().toISOString(), isAdmin });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Unable to load alerts" }, { status: 500 }); }
}
