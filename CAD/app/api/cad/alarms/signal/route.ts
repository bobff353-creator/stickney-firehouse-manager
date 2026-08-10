import { ensureDatabase } from "../../../../../lib/bootstrap";
import { get, run } from "../../../../../lib/db";
import { normalizeAlarmSignal, verifyInboundSignature } from "../../../../../lib/cad-service";
import { deliverToAgencies, insertIncidentNote } from "../../../../../lib/cad-server";

type Panel = { id: string; name: string; inboundToken: string; address: string; latitude: number | null; longitude: number | null; autoCreateIncident: number };

const MAX_BODY = 131_072;

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") || "0") > MAX_BODY) return Response.json({ error: "Payload too large." }, { status: 413 });
    const body = await request.text();
    if (!body || body.length > MAX_BODY) return Response.json({ error: "Payload must be between 1 byte and 128 KB." }, { status: 413 });

    await ensureDatabase();
    const panel = await authenticatePanel(request, body);
    if (!panel) return Response.json({ error: "Invalid alarm panel authentication." }, { status: 401 });

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return Response.json({ error: "Body must be JSON." }, { status: 400 });
    }
    const result = normalizeAlarmSignal(parsed && typeof parsed === "object" && "data" in (parsed as Record<string, unknown>) ? (parsed as Record<string, unknown>).data : parsed);
    if (!result.ok) return Response.json({ error: result.error }, { status: 422 });
    const signal = result.signal;

    if (signal.externalEventId) {
      const prior = await get<{ id: string; incidentId: string }>("SELECT id, incident_id AS incidentId FROM cad_alarm_events WHERE panel_id = ? AND external_event_id = ? LIMIT 1", [panel.id, signal.externalEventId]);
      if (prior) return Response.json({ accepted: true, duplicate: true, eventId: prior.id, incidentId: prior.incidentId });
    }

    const latitude = signal.latitude ?? panel.latitude;
    const longitude = signal.longitude ?? panel.longitude;
    const address = signal.address || panel.address;
    let incidentId = "";

    if (signal.signalType === "alarm" && panel.autoCreateIncident) {
      incidentId = `ALARM-${panel.id.slice(0, 8)}-${Date.now()}`;
      const callType = `Fire Alarm — ${panel.name}`;
      const narrative = `${signal.description}${signal.zone ? ` (zone ${signal.zone})` : ""}`;
      await run(
        "INSERT INTO cad_incidents (incident_id, call_type, category, address, narrative, longitude, latitude, dispatched_at, source_system, source_payload, active) VALUES (?, ?, 'Fire', ?, ?, ?, ?, ?, ?, ?, 1)",
        [incidentId, callType, address, narrative, longitude, latitude, signal.eventAt, `${panel.name} (Alarm)`, JSON.stringify(signal)],
      );
      await insertIncidentNote({ incidentId, note: narrative, category: "dispatch", author: panel.name, unitNumber: "", eventAt: signal.eventAt, externalId: signal.externalEventId }, { source: "alarm", agency: panel.name });
    }

    const eventId = crypto.randomUUID();
    await run(
      "INSERT INTO cad_alarm_events (id, panel_id, panel_name, external_event_id, signal_type, zone, description, priority, latitude, longitude, incident_id, event_at, raw_payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [eventId, panel.id, panel.name, signal.externalEventId, signal.signalType, signal.zone, signal.description, signal.priority, latitude, longitude, incidentId, signal.eventAt, body],
    );
    await run("UPDATE cad_alarm_panels SET last_signal_at = CURRENT_TIMESTAMP WHERE id = ?", [panel.id]);

    await deliverToAgencies("alarm", { panel: panel.name, signalType: signal.signalType, zone: signal.zone, description: signal.description, priority: signal.priority, address, incidentId, eventAt: signal.eventAt }, incidentId);

    return Response.json({ accepted: true, eventId, incidentId, signalType: signal.signalType });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to process alarm signal." }, { status: 500 });
  }
}

async function authenticatePanel(request: Request, body: string): Promise<Panel | null> {
  const columns = "id, name, inbound_token AS inboundToken, address, latitude, longitude, auto_create_incident AS autoCreateIncident";
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.startsWith("Bearer ")) {
    const token = authorization.slice(7).trim();
    if (!token) return null;
    return await get<Panel>(`SELECT ${columns} FROM cad_alarm_panels WHERE inbound_token = ? AND inbound_token <> '' AND active = 1 LIMIT 1`, [token]);
  }
  const panelId = request.headers.get("x-cad-panel-id")?.trim() ?? "";
  if (!panelId) return null;
  const panel = await get<Panel>(`SELECT ${columns} FROM cad_alarm_panels WHERE id = ? AND active = 1 LIMIT 1`, [panelId]);
  if (!panel || !panel.inboundToken) return null;
  const verified = await verifyInboundSignature({ authorization, signature: request.headers.get("x-cad-signature") ?? "" }, body, panel.inboundToken);
  return verified ? panel : null;
}
