export type DispatchIncident = {
  incidentId: string;
  callType: string;
  category: string;
  address: string;
  city: string;
  narrative: string;
  units: string;
  longitude: number | null;
  latitude: number | null;
  dispatchedAt: string;
};

type JsonDispatch = {
  incidentID?: unknown;
  incidentId?: unknown;
  type?: { _id?: unknown; type?: unknown; desc?: unknown } | unknown;
  category?: unknown;
  street?: unknown;
  locationOfIncident?: unknown;
  city?: unknown;
  synopsis?: unknown;
  narrative?: unknown;
  units?: unknown;
  ts?: { $date?: unknown } | unknown;
  timestamp?: unknown;
  location?: { coordinates?: unknown };
  coordinates?: unknown;
};

const clean = (value: unknown) => String(value ?? "").trim();

function coordinates(value: unknown): [number | null, number | null] {
  if (!Array.isArray(value) || value.length < 2) return [null, null];
  const longitude = Number(value[0]), latitude = Number(value[1]);
  return [Number.isFinite(longitude) ? longitude : null, Number.isFinite(latitude) ? latitude : null];
}

export function parseDispatchJson(input: unknown): DispatchIncident | null {
  if (!input || typeof input !== "object") return null;
  const value = input as JsonDispatch;
  const type = value.type && typeof value.type === "object" ? value.type as { _id?: unknown; type?: unknown; desc?: unknown } : {};
  const incidentId = clean(value.incidentID ?? value.incidentId);
  const callType = clean(type.desc ?? type._id ?? value.type);
  if (!incidentId || !callType) return null;
  const city = clean(value.city);
  const street = clean(value.street);
  const address = clean(value.locationOfIncident) || [street, city].filter(Boolean).join(", ");
  const unitList = Array.isArray(value.units) ? value.units.map(clean).filter(Boolean) : [clean(value.units)].filter(Boolean);
  const rawCoordinates = value.location?.coordinates ?? value.coordinates;
  const [longitude, latitude] = coordinates(rawCoordinates);
  const rawTimestamp = value.ts && typeof value.ts === "object" ? (value.ts as { $date?: unknown }).$date : value.timestamp;
  const timestamp = new Date(clean(rawTimestamp));
  return {
    incidentId,
    callType,
    category: clean(type.type ?? value.category) || "unknown",
    address,
    city,
    narrative: clean(value.synopsis ?? value.narrative),
    units: unitList.join(", "),
    longitude,
    latitude,
    dispatchedAt: Number.isNaN(timestamp.getTime()) ? new Date().toISOString() : timestamp.toISOString(),
  };
}

export function parseDispatchText(text: string): DispatchIncident | null {
  const fields = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z][A-Za-z ]+):\s*(.*?)\s*$/);
    if (match) fields.set(match[1].replace(/\s+/g, "").toLowerCase(), match[2]);
  }
  const incidentId = fields.get("incidentid") || "";
  const callType = fields.get("calltype") || "";
  if (!incidentId || !callType) return null;
  let parsedCoordinates: unknown = [];
  try { parsedCoordinates = JSON.parse(fields.get("coordinates") || "[]"); } catch { /* Invalid coordinates remain unavailable. */ }
  const [longitude, latitude] = coordinates(parsedCoordinates);
  const city = fields.get("city") || "";
  const location = fields.get("location") || "";
  const timestamp = new Date((fields.get("timestamp") || "").replace(" ", "T") + "Z");
  return {
    incidentId,
    callType,
    category: fields.get("category") || "unknown",
    address: [location, city].filter(Boolean).join(", "),
    city,
    narrative: fields.get("narrative") || "",
    units: fields.get("dispatch") || "",
    longitude,
    latitude,
    dispatchedAt: Number.isNaN(timestamp.getTime()) ? new Date().toISOString() : timestamp.toISOString(),
  };
}
