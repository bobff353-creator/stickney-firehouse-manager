import { ensureDatabase } from "../../../db/bootstrap";

function chicagoParts() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const get = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}
function shiftFor(minutes: number) { return minutes < 360 ? "overnight" : minutes < 720 ? "morning" : minutes < 1080 ? "afternoon" : "overnight"; }
function previousShift(current: string) { return current === "morning" ? "overnight" : current === "afternoon" ? "morning" : "afternoon"; }
function equipmentIssues(raw: unknown) {
  try { return Object.entries(JSON.parse(String(raw || "{}")) as Record<string, { status?: string; detail?: string }>).filter(([, item]) => item.status && item.status !== "Present").map(([key, item]) => ({ item: key, status: item.status || "Issue", detail: item.detail || "" })); } catch { return []; }
}

export async function GET() {
  try {
    const db = await ensureDatabase();
    const now = chicagoParts(), currentShift = shiftFor(now.minutes), priorShift = previousShift(currentShift);
    await db.prepare("INSERT OR IGNORE INTO daily_logs (log_date) VALUES (?)").bind(now.date).run();
    const [staffing, approvals, calls, log, payrollWaiting] = await Promise.all([
      db.prepare("SELECT s.employee_id AS employeeId, s.time_in AS timeIn, s.time_out AS timeOut, s.acting_officer AS actingOfficer, e.name, ps.label AS rank FROM daily_log_staffing s JOIN employees e ON e.id = s.employee_id JOIN pay_scales ps ON ps.id = e.pay_scale_id WHERE s.log_date = ? AND s.shift_key = ? ORDER BY s.sort_order").bind(now.date, currentShift).all(),
      db.prepare("SELECT a.shift_key AS shiftKey, a.sign_in_at AS signInAt, a.sign_out_at AS signOutAt, a.sign_in_equipment AS signInEquipment, a.sign_out_equipment AS signOutEquipment, a.sign_in_note AS signInNote, a.sign_out_note AS signOutNote, e.name AS officerName FROM daily_log_approvals a LEFT JOIN employees e ON e.id = a.sign_in_officer_id WHERE a.log_date = ? AND a.shift_key IN (?, ?)").bind(now.date, currentShift, priorShift).all(),
      db.prepare("SELECT report_number AS reportNumber, time_out AS timeOut, time_in AS timeIn, responding_units AS respondingUnits, address, call_type AS callType FROM daily_log_calls WHERE log_date = ? ORDER BY sort_order DESC LIMIT 12").bind(now.date).all(),
      db.prepare("SELECT shift_notes AS shiftNotes, locked, admin_unlocked AS adminUnlocked FROM daily_logs WHERE log_date = ?").bind(now.date).first(),
      db.prepare("SELECT COUNT(*) AS count FROM pay_periods WHERE status IN ('draft', 'reviewed')").first<{ count: number }>(),
    ]);
    const approvalRows = approvals.results as Array<Record<string, unknown>>;
    const currentApproval = approvalRows.find((row) => row.shiftKey === currentShift);
    const priorApproval = approvalRows.find((row) => row.shiftKey === priorShift);
    const issues = equipmentIssues(currentApproval?.signOutEquipment || currentApproval?.signInEquipment);
    const callRows = calls.results as Array<Record<string, unknown>>;
    const activeCalls = callRows.filter((call) => call.timeOut && !call.timeIn);
    const activeUnitText = activeCalls.map((call) => String(call.respondingUnits || "")).join(",");
    const apparatus = ["1201", "1203", "1204", "1205", "1207"].map((unit) => ({ unit, status: new RegExp(`(^|\\D)${unit}(\\D|$)`).test(activeUnitText) ? "Committed to call" : "Status not reported" }));
    const openLogApprovals = (currentApproval?.signInAt ? 0 : 1) + (priorApproval?.signOutAt ? 0 : 1);
    return Response.json({
      asOf: new Date().toISOString(), date: now.date, currentShift, priorShift,
      onDuty: staffing.results,
      officerInCharge: currentApproval?.officerName || null,
      staffing: { filled: staffing.results.length, required: 4, complete: staffing.results.length >= 4 && Boolean(currentApproval?.signInAt) },
      equipmentIssues: issues,
      activeCalls,
      apparatus,
      approvals: { logs: openLogApprovals, payroll: Number(payrollWaiting?.count || 0) },
      previousShift: { officer: priorApproval?.officerName || null, note: priorApproval?.signOutNote || priorApproval?.signInNote || (log as { shiftNotes?: string } | null)?.shiftNotes || "No handoff note was entered.", calls: calls.results },
    });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Unable to load dashboard briefing" }, { status: 500 }); }
}
