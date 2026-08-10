// CAD Dispatching Service
//
// Real-time interoperability core for the dispatch console. This module holds
// the provider-agnostic logic used by the CAD API routes:
//
//   • Closest-unit dispatching — Haversine distance + availability ranking so a
//     dispatcher (or an automated rule) can send the nearest in-service unit.
//   • Bidirectional webhooks — HMAC-SHA256 signing for outbound deliveries to
//     other CAD agencies / FD vehicle clients, and a matching verifier for
//     inbound webhooks. Both accept a bearer token as a simpler alternative.
//   • Inbound normalizers — tolerant parsers that map the varied payloads sent
//     by FD vehicle AVL clients, partner CAD systems, and fire-alarm panels
//     into the shapes the routes persist.
//
// Everything here is a pure function or a self-contained helper so it can be
// unit tested without a database or network.

export type UnitStatus =
  | "available" // in service, ready to dispatch
  | "dispatched"
  | "enroute"
  | "onscene"
  | "transporting"
  | "returning"
  | "out_of_service";

export const unitStatuses: UnitStatus[] = [
  "available",
  "dispatched",
  "enroute",
  "onscene",
  "transporting",
  "returning",
  "out_of_service",
];

// A unit is eligible for closest-unit dispatching only when it is in service and
// not already committed to another incident.
const dispatchableStatuses = new Set<UnitStatus>(["available", "returning"]);

// Map any spacing/casing/aliases a vehicle or CAD client might send ("En Route",
// "en-route", "AVAILABLE", "10-8") onto our canonical status values.
const statusAliases: Record<string, UnitStatus> = {
  inservice: "available", clear: "available", cleared: "available", ready: "available", "108": "available",
  disp: "dispatched", dispatch: "dispatched", assigned: "dispatched", "108d": "dispatched",
  enroute: "enroute", responding: "enroute", "106": "enroute",
  onscene: "onscene", arrived: "onscene", onsite: "onscene", "107": "onscene",
  transport: "transporting", transporting: "transporting",
  returning: "returning", clearing: "returning",
  outofservice: "out_of_service", oos: "out_of_service", unavailable: "out_of_service",
};

/** Canonicalize a free-form unit status to a UnitStatus, or "" if unrecognized. */
export function normalizeUnitStatus(value: string): UnitStatus | "" {
  const raw = value.trim().toLowerCase();
  if (!raw) return "";
  const compact = raw.replace(/[^a-z0-9]/g, "");
  if ((unitStatuses as string[]).includes(compact)) return compact as UnitStatus;
  return statusAliases[compact] ?? "";
}

export type UnitLocation = {
  unitId: string;
  unitNumber: string;
  name: string;
  unitType: string;
  agency: string;
  status: UnitStatus;
  latitude: number | null;
  longitude: number | null;
  locationAt: string;
  activeIncidentId: string;
};

export type ProximityResult = UnitLocation & {
  distanceMeters: number | null;
  distanceMiles: number | null;
  dispatchable: boolean;
};

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two lat/lng points, in meters. */
export function haversineMeters(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
): number {
  const deltaLat = toRadians(latitude2 - latitude1);
  const deltaLng = toRadians(longitude2 - longitude1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(latitude1)) * Math.cos(toRadians(latitude2)) * Math.sin(deltaLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function metersToMiles(meters: number): number {
  return meters / 1609.344;
}

/**
 * Rank units by proximity to an incident location. Dispatchable units always
 * sort ahead of committed/out-of-service ones; within each group the nearest
 * unit with a known location wins. Units with no location fall to the bottom.
 */
export function rankUnitsByProximity(
  units: UnitLocation[],
  target: { latitude: number; longitude: number },
): ProximityResult[] {
  const ranked = units.map((unit): ProximityResult => {
    const hasLocation = typeof unit.latitude === "number" && typeof unit.longitude === "number";
    const distanceMeters = hasLocation
      ? haversineMeters(unit.latitude as number, unit.longitude as number, target.latitude, target.longitude)
      : null;
    return {
      ...unit,
      distanceMeters,
      distanceMiles: distanceMeters === null ? null : metersToMiles(distanceMeters),
      dispatchable: dispatchableStatuses.has(unit.status) && !unit.activeIncidentId,
    };
  });

  return ranked.sort((left, right) => {
    if (left.dispatchable !== right.dispatchable) return left.dispatchable ? -1 : 1;
    if (left.distanceMeters === null && right.distanceMeters === null) return 0;
    if (left.distanceMeters === null) return 1;
    if (right.distanceMeters === null) return -1;
    return left.distanceMeters - right.distanceMeters;
  });
}

// ---------------------------------------------------------------------------
// Webhook signing / verification
// ---------------------------------------------------------------------------

export function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index++) mismatch |= left[index] ^ right[index];
  return mismatch === 0;
}

function hexEncode(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexDecode(value: string): Uint8Array {
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16));
}

/** HMAC-SHA256 of `body` under `secret`, hex-encoded. Used to sign outbound webhooks. */
export async function signPayload(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return hexEncode(signature);
}

/** SHA-256 hex digest, used as a stable dedupe fingerprint for inbound messages. */
export async function sha256Hex(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return hexEncode(bytes);
}

/**
 * Verify an inbound webhook. Accepts either a bearer token (Authorization:
 * Bearer <token>) or an HMAC signature (x-cad-signature: sha256=<hex>) computed
 * over the raw body. Returns false when the shared secret is empty.
 */
export async function verifyInboundSignature(
  headers: { authorization: string; signature: string },
  body: string,
  secret: string,
): Promise<boolean> {
  if (!secret) return false;
  const authorization = headers.authorization ?? "";
  if (authorization.startsWith("Bearer ")) {
    return constantTimeEqual(
      new TextEncoder().encode(authorization.slice(7)),
      new TextEncoder().encode(secret),
    );
  }
  const provided = (headers.signature ?? "").replace(/^sha256=/i, "").trim();
  if (!/^[a-f0-9]{64}$/i.test(provided)) return false;
  const expected = await signPayload(secret, body);
  return constantTimeEqual(hexDecode(provided.toLowerCase()), hexDecode(expected));
}

// ---------------------------------------------------------------------------
// Inbound normalizers
// ---------------------------------------------------------------------------

function firstString(record: Record<string, unknown>, keys: string[]): string {
  for (const candidate of keys) {
    const value = record[candidate];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function firstNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const candidate of keys) {
    const value = record[candidate];
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function isoOrNow(value: string): string {
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

export function isValidLatLng(latitude: number | null, longitude: number | null): boolean {
  return (
    latitude !== null &&
    longitude !== null &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180 &&
    !(latitude === 0 && longitude === 0)
  );
}

export type VehicleLocationPing = {
  unitNumber: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  status: UnitStatus | "";
  recordedAt: string;
};

/** Normalize an AVL location ping from an FD vehicle or partner CAD feed. */
export function normalizeVehicleLocation(raw: unknown): { ok: true; ping: VehicleLocationPing } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Location payload must be an object." };
  const record = raw as Record<string, unknown>;
  const unitNumber = firstString(record, ["unitNumber", "unit", "unitId", "unit_id", "apparatus", "callSign", "radioId"]);
  if (!unitNumber) return { ok: false, error: "A unit identifier is required." };
  const latitude = firstNumber(record, ["latitude", "lat", "y"]);
  const longitude = firstNumber(record, ["longitude", "lng", "lon", "long", "x"]);
  if (!isValidLatLng(latitude, longitude)) return { ok: false, error: "Valid latitude and longitude are required." };
  const status = normalizeUnitStatus(firstString(record, ["status", "unitStatus", "state"]));
  return {
    ok: true,
    ping: {
      unitNumber,
      latitude: latitude as number,
      longitude: longitude as number,
      heading: firstNumber(record, ["heading", "bearing", "course"]),
      speed: firstNumber(record, ["speed", "velocity", "mph"]),
      status,
      recordedAt: isoOrNow(firstString(record, ["recordedAt", "timestamp", "time", "gpsTime", "fixTime"])),
    },
  };
}

export type IncidentNoteInput = {
  incidentId: string;
  note: string;
  category: string;
  author: string;
  unitNumber: string;
  eventAt: string;
  externalId: string;
};

const noteCategories = new Set(["note", "size_up", "command", "unit_status", "dispatch", "safety", "clear"]);

/** Normalize a real-time incident (CAD) note arriving over a webhook. */
export function normalizeIncidentNote(raw: unknown): { ok: true; note: IncidentNoteInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Note payload must be an object." };
  const record = raw as Record<string, unknown>;
  const incidentId = firstString(record, ["incidentId", "incident", "incidentNumber", "callNumber", "cadNumber", "reportNumber"]);
  if (!incidentId) return { ok: false, error: "An incident identifier is required." };
  const note = firstString(record, ["note", "text", "comment", "narrative", "message", "remark"]);
  if (!note) return { ok: false, error: "Note text is required." };
  const category = firstString(record, ["category", "type", "noteType"]).toLowerCase();
  return {
    ok: true,
    note: {
      incidentId,
      note,
      category: noteCategories.has(category) ? category : "note",
      author: firstString(record, ["author", "by", "user", "member", "operator"]),
      unitNumber: firstString(record, ["unitNumber", "unit", "callSign"]),
      eventAt: isoOrNow(firstString(record, ["eventAt", "timestamp", "time", "at"])),
      externalId: firstString(record, ["externalId", "id", "eventId", "messageId", "sequenceId"]),
    },
  };
}

export type AlarmSignal = {
  externalEventId: string;
  signalType: string;
  zone: string;
  description: string;
  priority: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  eventAt: string;
};

const alarmSignalTypes = new Set(["alarm", "trouble", "supervisory", "restore", "test"]);
const alarmPriorities = new Set(["critical", "high", "medium", "low"]);

/** Normalize a fire-alarm panel signal (monitored alarm systems). */
export function normalizeAlarmSignal(raw: unknown): { ok: true; signal: AlarmSignal } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Alarm payload must be an object." };
  const record = raw as Record<string, unknown>;
  const signalTypeRaw = firstString(record, ["signalType", "type", "eventType", "signal", "status"]).toLowerCase();
  const signalType = alarmSignalTypes.has(signalTypeRaw) ? signalTypeRaw : "alarm";
  const description = firstString(record, ["description", "message", "event", "text", "detail"]);
  const priorityRaw = firstString(record, ["priority", "severity"]).toLowerCase();
  const latitude = firstNumber(record, ["latitude", "lat"]);
  const longitude = firstNumber(record, ["longitude", "lng", "lon"]);
  return {
    ok: true,
    signal: {
      externalEventId: firstString(record, ["externalEventId", "eventId", "id", "signalId", "transactionId"]),
      signalType,
      zone: firstString(record, ["zone", "point", "device", "loop"]),
      description: description || `${signalType} signal`,
      priority: alarmPriorities.has(priorityRaw) ? priorityRaw : signalType === "alarm" ? "critical" : "high",
      address: firstString(record, ["address", "location", "premise"]),
      latitude: isValidLatLng(latitude, longitude) ? latitude : null,
      longitude: isValidLatLng(latitude, longitude) ? longitude : null,
      eventAt: isoOrNow(firstString(record, ["eventAt", "timestamp", "time", "at"])),
    },
  };
}

// ---------------------------------------------------------------------------
// Outbound delivery envelope
// ---------------------------------------------------------------------------

export type OutboundEventType = "incident" | "location" | "note" | "status" | "alarm";

export const outboundEventTypes: OutboundEventType[] = ["incident", "location", "note", "status", "alarm"];

export type OutboundEnvelope = {
  event: OutboundEventType;
  emittedAt: string;
  source: string;
  data: unknown;
};

export function buildOutboundEnvelope(event: OutboundEventType, data: unknown, source = "Stickney CAD"): OutboundEnvelope {
  return { event, emittedAt: new Date().toISOString(), source, data };
}

export function parseSubscriptions(raw: unknown): OutboundEventType[] {
  let list: unknown = raw;
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw);
    } catch {
      list = raw.split(",");
    }
  }
  if (!Array.isArray(list)) return [];
  const valid = new Set<string>(outboundEventTypes);
  return list
    .map((item) => String(item).trim().toLowerCase())
    .filter((item): item is OutboundEventType => valid.has(item));
}

/** A url is a valid outbound destination only if it is an absolute http(s) URL. */
export function isDeliverableUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
