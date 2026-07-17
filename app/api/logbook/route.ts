import { ensureDatabase } from "../../../db/bootstrap";

const callTypes = ["Fire", "EMS", "MVA", "TRT", "HazMat", "Auto Aid", "Mutual Aid", "Hazardous Condition", "Special"];
const shifts = ["morning", "afternoon", "overnight"];

function cleanDate(value: string | null) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") ? value! : new Date().toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    const date = cleanDate(new URL(request.url).searchParams.get("date"));
    await db.prepare("INSERT OR IGNORE INTO daily_logs (log_date) VALUES (?)").bind(date).run();
    const [log, staffing, calls, addresses] = await Promise.all([
      db.prepare("SELECT log_date AS logDate, shift_notes AS shiftNotes FROM daily_logs WHERE log_date = ?").bind(date).first(),
      db.prepare("SELECT id, shift_key AS shiftKey, employee_id AS employeeId, time_in AS timeIn, time_out AS timeOut, sort_order AS sortOrder FROM daily_log_staffing WHERE log_date = ? ORDER BY shift_key, sort_order").bind(date).all(),
      db.prepare("SELECT id, report_number AS reportNumber, time_out AS timeOut, time_in AS timeIn, responding_units AS respondingUnits, address, call_type AS callType, sort_order AS sortOrder FROM daily_log_calls WHERE log_date = ? ORDER BY sort_order").bind(date).all(),
      db.prepare("SELECT DISTINCT address FROM daily_log_calls WHERE address <> '' ORDER BY rowid DESC LIMIT 50").all(),
    ]);
    return Response.json({ log, staffing: staffing.results, calls: calls.results, addresses: addresses.results.map((row) => String((row as { address: string }).address)) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load daily log" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await ensureDatabase();
    const body = await request.json() as Record<string, unknown>;
    const date = cleanDate(String(body.logDate ?? ""));
    const staffing = Array.isArray(body.staffing) ? body.staffing as Array<Record<string, unknown>> : [];
    const calls = Array.isArray(body.calls) ? body.calls as Array<Record<string, unknown>> : [];
    await db.prepare("INSERT INTO daily_logs (log_date, shift_notes, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(log_date) DO UPDATE SET shift_notes = excluded.shift_notes, updated_at = CURRENT_TIMESTAMP").bind(date, String(body.shiftNotes ?? "")).run();
    await db.prepare("DELETE FROM daily_log_staffing WHERE log_date = ?").bind(date).run();
    await db.prepare("DELETE FROM daily_log_calls WHERE log_date = ?").bind(date).run();
    for (const [index, row] of staffing.entries()) {
      const shiftKey = String(row.shiftKey ?? "");
      if (!shifts.includes(shiftKey)) continue;
      await db.prepare("INSERT INTO daily_log_staffing (id, log_date, shift_key, employee_id, time_in, time_out, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(String(row.id || crypto.randomUUID()), date, shiftKey, String(row.employeeId ?? "") || null, String(row.timeIn ?? ""), String(row.timeOut ?? ""), index).run();
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
