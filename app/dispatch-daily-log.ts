import type { ensureDatabase } from "../db/bootstrap";
import { chicagoOperationalContext } from "./operational-day";

type Database = Awaited<ReturnType<typeof ensureDatabase>>;

export type DailyLogDispatch = {
  reportNumber: string;
  dispatchedAt: string;
  timeOut: string;
  respondingUnits: string;
  address: string;
  callType: string;
};

export async function projectDispatchIntoDailyLog(db: Database, incident: DailyLogDispatch) {
  const logDate = chicagoOperationalContext(new Date(incident.dispatchedAt)).operationalDate;
  const callId = `dispatch:${incident.reportNumber}`;

  await db.batch([
    db.prepare("INSERT OR IGNORE INTO daily_logs (log_date, created_by, updated_by) VALUES (?, 'CAD email', 'CAD email')").bind(logDate),
    db.prepare("UPDATE daily_log_calls SET time_out = ?, responding_units = ?, address = ?, call_type = ? WHERE log_date = ? AND report_number = ?").bind(
      incident.timeOut,
      incident.respondingUnits,
      incident.address,
      incident.callType,
      logDate,
      incident.reportNumber,
    ),
    db.prepare(
      "INSERT INTO daily_log_calls (id, log_date, report_number, time_out, time_in, responding_units, address, call_type, sort_order) SELECT ?, ?, ?, ?, '', ?, ?, ?, COALESCE((SELECT MAX(sort_order) + 1 FROM daily_log_calls WHERE log_date = ?), 0) WHERE NOT EXISTS (SELECT 1 FROM daily_log_calls WHERE log_date = ? AND report_number = ?)"
    ).bind(
      callId,
      logDate,
      incident.reportNumber,
      incident.timeOut,
      incident.respondingUnits,
      incident.address,
      incident.callType,
      logDate,
      logDate,
      incident.reportNumber,
    ),
  ]);
}
