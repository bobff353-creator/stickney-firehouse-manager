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

function chicagoLocalTimestamp(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return null;
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(cleaned)) {
    const explicit = new Date(cleaned);
    return Number.isNaN(explicit.getTime()) ? null : explicit;
  }
  const match = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    const parsed = new Date(cleaned);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const requested = {
    year: Number(match[1]), month: Number(match[2]), day: Number(match[3]),
    hour: Number(match[4]), minute: Number(match[5]), second: Number(match[6] || 0),
  };
  let instant = Date.UTC(requested.year, requested.month - 1, requested.day, requested.hour, requested.minute, requested.second);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = formatter.formatToParts(new Date(instant));
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value || 0);
    const shown = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
    instant += Date.UTC(requested.year, requested.month - 1, requested.day, requested.hour, requested.minute, requested.second) - shown;
  }
  const parsed = new Date(instant);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

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
  const timestamp = chicagoLocalTimestamp(fields.get("timestamp") || "");
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
    dispatchedAt: timestamp ? timestamp.toISOString() : new Date().toISOString(),
  };
}
