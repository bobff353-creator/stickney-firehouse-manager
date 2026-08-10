import { ensureDatabase } from "../../../../db/bootstrap";
import { resolveViewer, verifyMachine } from "../../../cad-auth";
import { normalizeIncidentNote, normalizeUnitStatus, normalizeVehicleLocation } from "../../../cad-dispatch-service";
import { applyUnitLocation, insertIncidentNote } from "../../../cad-dispatch-server";
import { projectDispatchIntoDailyLog } from "../../../dispatch-daily-log";

type Db = Awaited<ReturnType<typeof ensureDatabase>>;

type Agency = { id: string; name: string; inboundToken: string };

const MAX_BODY = 262_144;

// GET returns the inbound contract for administrators wiring up a peer.
export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    const viewer = await resolveViewer(request, db);
    if (!viewer.isAdmin) return Response.json({ error: "Administrator access is required." }, { status: 403 });
    return Response.json({
      inboundUrl: new URL("/api/cad/webhooks", request.url).toString(),
      authentication: "Authorization: Bearer <agency inbound token>, or x-cad-agency-id + x-cad-signature: sha256=<HMAC-SHA256 of body>",
      envelope: { event: "location | note | status | incident", data: "event payload" },
      events: {
        location: "{ unitNumber, latitude, longitude, heading?, speed?, status? }",
        note: "{ incidentId, note, category?, author?, eventAt?, externalId? }",
        status: "{ unitNumber, status }",
        incident: "{ incidentId, callType, address?, city?, dispatchedAt?, respondingUnits?, latitude?, longitude?, narrative? }",
      },
      maxBodyBytes: MAX_BODY,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load webhook info." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") || "0") > MAX_BODY) return Response.json({ error: "Payload is larger than 256 KB." }, { status: 413 });
    const body = await request.text();
    if (!body || body.length > MAX_BODY) return Response.json({ error: "Payload must be between 1 byte and 256 KB." }, { status: 413 });

    const db = await ensureDatabase();
    const agency = await authenticateAgency(db, request, body);
    if (!agency) return Response.json({ error: "Invalid CAD agency authentication." }, { status: 401 });

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return Response.json({ error: "Body must be JSON." }, { status: 400 });
    }
    const record = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
    const event = String(record.event ?? record.type ?? "").toLowerCase();
    const data = (record.data && typeof record.data === "object" ? record.data : record) as Record<string, unknown>;

    await db.prepare("UPDATE cad_agencies SET last_inbound_at = CURRENT_TIMESTAMP WHERE id = ?").bind(agency.id).run();

    switch (event) {
      case "location":
        return await handleLocation(db, agency, data);
      case "note":
        return await handleNote(db, agency, data);
      case "status":
        return await handleStatus(db, data);
      case "incident":
        return await handleIncident(db, agency, data);
      default:
        return Response.json({ error: `Unsupported event '${event}'.` }, { status: 422 });
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to process webhook." }, { status: 500 });
  }
}

async function authenticateAgency(db: Db, request: Request, body: string): Promise<Agency | null> {
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.startsWith("Bearer ")) {
    const token = authorization.slice(7).trim();
    if (!token) return null;
    const agency = await db.prepare("SELECT id, name, inbound_token AS inboundToken FROM cad_agencies WHERE inbound_token = ? AND inbound_token <> '' AND active = 1 LIMIT 1").bind(token).first<Agency>();
    return agency ?? null;
  }
  const agencyId = request.headers.get("x-cad-agency-id")?.trim() ?? "";
  if (!agencyId) return null;
  const agency = await db.prepare("SELECT id, name, inbound_token AS inboundToken FROM cad_agencies WHERE id = ? AND active = 1 LIMIT 1").bind(agencyId).first<Agency>();
  if (!agency || !agency.inboundToken) return null;
  return (await verifyMachine(request, body, agency.inboundToken)) ? agency : null;
}

async function handleLocation(db: Db, agency: Agency, data: Record<string, unknown>) {
  const result = normalizeVehicleLocation(data);
  if (!result.ok) return Response.json({ error: result.error }, { status: 422 });
  const applied = await applyUnitLocation(db, result.ping, agency.name);
  return Response.json({ accepted: true, event: "location", unitNumber: result.ping.unitNumber, created: applied.created });
}

async function handleNote(db: Db, agency: Agency, data: Record<string, unknown>) {
  const result = normalizeIncidentNote(data);
  if (!result.ok) return Response.json({ error: result.error }, { status: 422 });
  const inserted = await insertIncidentNote(db, result.note, { source: "agency", agency: agency.name });
  return Response.json({ accepted: true, event: "note", incidentId: result.note.incidentId, sequence: inserted.sequence, duplicate: !inserted.created });
}

async function handleStatus(db: Db, data: Record<string, unknown>) {
  const unitNumber = String(data.unitNumber ?? data.unit ?? "").trim();
  const status = normalizeUnitStatus(String(data.status ?? ""));
  if (!unitNumber || !status) return Response.json({ error: "A unit and a valid status are required." }, { status: 422 });
  const result = await db.prepare("UPDATE cad_units SET status = ?, status_since = CURRENT_TIMESTAMP, active_incident_id = CASE WHEN ? IN ('available','out_of_service') THEN '' ELSE active_incident_id END, updated_at = CURRENT_TIMESTAMP WHERE unit_number = ? COLLATE NOCASE AND active = 1").bind(status, status, unitNumber).run();
  if (!result.meta.changes) return Response.json({ error: `Unit ${unitNumber} was not found.` }, { status: 404 });
  return Response.json({ accepted: true, event: "status", unitNumber, status });
}

async function handleIncident(db: Db, agency: Agency, data: Record<string, unknown>) {
  const text = (keys: string[]) => {
    for (const candidate of keys) {
      const value = data[candidate];
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number") return String(value);
    }
    return "";
  };
  const num = (keys: string[]) => {
    for (const candidate of keys) {
      const value = Number(data[candidate]);
      if (Number.isFinite(value)) return value;
    }
    return null;
  };
  const incidentId = text(["incidentId", "incident", "incidentNumber", "callNumber", "cadNumber", "reportNumber"]);
  const callType = text(["callType", "nature", "problem", "incidentType"]) || "CAD incident";
  if (!incidentId) return Response.json({ error: "An incident identifier is required." }, { status: 422 });
  const dispatchedRaw = text(["dispatchedAt", "dispatchTime", "createdAt", "receivedAt"]);
  const dispatchedAt = dispatchedRaw && !Number.isNaN(new Date(dispatchedRaw).getTime()) ? new Date(dispatchedRaw).toISOString() : new Date().toISOString();
  const address = text(["address", "location", "streetAddress"]);
  const city = text(["city", "municipality"]);
  const narrative = text(["narrative", "comments", "notes", "remarks"]);
  const respondingUnits = text(["respondingUnits", "units", "assignedUnits"]);
  const timeOut = text(["timeOut", "enrouteTime"]);
  await db.prepare(
    "INSERT INTO dispatch_incidents (incident_id, resend_email_id, call_type, category, address, city, narrative, responding_units, longitude, latitude, dispatched_at, time_out, attachment_count, source_payload, source_system, received_at, cleared_at, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, CURRENT_TIMESTAMP, NULL, 1) ON CONFLICT(incident_id) DO UPDATE SET call_type=excluded.call_type, address=excluded.address, city=excluded.city, narrative=excluded.narrative, responding_units=excluded.responding_units, longitude=excluded.longitude, latitude=excluded.latitude, dispatched_at=excluded.dispatched_at, time_out=excluded.time_out, source_payload=excluded.source_payload, source_system=excluded.source_system, received_at=CURRENT_TIMESTAMP, active=1",
  ).bind(incidentId, `agency-${agency.id}-${incidentId}`, callType, text(["category"]), address, city, narrative, respondingUnits, num(["longitude", "lng", "lon"]), num(["latitude", "lat"]), dispatchedAt, timeOut, JSON.stringify(data), `${agency.name} (CAD)`).run();
  await projectDispatchIntoDailyLog(db, { reportNumber: incidentId, dispatchedAt, timeOut, respondingUnits, address, callType });
  return Response.json({ accepted: true, event: "incident", incidentId });
}
