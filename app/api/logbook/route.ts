import { ensureDatabase } from "../../../db/bootstrap";

const callTypes = ["Fire", "EMS", "MVA", "TRT", "HazMat", "Auto Aid", "Mutual Aid", "Hazardous Condition", "Special"];
const shifts = ["morning", "afternoon", "overnight"];

function cleanDate(value: string | null) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? value! : chicagoDate();
}
function chicagoDate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    const date = cleanDate(new URL(request.url).searchParams.get("date"));
    const today = chicagoDate();
    await db.prepare("INSERT OR IGNORE INTO daily_logs (log_date) VALUES (?)").bind(date).run();
    await db.prepare("UPDATE daily_logs SET locked = 1, admin_unlocked = 0 WHERE log_date < ?").bind(today).run();
    const [log, staffing, calls, addresses, approvals, recentNotes] = await Promise.all([
      db.prepare("SELECT log_date AS logDate, shift_notes AS shiftNotes, CASE WHEN log_date < ? THEN 1 ELSE locked END AS locked, admin_unlocked AS adminUnlocked, updated_at AS updatedAt FROM daily_logs WHERE log_date = ?").bind(today, date).first(),
      db.prepare("SELECT id, shift_key AS shiftKey, employee_id AS employeeId, time_in AS timeIn, time_out AS timeOut, acting_officer AS actingOfficer, sort_order AS sortOrder FROM daily_log_staffing WHERE log_date = ? ORDER BY shift_key, sort_order").bind(date).all(),
      db.prepare("SELECT id, report_number AS reportNumber, time_out AS timeOut, time_in AS timeIn, responding_units AS respondingUnits, address, call_type AS callType, sort_order AS sortOrder FROM daily_log_calls WHERE log_date = ? ORDER BY sort_order").bind(date).all(),
      db.prepare("SELECT DISTINCT address FROM daily_log_calls WHERE address <> '' ORDER BY rowid DESC LIMIT 50").all(),
      db.prepare("SELECT shift_key AS shiftKey, sign_in_officer_id AS signInOfficerId, sign_in_at AS signInAt, sign_in_equipment AS signInEquipment, sign_in_note AS signInNote, reviewed_notes AS reviewedNotes, sign_out_officer_id AS signOutOfficerId, sign_out_at AS signOutAt, sign_out_equipment AS signOutEquipment, sign_out_note AS signOutNote FROM daily_log_approvals WHERE log_date = ?").bind(date).all(),
      db.prepare("SELECT log_date AS logDate, shift_notes AS note FROM daily_logs WHERE log_date < ? AND log_date >= date(?, '-7 day') AND shift_notes <> '' UNION ALL SELECT log_date AS logDate, sign_out_note AS note FROM daily_log_approvals WHERE log_date < ? AND log_date >= date(?, '-7 day') AND sign_out_note <> '' ORDER BY logDate DESC").bind(date, date, date, date).all(),
    ]);
    return Response.json({ log, staffing: staffing.results, calls: calls.results, approvals: approvals.results, recentNotes: recentNotes.results, addresses: addresses.results.map((row) => String((row as { address: string }).address)) });
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
    const existing = await db.prepare("SELECT locked, admin_unlocked AS adminUnlocked FROM daily_logs WHERE log_date = ?").bind(date).first<{ locked: number; adminUnlocked: number }>();

    if (action === "adminUnlock") {
      await db.prepare("UPDATE daily_logs SET locked = 1, admin_unlocked = 1 WHERE log_date = ?").bind(date).run();
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
      return Response.json({ ok: true });
    }

    const staffing = Array.isArray(body.staffing) ? body.staffing as Array<Record<string, unknown>> : [];
    const calls = Array.isArray(body.calls) ? body.calls as Array<Record<string, unknown>> : [];
    await db.prepare("INSERT INTO daily_logs (log_date, shift_notes, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(log_date) DO UPDATE SET shift_notes = excluded.shift_notes, updated_at = CURRENT_TIMESTAMP").bind(date, String(body.shiftNotes ?? "")).run();
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
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save daily log" }, { status: 500 });
  }
}
