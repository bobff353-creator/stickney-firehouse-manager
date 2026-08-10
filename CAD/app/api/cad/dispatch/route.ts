import { ensureDatabase } from "../../../../lib/bootstrap";
import { get, query, run } from "../../../../lib/db";
import { getSession } from "../../../../lib/auth";
import { rankUnitsByProximity, unitStatuses, type UnitStatus } from "../../../../lib/cad-service";
import { deliverToAgencies, incidentLocation, insertIncidentNote, loadUnitLocations } from "../../../../lib/cad-server";

const jsonHeaders = { "cache-control": "no-store" } as const;

export async function GET(request: Request) {
  try {
    await ensureDatabase();
    const session = await getSession(request);
    if (!session) return Response.json({ error: "Sign-in is required." }, { status: 401 });

    const [units, incidents, notes, agencies, deliveries, panels, alarms] = await Promise.all([
      query("SELECT id, unit_number AS unitNumber, name, unit_type AS unitType, agency, station, status, status_since AS statusSince, active_incident_id AS activeIncidentId, latitude, longitude, heading, speed, location_at AS locationAt, source FROM cad_units WHERE active = 1 ORDER BY unit_number"),
      query("SELECT incident_id AS incidentId, call_type AS callType, category, address, city, responding_units AS respondingUnits, longitude, latitude, dispatched_at AS dispatchedAt, source_system AS source FROM cad_incidents WHERE active = 1 AND cleared_at IS NULL ORDER BY datetime(dispatched_at) DESC LIMIT 25"),
      query("SELECT id, incident_id AS incidentId, sequence, note, category, author, source, agency, unit_number AS unitNumber, event_at AS eventAt FROM cad_incident_notes ORDER BY datetime(event_at) DESC, sequence DESC LIMIT 60"),
      query("SELECT id, name, agency_type AS agencyType, contact, outbound_url AS outboundUrl, subscriptions, active, last_inbound_at AS lastInboundAt, last_outbound_at AS lastOutboundAt, CASE WHEN outbound_secret <> '' THEN 1 ELSE 0 END AS hasSecret FROM cad_agencies ORDER BY name"),
      query("SELECT id, agency_name AS agencyName, event_type AS eventType, incident_id AS incidentId, status, status_code AS statusCode, error, created_at AS createdAt FROM cad_outbound_deliveries ORDER BY datetime(created_at) DESC LIMIT 20"),
      query("SELECT id, name, monitor_account AS monitorAccount, address, protocol, auto_create_incident AS autoCreateIncident, active, last_signal_at AS lastSignalAt FROM cad_alarm_panels ORDER BY name"),
      query("SELECT id, panel_id AS panelId, panel_name AS panelName, signal_type AS signalType, zone, description, priority, incident_id AS incidentId, event_at AS eventAt, acknowledged_at AS acknowledgedAt, acknowledged_by AS acknowledgedBy FROM cad_alarm_events ORDER BY datetime(received_at) DESC LIMIT 30"),
    ]);

    return Response.json({
      viewer: { email: session.email, isAdmin: session.role === "admin", displayName: session.name },
      generatedAt: new Date().toISOString(),
      unitStatuses,
      units, incidents, notes, agencies, deliveries, panels, alarms,
    }, { headers: jsonHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load the dispatch console." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const session = await getSession(request);
    if (!session) return Response.json({ error: "Sign-in is required." }, { status: 401 });
    const isAdmin = session.role === "admin";
    const actor = session.name || session.email;
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action ?? "");

    switch (action) {
      case "recommend": return await recommend(body);
      case "assign": return await assign(body, actor);
      case "status": return await updateStatus(body, actor);
      case "note": return await addNote(body, actor);
      case "createIncident": return await createIncident(body, actor);
      case "clearIncident": return await clearIncident(body, actor);
      case "upsertUnit":
        if (!isAdmin) return Response.json({ error: "Administrator access is required." }, { status: 403 });
        return await upsertUnit(body, actor);
      case "removeUnit":
        if (!isAdmin) return Response.json({ error: "Administrator access is required." }, { status: 403 });
        return await removeUnit(body);
      default:
        return Response.json({ error: "Unknown dispatch action." }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to complete the dispatch action." }, { status: 500 });
  }
}

async function targetFor(body: Record<string, unknown>): Promise<{ latitude: number; longitude: number; incidentId: string } | null> {
  const incidentId = String(body.incidentId ?? "").trim();
  const lat = Number(body.latitude);
  const lng = Number(body.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat, longitude: lng, incidentId };
  if (incidentId) {
    const location = await incidentLocation(incidentId);
    if (location) return { ...location, incidentId };
  }
  return null;
}

async function recommend(body: Record<string, unknown>) {
  const target = await targetFor(body);
  if (!target) return Response.json({ error: "A mapped incident location (or latitude/longitude) is required to rank units." }, { status: 422 });
  const ranked = rankUnitsByProximity(await loadUnitLocations(), target);
  return Response.json({ target, recommendations: ranked }, { headers: jsonHeaders });
}

async function assign(body: Record<string, unknown>, actor: string) {
  const incidentId = String(body.incidentId ?? "").trim();
  const unitNumber = String(body.unitNumber ?? "").trim();
  if (!incidentId || !unitNumber) return Response.json({ error: "An incident and a unit are required." }, { status: 422 });
  const unit = await get<{ id: string; unitNumber: string }>("SELECT id, unit_number AS unitNumber FROM cad_units WHERE unit_number = ? COLLATE NOCASE AND active = 1 LIMIT 1", [unitNumber]);
  if (!unit) return Response.json({ error: `Unit ${unitNumber} was not found.` }, { status: 404 });
  await run("UPDATE cad_units SET status = 'dispatched', status_since = CURRENT_TIMESTAMP, active_incident_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [incidentId, unit.id]);
  await run("UPDATE cad_incidents SET responding_units = TRIM(CASE WHEN responding_units = '' THEN ? WHEN instr(',' || responding_units || ',', ',' || ? || ',') > 0 THEN responding_units ELSE responding_units || ', ' || ? END) WHERE incident_id = ?", [unit.unitNumber, unit.unitNumber, unit.unitNumber, incidentId]);
  const eventAt = new Date().toISOString();
  const inserted = await insertIncidentNote({ incidentId, note: `${unit.unitNumber} dispatched`, category: "dispatch", author: actor, unitNumber: unit.unitNumber, eventAt, externalId: "" }, { source: "local", agency: "" });
  await deliverToAgencies("status", { unitNumber: unit.unitNumber, status: "dispatched", incidentId }, incidentId);
  await deliverToAgencies("note", { incidentId, note: `${unit.unitNumber} dispatched`, category: "dispatch", author: actor, eventAt }, incidentId);
  return Response.json({ ok: true, unitNumber: unit.unitNumber, incidentId, noteSequence: inserted.sequence }, { headers: jsonHeaders });
}

async function updateStatus(body: Record<string, unknown>, actor: string) {
  const unitNumber = String(body.unitNumber ?? "").trim();
  const status = String(body.status ?? "").trim() as UnitStatus;
  if (!unitNumber || !unitStatuses.includes(status)) return Response.json({ error: "A unit and a valid status are required." }, { status: 422 });
  const unit = await get<{ id: string; activeIncidentId: string }>("SELECT id, active_incident_id AS activeIncidentId FROM cad_units WHERE unit_number = ? COLLATE NOCASE AND active = 1 LIMIT 1", [unitNumber]);
  if (!unit) return Response.json({ error: `Unit ${unitNumber} was not found.` }, { status: 404 });
  const clears = status === "available" || status === "out_of_service";
  const incidentId = clears ? "" : (String(body.incidentId ?? "").trim() || unit.activeIncidentId);
  await run("UPDATE cad_units SET status = ?, status_since = CURRENT_TIMESTAMP, active_incident_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [status, incidentId, unit.id]);
  if (unit.activeIncidentId) {
    const eventAt = new Date().toISOString();
    await insertIncidentNote({ incidentId: unit.activeIncidentId, note: `${unitNumber} status → ${status}`, category: "unit_status", author: actor, unitNumber, eventAt, externalId: "" }, { source: "local", agency: "" });
    await deliverToAgencies("note", { incidentId: unit.activeIncidentId, note: `${unitNumber} status → ${status}`, category: "unit_status", author: actor, eventAt }, unit.activeIncidentId);
  }
  await deliverToAgencies("status", { unitNumber, status, incidentId }, incidentId);
  return Response.json({ ok: true, unitNumber, status }, { headers: jsonHeaders });
}

async function addNote(body: Record<string, unknown>, actor: string) {
  const incidentId = String(body.incidentId ?? "").trim();
  const note = String(body.note ?? "").trim();
  const category = String(body.category ?? "note").trim();
  if (!incidentId || !note) return Response.json({ error: "An incident and note text are required." }, { status: 422 });
  const eventAt = new Date().toISOString();
  const inserted = await insertIncidentNote({ incidentId, note, category, author: actor, unitNumber: "", eventAt, externalId: "" }, { source: "local", agency: "" });
  await deliverToAgencies("note", { incidentId, note, category, author: actor, eventAt }, incidentId);
  return Response.json({ ok: true, id: inserted.id, sequence: inserted.sequence }, { headers: jsonHeaders });
}

async function createIncident(body: Record<string, unknown>, actor: string) {
  const callType = String(body.callType ?? "").trim();
  if (!callType) return Response.json({ error: "A call type is required." }, { status: 422 });
  const incidentId = String(body.incidentId ?? "").trim() || `INC-${Date.now()}`;
  const dispatchedAt = new Date().toISOString();
  const lat = Number.isFinite(Number(body.latitude)) ? Number(body.latitude) : null;
  const lng = Number.isFinite(Number(body.longitude)) ? Number(body.longitude) : null;
  await run(
    "INSERT INTO cad_incidents (incident_id, call_type, category, address, city, narrative, dispatched_at, latitude, longitude, source_system, source_payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(incident_id) DO NOTHING",
    [incidentId, callType, String(body.category ?? ""), String(body.address ?? ""), String(body.city ?? ""), String(body.narrative ?? ""), dispatchedAt, lat, lng, "Console", JSON.stringify(body)],
  );
  await insertIncidentNote({ incidentId, note: `Incident created: ${callType}`, category: "dispatch", author: actor, unitNumber: "", eventAt: dispatchedAt, externalId: "" }, { source: "local", agency: "" });
  await deliverToAgencies("incident", { incidentId, callType, address: String(body.address ?? ""), latitude: lat, longitude: lng, dispatchedAt }, incidentId);
  return Response.json({ ok: true, incidentId }, { headers: jsonHeaders });
}

async function clearIncident(body: Record<string, unknown>, actor: string) {
  const incidentId = String(body.incidentId ?? "").trim();
  if (!incidentId) return Response.json({ error: "An incident id is required." }, { status: 422 });
  await run("UPDATE cad_incidents SET active = 0, cleared_at = CURRENT_TIMESTAMP WHERE incident_id = ?", [incidentId]);
  await run("UPDATE cad_units SET status = 'available', active_incident_id = '', status_since = CURRENT_TIMESTAMP WHERE active_incident_id = ?", [incidentId]);
  const eventAt = new Date().toISOString();
  await insertIncidentNote({ incidentId, note: "Incident cleared", category: "clear", author: actor, unitNumber: "", eventAt, externalId: "" }, { source: "local", agency: "" });
  await deliverToAgencies("note", { incidentId, note: "Incident cleared", category: "clear", author: actor, eventAt }, incidentId);
  return Response.json({ ok: true, incidentId }, { headers: jsonHeaders });
}

async function upsertUnit(body: Record<string, unknown>, actor: string) {
  const unitNumber = String(body.unitNumber ?? "").trim();
  if (!unitNumber) return Response.json({ error: "A unit number is required." }, { status: 422 });
  const name = String(body.name ?? unitNumber).trim() || unitNumber;
  const unitType = String(body.unitType ?? "engine").trim() || "engine";
  const station = String(body.station ?? "").trim();
  const agency = String(body.agency ?? "Local").trim() || "Local";
  const homeLat = Number.isFinite(Number(body.homeLatitude)) ? Number(body.homeLatitude) : null;
  const homeLng = Number.isFinite(Number(body.homeLongitude)) ? Number(body.homeLongitude) : null;
  await run(
    "INSERT INTO cad_units (id, unit_number, name, unit_type, agency, station, home_latitude, home_longitude, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(unit_number) DO UPDATE SET name = excluded.name, unit_type = excluded.unit_type, agency = excluded.agency, station = excluded.station, home_latitude = excluded.home_latitude, home_longitude = excluded.home_longitude, updated_at = CURRENT_TIMESTAMP",
    [crypto.randomUUID(), unitNumber, name, unitType, agency, station, homeLat, homeLng, actor],
  );
  return Response.json({ ok: true, unitNumber }, { headers: jsonHeaders });
}

async function removeUnit(body: Record<string, unknown>) {
  const unitNumber = String(body.unitNumber ?? "").trim();
  if (!unitNumber) return Response.json({ error: "A unit number is required." }, { status: 422 });
  await run("UPDATE cad_units SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE unit_number = ? COLLATE NOCASE", [unitNumber]);
  return Response.json({ ok: true, unitNumber }, { headers: jsonHeaders });
}
