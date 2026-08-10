import { ensureDatabase } from "../../../../lib/bootstrap";
import { get, run } from "../../../../lib/db";
import { getSession } from "../../../../lib/auth";
import { normalizeIncidentNote, normalizeUnitStatus, normalizeVehicleLocation, verifyInboundSignature } from "../../../../lib/cad-service";
import { applyUnitLocation, insertIncidentNote } from "../../../../lib/cad-server";

type Agency = { id: string; name: string; inboundToken: string };

const MAX_BODY = 262_144;

export async function GET(request: Request) {
  await ensureDatabase();
  const session = await getSession(request);
  if (!session || session.role !== "admin") return Response.json({ error: "Administrator access is required." }, { status: 403 });
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
}

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") || "0") > MAX_BODY) return Response.json({ error: "Payload is larger than 256 KB." }, { status: 413 });
    const body = await request.text();
    if (!body || body.length > MAX_BODY) return Response.json({ error: "Payload must be between 1 byte and 256 KB." }, { status: 413 });

    await ensureDatabase();
    const agency = await authenticateAgency(request, body);
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

    await run("UPDATE cad_agencies SET last_inbound_at = CURRENT_TIMESTAMP WHERE id = ?", [agency.id]);

    switch (event) {
      case "location": return await handleLocation(agency, data);
      case "note": return await handleNote(agency, data);
      case "status": return await handleStatus(data);
      case "incident": return await handleIncident(agency, data);
      default: return Response.json({ error: `Unsupported event '${event}'.` }, { status: 422 });
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to process webhook." }, { status: 500 });
  }
}

async function authenticateAgency(request: Request, body: string): Promise<Agency | null> {
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.startsWith("Bearer ")) {
    const token = authorization.slice(7).trim();
    if (!token) return null;
    return await get<Agency>("SELECT id, name, inbound_token AS inboundToken FROM cad_agencies WHERE inbound_token = ? AND inbound_token <> '' AND active = 1 LIMIT 1", [token]);
  }
  const agencyId = request.headers.get("x-cad-agency-id")?.trim() ?? "";
  if (!agencyId) return null;
  const agency = await get<Agency>("SELECT id, name, inbound_token AS inboundToken FROM cad_agencies WHERE id = ? AND active = 1 LIMIT 1", [agencyId]);
  if (!agency || !agency.inboundToken) return null;
  const verified = await verifyInboundSignature({ authorization, signature: request.headers.get("x-cad-signature") ?? "" }, body, agency.inboundToken);
  return verified ? agency : null;
}

async function handleLocation(agency: Agency, data: Record<string, unknown>) {
  const result = normalizeVehicleLocation(data);
  if (!result.ok) return Response.json({ error: result.error }, { status: 422 });
  const applied = await applyUnitLocation(result.ping, agency.name);
  return Response.json({ accepted: true, event: "location", unitNumber: result.ping.unitNumber, created: applied.created });
}

async function handleNote(agency: Agency, data: Record<string, unknown>) {
  const result = normalizeIncidentNote(data);
  if (!result.ok) return Response.json({ error: result.error }, { status: 422 });
  const inserted = await insertIncidentNote(result.note, { source: "agency", agency: agency.name });
  return Response.json({ accepted: true, event: "note", incidentId: result.note.incidentId, sequence: inserted.sequence, duplicate: !inserted.created });
}

async function handleStatus(data: Record<string, unknown>) {
  const unitNumber = String(data.unitNumber ?? data.unit ?? "").trim();
  const status = normalizeUnitStatus(String(data.status ?? ""));
  if (!unitNumber || !status) return Response.json({ error: "A unit and a valid status are required." }, { status: 422 });
  const result = await run("UPDATE cad_units SET status = ?, status_since = CURRENT_TIMESTAMP, active_incident_id = CASE WHEN ? IN ('available','out_of_service') THEN '' ELSE active_incident_id END, updated_at = CURRENT_TIMESTAMP WHERE unit_number = ? COLLATE NOCASE AND active = 1", [status, status, unitNumber]);
  if (!result.changes) return Response.json({ error: `Unit ${unitNumber} was not found.` }, { status: 404 });
  return Response.json({ accepted: true, event: "status", unitNumber, status });
}

async function handleIncident(agency: Agency, data: Record<string, unknown>) {
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
  await run(
    "INSERT INTO cad_incidents (incident_id, call_type, category, address, city, narrative, responding_units, longitude, latitude, dispatched_at, time_out, source_system, source_payload, received_at, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 1) ON CONFLICT(incident_id) DO UPDATE SET call_type=excluded.call_type, address=excluded.address, city=excluded.city, narrative=excluded.narrative, responding_units=excluded.responding_units, longitude=excluded.longitude, latitude=excluded.latitude, dispatched_at=excluded.dispatched_at, source_payload=excluded.source_payload, source_system=excluded.source_system, received_at=CURRENT_TIMESTAMP, active=1",
    [incidentId, callType, text(["category"]), text(["address", "location", "streetAddress"]), text(["city", "municipality"]), text(["narrative", "comments", "notes", "remarks"]), text(["respondingUnits", "units", "assignedUnits"]), num(["longitude", "lng", "lon"]), num(["latitude", "lat"]), dispatchedAt, text(["timeOut", "enrouteTime"]), `${agency.name} (CAD)`, JSON.stringify(data)],
  );
  return Response.json({ accepted: true, event: "incident", incidentId });
}
