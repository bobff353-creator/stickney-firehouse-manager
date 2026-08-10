import { ensureDatabase } from "../../../../db/bootstrap";
import { resolveViewer } from "../../../cad-auth";
import { rankUnitsByProximity, unitStatuses, type UnitStatus } from "../../../cad-dispatch-service";
import { deliverToAgencies, incidentLocation, insertIncidentNote, loadUnitLocations } from "../../../cad-dispatch-server";

type Db = Awaited<ReturnType<typeof ensureDatabase>>;

const jsonHeaders = { "cache-control": "no-store" } as const;

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    const viewer = await resolveViewer(request, db);
    if (!viewer.email) return Response.json({ error: "Sign-in is required." }, { status: 401 });

    const [units, incidents, notes, agencies, deliveries, panels, alarms] = await Promise.all([
      db.prepare("SELECT id, unit_number AS unitNumber, name, unit_type AS unitType, agency, station, status, status_since AS statusSince, active_incident_id AS activeIncidentId, latitude, longitude, heading, speed, location_at AS locationAt, source FROM cad_units WHERE active = 1 ORDER BY unit_number").all(),
      db.prepare("SELECT incident_id AS incidentId, call_type AS callType, category, address, city, responding_units AS respondingUnits, longitude, latitude, dispatched_at AS dispatchedAt, source_system AS source FROM dispatch_incidents WHERE active = 1 AND cleared_at IS NULL ORDER BY datetime(dispatched_at) DESC LIMIT 25").all(),
      db.prepare("SELECT id, incident_id AS incidentId, sequence, note, category, author, source, agency, unit_number AS unitNumber, event_at AS eventAt FROM cad_incident_notes ORDER BY datetime(event_at) DESC, sequence DESC LIMIT 60").all(),
      db.prepare("SELECT id, name, agency_type AS agencyType, contact, outbound_url AS outboundUrl, subscriptions, active, last_inbound_at AS lastInboundAt, last_outbound_at AS lastOutboundAt, CASE WHEN outbound_secret <> '' THEN 1 ELSE 0 END AS hasSecret FROM cad_agencies ORDER BY name").all(),
      db.prepare("SELECT id, agency_name AS agencyName, event_type AS eventType, incident_id AS incidentId, status, status_code AS statusCode, error, created_at AS createdAt FROM cad_outbound_deliveries ORDER BY datetime(created_at) DESC LIMIT 20").all(),
      db.prepare("SELECT id, name, monitor_account AS monitorAccount, address, protocol, auto_create_incident AS autoCreateIncident, active, last_signal_at AS lastSignalAt FROM cad_alarm_panels ORDER BY name").all(),
      db.prepare("SELECT id, panel_id AS panelId, panel_name AS panelName, signal_type AS signalType, zone, description, priority, incident_id AS incidentId, event_at AS eventAt, acknowledged_at AS acknowledgedAt, acknowledged_by AS acknowledgedBy FROM cad_alarm_events ORDER BY datetime(received_at) DESC LIMIT 30").all(),
    ]);

    return Response.json({
      viewer: { email: viewer.email, isAdmin: viewer.isAdmin, displayName: viewer.displayName },
      generatedAt: new Date().toISOString(),
      unitStatuses,
      units: units.results,
      incidents: incidents.results,
      notes: notes.results,
      agencies: agencies.results,
      deliveries: deliveries.results,
      panels: panels.results,
      alarms: alarms.results,
    }, { headers: jsonHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load the CAD dispatch console." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await ensureDatabase();
    const viewer = await resolveViewer(request, db);
    if (!viewer.email) return Response.json({ error: "Sign-in is required." }, { status: 401 });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const actor = viewer.displayName || viewer.email;

    switch (action) {
      case "recommend":
        return await recommend(db, body);
      case "assign":
        return await assign(db, body, actor);
      case "status":
        return await updateStatus(db, body, actor);
      case "note":
        return await addNote(db, body, actor);
      case "upsertUnit":
        if (!viewer.isAdmin) return Response.json({ error: "Administrator access is required." }, { status: 403 });
        return await upsertUnit(db, body, actor);
      case "removeUnit":
        if (!viewer.isAdmin) return Response.json({ error: "Administrator access is required." }, { status: 403 });
        return await removeUnit(db, body);
      default:
        return Response.json({ error: "Unknown dispatch action." }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to complete the dispatch action." }, { status: 500 });
  }
}

async function targetFor(db: Db, body: Record<string, unknown>): Promise<{ latitude: number; longitude: number; incidentId: string } | null> {
  const incidentId = String(body.incidentId ?? "").trim();
  const lat = Number(body.latitude);
  const lng = Number(body.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat, longitude: lng, incidentId };
  if (incidentId) {
    const location = await incidentLocation(db, incidentId);
    if (location) return { ...location, incidentId };
  }
  return null;
}

async function recommend(db: Db, body: Record<string, unknown>) {
  const target = await targetFor(db, body);
  if (!target) return Response.json({ error: "A mapped incident location (or latitude/longitude) is required to rank units." }, { status: 422 });
  const ranked = rankUnitsByProximity(await loadUnitLocations(db), target);
  return Response.json({ target, recommendations: ranked }, { headers: jsonHeaders });
}

async function assign(db: Db, body: Record<string, unknown>, actor: string) {
  const incidentId = String(body.incidentId ?? "").trim();
  const unitNumber = String(body.unitNumber ?? "").trim();
  if (!incidentId || !unitNumber) return Response.json({ error: "An incident and a unit are required." }, { status: 422 });
  const unit = await db.prepare("SELECT id, unit_number AS unitNumber FROM cad_units WHERE unit_number = ? COLLATE NOCASE AND active = 1 LIMIT 1").bind(unitNumber).first<{ id: string; unitNumber: string }>();
  if (!unit) return Response.json({ error: `Unit ${unitNumber} was not found.` }, { status: 404 });
  await db.prepare("UPDATE cad_units SET status = 'dispatched', status_since = CURRENT_TIMESTAMP, active_incident_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(incidentId, unit.id).run();
  await db.prepare("UPDATE dispatch_incidents SET responding_units = TRIM(CASE WHEN responding_units = '' THEN ? WHEN instr(',' || responding_units || ',', ',' || ? || ',') > 0 THEN responding_units ELSE responding_units || ', ' || ? END) WHERE incident_id = ?").bind(unit.unitNumber, unit.unitNumber, unit.unitNumber, incidentId).run();
  const eventAt = new Date().toISOString();
  const inserted = await insertIncidentNote(db, { incidentId, note: `${unit.unitNumber} dispatched`, category: "dispatch", author: actor, unitNumber: unit.unitNumber, eventAt, externalId: "" }, { source: "local", agency: "" });
  await deliverToAgencies(db, "status", { unitNumber: unit.unitNumber, status: "dispatched", incidentId }, incidentId);
  await deliverToAgencies(db, "note", { incidentId, note: `${unit.unitNumber} dispatched`, category: "dispatch", author: actor, eventAt }, incidentId);
  return Response.json({ ok: true, unitNumber: unit.unitNumber, incidentId, noteSequence: inserted.sequence }, { headers: jsonHeaders });
}

async function updateStatus(db: Db, body: Record<string, unknown>, actor: string) {
  const unitNumber = String(body.unitNumber ?? "").trim();
  const status = String(body.status ?? "").trim() as UnitStatus;
  if (!unitNumber || !unitStatuses.includes(status)) return Response.json({ error: "A unit and a valid status are required." }, { status: 422 });
  const unit = await db.prepare("SELECT id, active_incident_id AS activeIncidentId FROM cad_units WHERE unit_number = ? COLLATE NOCASE AND active = 1 LIMIT 1").bind(unitNumber).first<{ id: string; activeIncidentId: string }>();
  if (!unit) return Response.json({ error: `Unit ${unitNumber} was not found.` }, { status: 404 });
  const clearsIncident = status === "available" || status === "out_of_service";
  const incidentId = clearsIncident ? "" : (String(body.incidentId ?? "").trim() || unit.activeIncidentId);
  await db.prepare("UPDATE cad_units SET status = ?, status_since = CURRENT_TIMESTAMP, active_incident_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(status, incidentId, unit.id).run();
  if (unit.activeIncidentId) {
    const eventAt = new Date().toISOString();
    await insertIncidentNote(db, { incidentId: unit.activeIncidentId, note: `${unitNumber} status → ${status}`, category: "unit_status", author: actor, unitNumber, eventAt, externalId: "" }, { source: "local", agency: "" });
    await deliverToAgencies(db, "note", { incidentId: unit.activeIncidentId, note: `${unitNumber} status → ${status}`, category: "unit_status", author: actor, eventAt }, unit.activeIncidentId);
  }
  await deliverToAgencies(db, "status", { unitNumber, status, incidentId }, incidentId);
  return Response.json({ ok: true, unitNumber, status }, { headers: jsonHeaders });
}

async function addNote(db: Db, body: Record<string, unknown>, actor: string) {
  const incidentId = String(body.incidentId ?? "").trim();
  const note = String(body.note ?? "").trim();
  const category = String(body.category ?? "note").trim();
  if (!incidentId || !note) return Response.json({ error: "An incident and note text are required." }, { status: 422 });
  const eventAt = new Date().toISOString();
  const inserted = await insertIncidentNote(db, { incidentId, note, category, author: actor, unitNumber: "", eventAt, externalId: "" }, { source: "local", agency: "" });
  await deliverToAgencies(db, "note", { incidentId, note, category, author: actor, eventAt }, incidentId);
  return Response.json({ ok: true, id: inserted.id, sequence: inserted.sequence }, { headers: jsonHeaders });
}

async function upsertUnit(db: Db, body: Record<string, unknown>, actor: string) {
  const unitNumber = String(body.unitNumber ?? "").trim();
  if (!unitNumber) return Response.json({ error: "A unit number is required." }, { status: 422 });
  const name = String(body.name ?? unitNumber).trim() || unitNumber;
  const unitType = String(body.unitType ?? "engine").trim() || "engine";
  const station = String(body.station ?? "").trim();
  const agency = String(body.agency ?? "Stickney").trim() || "Stickney";
  const homeLat = Number.isFinite(Number(body.homeLatitude)) ? Number(body.homeLatitude) : null;
  const homeLng = Number.isFinite(Number(body.homeLongitude)) ? Number(body.homeLongitude) : null;
  await db.prepare(
    "INSERT INTO cad_units (id, unit_number, name, unit_type, agency, station, home_latitude, home_longitude, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(unit_number) DO UPDATE SET name = excluded.name, unit_type = excluded.unit_type, agency = excluded.agency, station = excluded.station, home_latitude = excluded.home_latitude, home_longitude = excluded.home_longitude, updated_at = CURRENT_TIMESTAMP",
  ).bind(crypto.randomUUID(), unitNumber, name, unitType, agency, station, homeLat, homeLng, actor).run();
  return Response.json({ ok: true, unitNumber }, { headers: jsonHeaders });
}

async function removeUnit(db: Db, body: Record<string, unknown>) {
  const unitNumber = String(body.unitNumber ?? "").trim();
  if (!unitNumber) return Response.json({ error: "A unit number is required." }, { status: 422 });
  await db.prepare("UPDATE cad_units SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE unit_number = ? COLLATE NOCASE").bind(unitNumber).run();
  return Response.json({ ok: true, unitNumber }, { headers: jsonHeaders });
}
