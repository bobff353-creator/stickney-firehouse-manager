import { ensureDatabase } from "../../../db/bootstrap";
import { projectDispatchIntoDailyLog } from "../../dispatch-daily-log";
import { sendCadPushNotifications } from "../../cad-push";

type RuntimeEnv = {
  DISPATCH_BRIDGE_READ_TOKEN?: string;
};

type BridgedIncident = {
  reportNumber?: unknown;
  resendEmailId?: unknown;
  callType?: unknown;
  category?: unknown;
  address?: unknown;
  city?: unknown;
  narrative?: unknown;
  respondingUnits?: unknown;
  longitude?: unknown;
  latitude?: unknown;
  dispatchedAt?: unknown;
  timeOut?: unknown;
  attachmentCount?: unknown;
};

function safeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let mismatch = 0;
  for (let index = 0; index < leftBytes.length; index++) mismatch |= leftBytes[index] ^ rightBytes[index];
  return mismatch === 0;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function POST(request: Request) {
  try {
    const token = (process.env as RuntimeEnv).DISPATCH_BRIDGE_READ_TOKEN || "";
    const authorization = request.headers.get("authorization") || "";
    if (!token || !safeEqual(authorization, `Bearer ${token}`)) {
      return Response.json({ error: "Unauthorized bridge delivery" }, { status: 401 });
    }

    const incident = await request.json() as BridgedIncident;
    const reportNumber = text(incident.reportNumber);
    const callType = text(incident.callType);
    const dispatchedAt = text(incident.dispatchedAt);
    if (!reportNumber || !callType || !dispatchedAt || Number.isNaN(new Date(dispatchedAt).getTime())) {
      return Response.json({ error: "Invalid bridge incident" }, { status: 400 });
    }

    const db = await ensureDatabase();
    const existing = await db.prepare(
      "SELECT incident_id FROM dispatch_incidents WHERE incident_id = ? LIMIT 1",
    ).bind(reportNumber).first<{ incident_id: string }>();
    await db.prepare(
      "INSERT INTO dispatch_incidents (incident_id, resend_email_id, call_type, category, address, city, narrative, responding_units, longitude, latitude, dispatched_at, time_out, attachment_count, source_payload, received_at, cleared_at, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, NULL, 1) ON CONFLICT(incident_id) DO UPDATE SET resend_email_id=excluded.resend_email_id, call_type=excluded.call_type, category=excluded.category, address=excluded.address, city=excluded.city, narrative=excluded.narrative, responding_units=excluded.responding_units, longitude=excluded.longitude, latitude=excluded.latitude, dispatched_at=excluded.dispatched_at, time_out=excluded.time_out, attachment_count=excluded.attachment_count, source_payload=excluded.source_payload, received_at=CURRENT_TIMESTAMP, cleared_at=NULL, active=1"
    ).bind(
      reportNumber,
      text(incident.resendEmailId) || `bridge-${reportNumber}`,
      callType,
      text(incident.category),
      text(incident.address),
      text(incident.city),
      text(incident.narrative),
      text(incident.respondingUnits),
      optionalNumber(incident.longitude),
      optionalNumber(incident.latitude),
      dispatchedAt,
      text(incident.timeOut),
      Math.max(0, Math.trunc(optionalNumber(incident.attachmentCount) || 0)),
      JSON.stringify(incident),
    ).run();
    await projectDispatchIntoDailyLog(db, {
      reportNumber,
      dispatchedAt,
      timeOut: text(incident.timeOut),
      respondingUnits: text(incident.respondingUnits),
      address: text(incident.address),
      callType,
    });
    if (!existing) {
      await sendCadPushNotifications(db, {
        incidentId: reportNumber,
        callType,
        timeOut: text(incident.timeOut),
        narrative: text(incident.narrative),
      });
    }

    return Response.json({ accepted: true, incidentId: reportNumber });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to accept bridge dispatch" }, { status: 500 });
  }
}
