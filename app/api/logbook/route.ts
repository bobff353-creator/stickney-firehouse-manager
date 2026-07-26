import { ensureDatabase } from "../../../db/bootstrap";
import { holidayForDate } from "../../holidays";

const callTypes = ["Fire", "EMS", "MVA", "TRT", "HazMat", "Auto Aid", "Mutual Aid", "Hazardous Condition", "Special"];
const shifts = ["morning", "afternoon", "overnight"];
const actorFor = (request: Request) => request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() || "System";
async function addRevision(db: Awaited<ReturnType<typeof ensureDatabase>>, id: string, action: string, summary: string, actor: string) { await db.prepare("INSERT INTO record_revisions (id, record_type, record_id, revision_number, action, summary, actor) SELECT ?, 'dailyLog', ?, COALESCE(MAX(revision_number), 0) + 1, ?, ?, ? FROM record_revisions WHERE record_type = 'dailyLog' AND record_id = ?").bind(crypto.randomUUID(), id, action, summary, actor, id).run(); }

function cleanDate(value: string | null) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? value! : chicagoDate();
}
function chicagoDate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function payrollPeriodStart(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  const day = parsed.getUTCDate();
  if (day >= 26) return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-26`;
  if (day >= 11) return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-11`;
  parsed.setUTCMonth(parsed.getUTCMonth() - 1);
  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, "0")}-26`;
}
function payrollPeriodEnd(start: string) {
  const parsed = new Date(`${start}T12:00:00Z`);
  if (parsed.getUTCDate() === 11) parsed.setUTCDate(25);
  else { parsed.setUTCMonth(parsed.getUTCMonth() + 1); parsed.setUTCDate(10); }
  return parsed.toISOString().slice(0, 10);
}
function workedHours(timeIn: string, timeOut: string) {
  const minutes = (value: string) => { const [hours, mins] = value.split(":").map(Number); return hours * 60 + mins; };
  const start = minutes(timeIn), rawEnd = minutes(timeOut);
  if (!Number.isFinite(start) || !Number.isFinite(rawEnd)) return 0;
  // A staffed row with matching in/out times represents a full 24-hour tour
  // (for example, 06:00 through 06:00 the following day).
  if (start === rawEnd) return 24;
  const end = rawEnd < start ? rawEnd + 1440 : rawEnd;
  return Math.max(0, Math.round(((end - start) / 60) * 100) / 100);
}

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    const date = cleanDate(new URL(request.url).searchParams.get("date"));
    const today = chicagoDate();
    await db.prepare("INSERT OR IGNORE INTO daily_logs (log_date) VALUES (?)").bind(date).run();
    await db.prepare("UPDATE daily_logs SET locked = 1, admin_unlocked = 0, locked_by = COALESCE(locked_by, 'System · Midnight Lock'), locked_at = COALESCE(locked_at, CURRENT_TIMESTAMP) WHERE log_date < ?").bind(today).run();
    const [log, staffing, calls, addresses, approvals, recentNotes, revisions] = await Promise.all([
      db.prepare("SELECT log_date AS logDate, shift_notes AS shiftNotes, CASE WHEN log_date < ? THEN 1 ELSE locked END AS locked, admin_unlocked AS adminUnlocked, created_by AS createdBy, COALESCE(created_at, updated_at) AS createdAt, updated_by AS updatedBy, updated_at AS updatedAt, locked_by AS lockedBy, locked_at AS lockedAt FROM daily_logs WHERE log_date = ?").bind(today, date).first(),
      db.prepare("SELECT id, shift_key AS shiftKey, employee_id AS employeeId, time_in AS timeIn, time_out AS timeOut, acting_officer AS actingOfficer, sort_order AS sortOrder FROM daily_log_staffing WHERE log_date = ? ORDER BY shift_key, sort_order").bind(date).all(),
      db.prepare("SELECT id, report_number AS reportNumber, time_out AS timeOut, time_in AS timeIn, responding_units AS respondingUnits, address, call_type AS callType, sort_order AS sortOrder FROM daily_log_calls WHERE log_date = ? ORDER BY sort_order").bind(date).all(),
      db.prepare("SELECT DISTINCT address FROM daily_log_calls WHERE address <> '' ORDER BY rowid DESC LIMIT 50").all(),
      db.prepare("SELECT shift_key AS shiftKey, sign_in_officer_id AS signInOfficerId, sign_in_at AS signInAt, sign_in_equipment AS signInEquipment, sign_in_note AS signInNote, reviewed_notes AS reviewedNotes, sign_out_officer_id AS signOutOfficerId, sign_out_at AS signOutAt, sign_out_equipment AS signOutEquipment, sign_out_note AS signOutNote FROM daily_log_approvals WHERE log_date = ?").bind(date).all(),
      db.prepare("SELECT log_date AS logDate, shift_notes AS note FROM daily_logs WHERE log_date < ? AND log_date >= date(?, '-7 day') AND shift_notes <> '' UNION ALL SELECT log_date AS logDate, sign_out_note AS note FROM daily_log_approvals WHERE log_date < ? AND log_date >= date(?, '-7 day') AND sign_out_note <> '' ORDER BY logDate DESC").bind(date, date, date, date).all(),
      db.prepare("SELECT revision_number AS revisionNumber, action, summary, actor, changed_at AS changedAt FROM record_revisions WHERE record_type = 'dailyLog' AND record_id = ? ORDER BY revision_number DESC").bind(date).all(),
    ]);
    return Response.json({ log: { ...(log as object), revisions: revisions.results }, staffing: staffing.results, calls: calls.results, approvals: approvals.results, recentNotes: recentNotes.results, addresses: addresses.results.map((row) => String((row as { address: string }).address)) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load daily log" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await ensureDatabase();
    const body = await request.json() as Record<string, unknown>;
    const date = cleanDate(String(body.logDate ?? ""));
    const action = String(body.action ?? "save");
    const actor = actorFor(request);
    const existing = await db.prepare("SELECT locked, admin_unlocked AS adminUnlocked FROM daily_logs WHERE log_date = ?").bind(date).first<{ locked: number; adminUnlocked: number }>();

    if (action === "adminUnlock") {
      await db.prepare("UPDATE daily_logs SET locked = 1, admin_unlocked = 1, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE log_date = ?").bind(actor, date).run();
      await addRevision(db, date, "Unlocked", "Administrator edit access granted", actor);
      return Response.json({ ok: true });
    }
    if ((date < chicagoDate() || existing?.locked) && !existing?.adminUnlocked) return Response.json({ error: "This daily log is locked. An administrator must unlock it before changes can be made." }, { status: 423 });

    if (action === "handoff") {
      const shiftKey = String(body.shiftKey ?? "");
      const mode = String(body.mode ?? "");
      const officerId = String(body.officerId ?? "");
      const equipment = JSON.stringify(body.equipment ?? {});
      const note = String(body.note ?? "").trim();
      if (!shifts.includes(shiftKey) || !["in", "out"].includes(mode) || !officerId) return Response.json({ error: "Select the officer completing this approval." }, { status: 400 });
      await db.prepare("INSERT OR IGNORE INTO daily_log_approvals (id, log_date, shift_key) VALUES (?, ?, ?)").bind(crypto.randomUUID(), date, shiftKey).run();
      if (mode === "in") {
        if (!body.reviewedNotes) return Response.json({ error: "Review and accept the previous seven days of notes first." }, { status: 400 });
        await db.prepare("UPDATE daily_log_approvals SET sign_in_officer_id = ?, sign_in_at = CURRENT_TIMESTAMP, sign_in_equipment = ?, sign_in_note = ?, reviewed_notes = 1 WHERE log_date = ? AND shift_key = ?").bind(officerId, equipment, note, date, shiftKey).run();
      } else {
        await db.prepare("UPDATE daily_log_approvals SET sign_out_officer_id = ?, sign_out_at = CURRENT_TIMESTAMP, sign_out_equipment = ?, sign_out_note = ? WHERE log_date = ? AND shift_key = ?").bind(officerId, equipment, note, date, shiftKey).run();
      }
      await db.prepare("UPDATE daily_logs SET updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE log_date = ?").bind(actor, date).run();
      await addRevision(db, date, mode === "in" ? "Officer signed in" : "Shift approved", `${shiftKey} officer handoff completed`, actor);
      return Response.json({ ok: true });
    }

    const staffing = Array.isArray(body.staffing) ? body.staffing as Array<Record<string, unknown>> : [];
    const calls = Array.isArray(body.calls) ? body.calls as Array<Record<string, unknown>> : [];
    await db.prepare("INSERT INTO daily_logs (log_date, shift_notes, created_by, updated_by, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(log_date) DO UPDATE SET shift_notes = excluded.shift_notes, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP").bind(date, String(body.shiftNotes ?? ""), actor, actor).run();
    await db.prepare("DELETE FROM daily_log_staffing WHERE log_date = ?").bind(date).run();
    await db.prepare("DELETE FROM daily_log_calls WHERE log_date = ?").bind(date).run();
    for (const [index, row] of staffing.entries()) {
      const shiftKey = String(row.shiftKey ?? "");
      if (!shifts.includes(shiftKey)) continue;
      await db.prepare("INSERT INTO daily_log_staffing (id, log_date, shift_key, employee_id, time_in, time_out, acting_officer, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(String(row.id || crypto.randomUUID()), date, shiftKey, String(row.employeeId ?? "") || null, String(row.timeIn ?? ""), String(row.timeOut ?? ""), row.actingOfficer ? 1 : 0, index).run();
    }
    for (const [index, row] of calls.entries()) {
      const callType = String(row.callType ?? "EMS");
      await db.prepare("INSERT INTO daily_log_calls (id, log_date, report_number, time_out, time_in, responding_units, address, call_type, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(String(row.id || crypto.randomUUID()), date, String(row.reportNumber ?? ""), String(row.timeOut ?? ""), String(row.timeIn ?? ""), String(row.respondingUnits ?? ""), String(row.address ?? ""), callTypes.includes(callType) ? callType : "Special", index).run();
    }
    const holiday = holidayForDate(date);
    const totals = new Map<string, { shift: number; holiday: number; actingOfficer: number }>();
    for (const row of staffing) {
      const employeeId = String(row.employeeId ?? "");
      const hours = workedHours(String(row.timeIn ?? ""), String(row.timeOut ?? ""));
      if (!employeeId || hours <= 0) continue;
      const current = totals.get(employeeId) ?? { shift: 0, holiday: 0, actingOfficer: 0 };
      const holidayApplies = Boolean(holiday && (!holiday.overnightOnly || String(row.shiftKey ?? "") === "overnight"));
      if (holidayApplies) current.holiday += hours;
      else current.shift += hours;
      if (row.actingOfficer) current.actingOfficer += hours;
      totals.set(employeeId, current);
    }
    const periodStart = payrollPeriodStart(date), periodEnd = payrollPeriodEnd(periodStart);
    await db.prepare("INSERT OR IGNORE INTO pay_periods (start_date, end_date, status) VALUES (?, ?, 'draft')").bind(periodStart, periodEnd).run();
    const [dpwRows, dpwEmployeeRows] = await Promise.all([
      db.prepare("SELECT employee_id AS employeeId, SUM(hours) AS hours FROM time_entries WHERE work_date = ? AND category = 'dpw' GROUP BY employee_id").bind(date).all(),
      db.prepare("SELECT employee_id AS employeeId FROM employee_profiles WHERE is_dpw = 1").all(),
    ]);
    const dpwByEmployee = new Map(dpwRows.results.map((row) => [String((row as { employeeId: string }).employeeId), Number((row as { hours: number }).hours)]));
    const dpwEmployees = new Set(dpwEmployeeRows.results.map((row) => String((row as { employeeId: string }).employeeId)));
    await db.prepare("DELETE FROM time_entries WHERE work_date = ? AND category IN ('shift', 'holiday', 'actingOfficer')").bind(date).run();
    for (const [employeeId, hours] of totals) {
      if (dpwEmployees.has(employeeId)) {
        const dpwHours = Math.round((hours.shift + hours.holiday) * 100) / 100;
        const actingOfficerHours = Math.round(hours.actingOfficer * 100) / 100;
        await db.prepare("DELETE FROM time_entries WHERE employee_id = ? AND work_date = ? AND category = 'dpw'").bind(employeeId, date).run();
        if (dpwHours > 0) await db.prepare("INSERT INTO time_entries (id, employee_id, period_start, work_date, category, hours, updated_at) VALUES (?, ?, ?, ?, 'dpw', ?, CURRENT_TIMESTAMP)").bind(crypto.randomUUID(), employeeId, periodStart, date, dpwHours).run();
        if (actingOfficerHours > 0) await db.prepare("INSERT INTO time_entries (id, employee_id, period_start, work_date, category, hours, updated_at) VALUES (?, ?, ?, ?, 'actingOfficer', ?, CURRENT_TIMESTAMP)").bind(crypto.randomUUID(), employeeId, periodStart, date, actingOfficerHours).run();
        continue;
      }
      let dpwHours = dpwByEmployee.get(employeeId) ?? 0;
      const holidayHours = Math.max(0, hours.holiday - dpwHours); dpwHours = Math.max(0, dpwHours - hours.holiday);
      const shiftHours = Math.max(0, hours.shift - dpwHours);
      const actingOfficerHours = Math.max(0, hours.actingOfficer - (dpwByEmployee.get(employeeId) ?? 0));
      if (shiftHours > 0) await db.prepare("INSERT INTO time_entries (id, employee_id, period_start, work_date, category, hours, updated_at) VALUES (?, ?, ?, ?, 'shift', ?, CURRENT_TIMESTAMP)").bind(crypto.randomUUID(), employeeId, periodStart, date, Math.round(shiftHours * 100) / 100).run();
      if (holidayHours > 0) await db.prepare("INSERT INTO time_entries (id, employee_id, period_start, work_date, category, hours, updated_at) VALUES (?, ?, ?, ?, 'holiday', ?, CURRENT_TIMESTAMP)").bind(crypto.randomUUID(), employeeId, periodStart, date, Math.round(holidayHours * 100) / 100).run();
      if (actingOfficerHours > 0) await db.prepare("INSERT INTO time_entries (id, employee_id, period_start, work_date, category, hours, updated_at) VALUES (?, ?, ?, ?, 'actingOfficer', ?, CURRENT_TIMESTAMP)").bind(crypto.randomUUID(), employeeId, periodStart, date, Math.round(actingOfficerHours * 100) / 100).run();
    }
    await addRevision(db, date, "Saved", `Staffing, calls, and notes updated; ${totals.size} payroll record(s) synchronized`, actor);
    return Response.json({ ok: true, payrollEmployeesUpdated: totals.size, periodStart, holiday: holiday?.name ?? null });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save daily log" }, { status: 500 });
  }
}
