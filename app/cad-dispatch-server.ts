// Server-side CAD dispatch helpers: database access + outbound webhook fan-out.
// These sit between the API routes and the pure logic in cad-dispatch-service.

import type { ensureDatabase } from "../db/bootstrap";
import {
  buildOutboundEnvelope,
  isDeliverableUrl,
  parseSubscriptions,
  signPayload,
  type IncidentNoteInput,
  type OutboundEventType,
  type UnitLocation,
  type UnitStatus,
  type VehicleLocationPing,
} from "./cad-dispatch-service";

type Database = Awaited<ReturnType<typeof ensureDatabase>>;

const OUTBOUND_TIMEOUT_MS = 6000;

type AgencyRow = {
  id: string;
  name: string;
  outboundUrl: string;
  outboundSecret: string;
  subscriptions: string;
};

/**
 * Fan a CAD event out to every active partner agency subscribed to it. Each
 * delivery is signed (HMAC-SHA256 over the JSON body) and recorded in
 * cad_outbound_deliveries. Failures are logged, never thrown — an unreachable
 * peer must not break the local dispatch action that triggered the send.
 */
export async function deliverToAgencies(
  db: Database,
  event: OutboundEventType,
  data: unknown,
  incidentId = "",
): Promise<{ attempted: number; delivered: number }> {
  let attempted = 0;
  let delivered = 0;
  try {
    const agencies = await db
      .prepare("SELECT id, name, outbound_url AS outboundUrl, outbound_secret AS outboundSecret, subscriptions FROM cad_agencies WHERE active = 1 AND outbound_url <> ''")
      .all<AgencyRow>();
    const envelope = buildOutboundEnvelope(event, data);
    const body = JSON.stringify(envelope);
    for (const agency of agencies.results) {
      if (!parseSubscriptions(agency.subscriptions).includes(event)) continue;
      if (!isDeliverableUrl(agency.outboundUrl)) continue;
      attempted += 1;
      const deliveryId = crypto.randomUUID();
      const ok = await postToAgency(agency, body);
      delivered += ok.delivered ? 1 : 0;
      await db
        .prepare("INSERT INTO cad_outbound_deliveries (id, agency_id, agency_name, event_type, incident_id, endpoint, status, status_code, error, payload, delivered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(deliveryId, agency.id, agency.name, event, incidentId, agency.outboundUrl, ok.delivered ? "delivered" : "failed", ok.statusCode, ok.error, body, ok.delivered ? new Date().toISOString() : null)
        .run();
      await db.prepare("UPDATE cad_agencies SET last_outbound_at = CURRENT_TIMESTAMP WHERE id = ?").bind(agency.id).run();
    }
  } catch {
    // Never let outbound distribution surface as a failure of the local action.
  }
  return { attempted, delivered };
}

async function postToAgency(agency: AgencyRow, body: string): Promise<{ delivered: boolean; statusCode: number | null; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OUTBOUND_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "Stickney-CAD/1.0" };
    if (agency.outboundSecret) headers["x-cad-signature"] = `sha256=${await signPayload(agency.outboundSecret, body)}`;
    const response = await fetch(agency.outboundUrl, { method: "POST", headers, body, signal: controller.signal });
    return { delivered: response.ok, statusCode: response.status, error: response.ok ? "" : `HTTP ${response.status}` };
  } catch (error) {
    return { delivered: false, statusCode: null, error: error instanceof Error ? error.message : "Delivery failed" };
  } finally {
    clearTimeout(timer);
  }
}

/** Insert a timestamped incident note, assigning the next per-incident sequence. Idempotent on external_id. */
export async function insertIncidentNote(
  db: Database,
  input: IncidentNoteInput,
  meta: { source: string; agency: string },
): Promise<{ created: boolean; id: string; sequence: number }> {
  if (input.externalId) {
    const existing = await db
      .prepare("SELECT id, sequence FROM cad_incident_notes WHERE incident_id = ? AND external_id = ? LIMIT 1")
      .bind(input.incidentId, input.externalId)
      .first<{ id: string; sequence: number }>();
    if (existing) return { created: false, id: existing.id, sequence: existing.sequence };
  }
  const row = await db
    .prepare("SELECT COALESCE(MAX(sequence), 0) AS maxSequence FROM cad_incident_notes WHERE incident_id = ?")
    .bind(input.incidentId)
    .first<{ maxSequence: number }>();
  const sequence = Number(row?.maxSequence ?? 0) + 1;
  const id = crypto.randomUUID();
  await db
    .prepare("INSERT INTO cad_incident_notes (id, incident_id, sequence, note, category, author, source, agency, unit_number, external_id, event_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, input.incidentId, sequence, input.note, input.category, input.author, meta.source, meta.agency, input.unitNumber, input.externalId, input.eventAt)
    .run();
  return { created: true, id, sequence };
}

/** Upsert a unit's current position from an AVL ping and append to its location history. */
export async function applyUnitLocation(
  db: Database,
  ping: VehicleLocationPing,
  source: string,
): Promise<{ unitId: string; created: boolean }> {
  let unit = await db
    .prepare("SELECT id FROM cad_units WHERE unit_number = ? COLLATE NOCASE LIMIT 1")
    .bind(ping.unitNumber)
    .first<{ id: string }>();
  let created = false;
  if (!unit) {
    const id = crypto.randomUUID();
    await db
      .prepare("INSERT INTO cad_units (id, unit_number, name, source, created_by) VALUES (?, ?, ?, ?, ?)")
      .bind(id, ping.unitNumber, ping.unitNumber, source, source)
      .run();
    unit = { id };
    created = true;
  }
  const statusClause = ping.status ? ", status = ?, status_since = CASE WHEN status <> ? THEN CURRENT_TIMESTAMP ELSE status_since END" : "";
  const args: (string | number | null)[] = [ping.latitude, ping.longitude, ping.heading, ping.speed, ping.recordedAt, source];
  if (ping.status) args.push(ping.status, ping.status);
  args.push(unit.id);
  await db
    .prepare(`UPDATE cad_units SET latitude = ?, longitude = ?, heading = ?, speed = ?, location_at = ?, source = ?${statusClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(...args)
    .run();
  await db
    .prepare("INSERT INTO cad_unit_location_history (id, unit_id, unit_number, latitude, longitude, heading, speed, recorded_at, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), unit.id, ping.unitNumber, ping.latitude, ping.longitude, ping.heading, ping.speed, ping.recordedAt, source)
    .run();
  return { unitId: unit.id, created };
}

/** Load active units in the shape the closest-unit ranker expects. */
export async function loadUnitLocations(db: Database): Promise<UnitLocation[]> {
  const rows = await db
    .prepare("SELECT id AS unitId, unit_number AS unitNumber, name, unit_type AS unitType, agency, status, latitude, longitude, COALESCE(location_at, '') AS locationAt, active_incident_id AS activeIncidentId FROM cad_units WHERE active = 1 ORDER BY unit_number")
    .all<{
      unitId: string;
      unitNumber: string;
      name: string;
      unitType: string;
      agency: string;
      status: string;
      latitude: number | null;
      longitude: number | null;
      locationAt: string;
      activeIncidentId: string;
    }>();
  return rows.results.map((row) => ({
    unitId: row.unitId,
    unitNumber: row.unitNumber,
    name: row.name,
    unitType: row.unitType,
    agency: row.agency,
    status: row.status as UnitStatus,
    latitude: row.latitude,
    longitude: row.longitude,
    locationAt: row.locationAt,
    activeIncidentId: row.activeIncidentId,
  }));
}

/** Look up an active incident's coordinates from the dispatch_incidents table. */
export async function incidentLocation(db: Database, incidentId: string): Promise<{ latitude: number; longitude: number; address: string } | null> {
  const row = await db
    .prepare("SELECT latitude, longitude, address FROM dispatch_incidents WHERE incident_id = ? LIMIT 1")
    .bind(incidentId)
    .first<{ latitude: number | null; longitude: number | null; address: string }>();
  if (!row || typeof row.latitude !== "number" || typeof row.longitude !== "number") return null;
  return { latitude: row.latitude, longitude: row.longitude, address: row.address ?? "" };
}
