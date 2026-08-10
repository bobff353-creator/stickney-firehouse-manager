// Server-side CAD helpers: database access + outbound webhook fan-out.

import { batch, get, query, run } from "./db";
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
} from "./cad-service";

const OUTBOUND_TIMEOUT_MS = 6000;

export function sourceName(): string {
  return process.env.CAD_SOURCE_NAME?.trim() || "CAD Dispatch";
}

type AgencyRow = { id: string; name: string; outboundUrl: string; outboundSecret: string; subscriptions: string };

/** Fan a CAD event out to every active partner agency subscribed to it. Failures are logged, never thrown. */
export async function deliverToAgencies(event: OutboundEventType, data: unknown, incidentId = ""): Promise<{ attempted: number; delivered: number }> {
  let attempted = 0;
  let delivered = 0;
  try {
    const agencies = await query<AgencyRow>("SELECT id, name, outbound_url AS outboundUrl, outbound_secret AS outboundSecret, subscriptions FROM cad_agencies WHERE active = 1 AND outbound_url <> ''");
    const body = JSON.stringify(buildOutboundEnvelope(event, data, sourceName()));
    for (const agency of agencies) {
      if (!parseSubscriptions(agency.subscriptions).includes(event)) continue;
      if (!isDeliverableUrl(agency.outboundUrl)) continue;
      attempted += 1;
      const result = await postToAgency(agency, body);
      delivered += result.delivered ? 1 : 0;
      await run(
        "INSERT INTO cad_outbound_deliveries (id, agency_id, agency_name, event_type, incident_id, endpoint, status, status_code, error, payload, delivered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [crypto.randomUUID(), agency.id, agency.name, event, incidentId, agency.outboundUrl, result.delivered ? "delivered" : "failed", result.statusCode, result.error, body, result.delivered ? new Date().toISOString() : null],
      );
      await run("UPDATE cad_agencies SET last_outbound_at = CURRENT_TIMESTAMP WHERE id = ?", [agency.id]);
    }
  } catch {
    // Outbound distribution never breaks the local action that triggered it.
  }
  return { attempted, delivered };
}

async function postToAgency(agency: AgencyRow, body: string): Promise<{ delivered: boolean; statusCode: number | null; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OUTBOUND_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "CAD-Dispatch/1.0" };
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
export async function insertIncidentNote(input: IncidentNoteInput, meta: { source: string; agency: string }): Promise<{ created: boolean; id: string; sequence: number }> {
  if (input.externalId) {
    const existing = await get<{ id: string; sequence: number }>("SELECT id, sequence FROM cad_incident_notes WHERE incident_id = ? AND external_id = ? LIMIT 1", [input.incidentId, input.externalId]);
    if (existing) return { created: false, id: existing.id, sequence: existing.sequence };
  }
  const row = await get<{ maxSequence: number }>("SELECT COALESCE(MAX(sequence), 0) AS maxSequence FROM cad_incident_notes WHERE incident_id = ?", [input.incidentId]);
  const sequence = Number(row?.maxSequence ?? 0) + 1;
  const id = crypto.randomUUID();
  await run(
    "INSERT INTO cad_incident_notes (id, incident_id, sequence, note, category, author, source, agency, unit_number, external_id, event_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id, input.incidentId, sequence, input.note, input.category, input.author, meta.source, meta.agency, input.unitNumber, input.externalId, input.eventAt],
  );
  return { created: true, id, sequence };
}

/** Upsert a unit's current position from an AVL ping and append to its location history. */
export async function applyUnitLocation(ping: VehicleLocationPing, source: string): Promise<{ unitId: string; created: boolean }> {
  let unit = await get<{ id: string }>("SELECT id FROM cad_units WHERE unit_number = ? COLLATE NOCASE LIMIT 1", [ping.unitNumber]);
  let created = false;
  if (!unit) {
    const id = crypto.randomUUID();
    await run("INSERT INTO cad_units (id, unit_number, name, source, created_by) VALUES (?, ?, ?, ?, ?)", [id, ping.unitNumber, ping.unitNumber, source, source]);
    unit = { id };
    created = true;
  }
  const statusClause = ping.status ? ", status = ?, status_since = CASE WHEN status <> ? THEN CURRENT_TIMESTAMP ELSE status_since END" : "";
  const args: (string | number | null)[] = [ping.latitude, ping.longitude, ping.heading, ping.speed, ping.recordedAt, source];
  if (ping.status) args.push(ping.status, ping.status);
  args.push(unit.id);
  await run(`UPDATE cad_units SET latitude = ?, longitude = ?, heading = ?, speed = ?, location_at = ?, source = ?${statusClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, args);
  await run(
    "INSERT INTO cad_unit_location_history (id, unit_id, unit_number, latitude, longitude, heading, speed, recorded_at, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [crypto.randomUUID(), unit.id, ping.unitNumber, ping.latitude, ping.longitude, ping.heading, ping.speed, ping.recordedAt, source],
  );
  return { unitId: unit.id, created };
}

/** Load active units in the shape the closest-unit ranker expects. */
export async function loadUnitLocations(): Promise<UnitLocation[]> {
  const rows = await query<{
    unitId: string; unitNumber: string; name: string; unitType: string; agency: string; status: string;
    latitude: number | null; longitude: number | null; locationAt: string; activeIncidentId: string;
  }>("SELECT id AS unitId, unit_number AS unitNumber, name, unit_type AS unitType, agency, status, latitude, longitude, COALESCE(location_at, '') AS locationAt, active_incident_id AS activeIncidentId FROM cad_units WHERE active = 1 ORDER BY unit_number");
  return rows.map((row) => ({ ...row, status: row.status as UnitStatus }));
}

/** Look up an active incident's coordinates. */
export async function incidentLocation(incidentId: string): Promise<{ latitude: number; longitude: number; address: string } | null> {
  const row = await get<{ latitude: number | null; longitude: number | null; address: string }>("SELECT latitude, longitude, address FROM cad_incidents WHERE incident_id = ? LIMIT 1", [incidentId]);
  if (!row || typeof row.latitude !== "number" || typeof row.longitude !== "number") return null;
  return { latitude: row.latitude, longitude: row.longitude, address: row.address ?? "" };
}

export { batch };
