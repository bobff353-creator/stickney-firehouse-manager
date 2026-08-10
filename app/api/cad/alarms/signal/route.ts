import { ensureDatabase } from "../../../../../db/bootstrap";
import { verifyMachine } from "../../../../cad-auth";
import { normalizeAlarmSignal } from "../../../../cad-dispatch-service";
import { deliverToAgencies, insertIncidentNote } from "../../../../cad-dispatch-server";
import { projectDispatchIntoDailyLog } from "../../../../dispatch-daily-log";

type Db = Awaited<ReturnType<typeof ensureDatabase>>;
type Panel = { id: string; name: string; inboundToken: string; address: string; latitude: number | null; longitude: number | null; autoCreateIncident: number };

const MAX_BODY = 131_072;

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") || "0") > MAX_BODY) return Response.json({ error: "Payload too large." }, { status: 413 });
    const body = await request.text();
    if (!body || body.length > MAX_BODY) return Response.json({ error: "Payload must be between 1 byte and 128 KB." }, { status: 413 });

    const db = await ensureDatabase();
    const panel = await authenticatePanel(db, request, body);
    if (!panel) return Response.json({ error: "Invalid alarm panel authentication." }, { status: 401 });

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return Response.json({ error: "Body must be JSON." }, { status: 400 });
    }
    const result = normalizeAlarmSignal((parsed && typeof parsed === "object" && "data" in (parsed as Record<string, unknown>) ? (parsed as Record<string, unknown>).data : parsed));
    if (!result.ok) return Response.json({ error: result.error }, { status: 422 });
    const signal = result.signal;

    // Dedupe on the panel's own event id when one is supplied.
    if (signal.externalEventId) {
      const prior = await db.prepare("SELECT id, incident_id AS incidentId FROM cad_alarm_events WHERE panel_id = ? AND external_event_id = ? LIMIT 1").bind(panel.id, signal.externalEventId).first<{ id: string; incidentId: string }>();
      if (prior) return Response.json({ accepted: true, duplicate: true, eventId: prior.id, incidentId: prior.incidentId });
    }

    const latitude = signal.latitude ?? panel.latitude;
    const longitude = signal.longitude ?? panel.longitude;
    const address = signal.address || panel.address;
    let incidentId = "";

    // A real alarm signal on an auto-dispatch panel opens a live incident.
    if (signal.signalType === "alarm" && panel.autoCreateIncident) {
      incidentId = `ALARM-${panel.id.slice(0, 8)}-${Date.now()}`;
      const callType = `Fire Alarm — ${panel.name}`;
      const narrative = `${signal.description}${signal.zone ? ` (zone ${signal.zone})` : ""}`;
      await db.prepare(
        "INSERT INTO dispatch_incidents (incident_id, resend_email_id, call_type, category, address, city, narrative, responding_units, longitude, latitude, dispatched_at, time_out, attachment_count, source_payload, source_system, received_at, cleared_at, active) VALUES (?, ?, ?, 'Fire', ?, '', ?, '', ?, ?, ?, '', 0, ?, ?, CURRENT_TIMESTAMP, NULL, 1)",
      ).bind(incidentId, `alarm-${incidentId}`, callType, address, narrative, longitude, latitude, signal.eventAt, JSON.stringify(signal), `${panel.name} (Alarm)`).run();
      await projectDispatchIntoDailyLog(db, { reportNumber: incidentId, dispatchedAt: signal.eventAt, timeOut: "", respondingUnits: "", address, callType });
      await insertIncidentNote(db, { incidentId, note: narrative, category: "dispatch", author: panel.name, unitNumber: "", eventAt: signal.eventAt, externalId: signal.externalEventId }, { source: "alarm", agency: panel.name });
    }

    const eventId = crypto.randomUUID();
    await db.prepare(
      "INSERT INTO cad_alarm_events (id, panel_id, panel_name, external_event_id, signal_type, zone, description, priority, latitude, longitude, incident_id, event_at, raw_payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(eventId, panel.id, panel.name, signal.externalEventId, signal.signalType, signal.zone, signal.description, signal.priority, latitude, longitude, incidentId, signal.eventAt, body).run();
    await db.prepare("UPDATE cad_alarm_panels SET last_signal_at = CURRENT_TIMESTAMP WHERE id = ?").bind(panel.id).run();

    await deliverToAgencies(db, "alarm", { panel: panel.name, signalType: signal.signalType, zone: signal.zone, description: signal.description, priority: signal.priority, address, incidentId, eventAt: signal.eventAt }, incidentId);

    return Response.json({ accepted: true, eventId, incidentId, signalType: signal.signalType });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to process alarm signal." }, { status: 500 });
  }
}

async function authenticatePanel(db: Db, request: Request, body: string): Promise<Panel | null> {
  const columns = "id, name, inbound_token AS inboundToken, address, latitude, longitude, auto_create_incident AS autoCreateIncident";
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.startsWith("Bearer ")) {
    const token = authorization.slice(7).trim();
    if (!token) return null;
    const panel = await db.prepare(`SELECT ${columns} FROM cad_alarm_panels WHERE inbound_token = ? AND inbound_token <> '' AND active = 1 LIMIT 1`).bind(token).first<Panel>();
    return panel ?? null;
  }
  const panelId = request.headers.get("x-cad-panel-id")?.trim() ?? "";
  if (!panelId) return null;
  const panel = await db.prepare(`SELECT ${columns} FROM cad_alarm_panels WHERE id = ? AND active = 1 LIMIT 1`).bind(panelId).first<Panel>();
  if (!panel || !panel.inboundToken) return null;
  return (await verifyMachine(request, body, panel.inboundToken)) ? panel : null;
}
