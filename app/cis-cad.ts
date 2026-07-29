export type CisCadIncident = {
  incidentId: string;
  eventId: string;
  eventType: "new" | "update" | "close";
  callType: string;
  category: string;
  address: string;
  city: string;
  narrative: string;
  respondingUnits: string;
  longitude: number | null;
  latitude: number | null;
  dispatchedAt: string;
  timeOut: string;
  timeIn: string;
};

export type CisCadParseResult =
  | { ok: true; incident: CisCadIncident; format: "json" | "form" | "xml" | "text" }
  | { ok: false; error: string; format: "json" | "form" | "xml" | "text" };

function key(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function scalar(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (Array.isArray(value)) return value.map(scalar).filter(Boolean).join(", ");
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return scalar(record.name ?? record.id ?? record.unit ?? record.value ?? "");
  }
  return "";
}

function flatten(value: unknown, result = new Map<string, string>()) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  for (const [rawKey, child] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = key(rawKey);
    const text = scalar(child);
    if (text && !result.has(normalizedKey)) result.set(normalizedKey, text);
    if (child && typeof child === "object" && !Array.isArray(child)) flatten(child, result);
  }
  return result;
}

function field(values: Map<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const value = values.get(key(alias));
    if (value) return value;
  }
  return "";
}

function number(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function eventType(value: string, timeIn: string): CisCadIncident["eventType"] {
  const normalized = value.toLowerCase();
  if (timeIn || /\b(clear|cleared|close|closed|complete|completed|cancel|cancelled|canceled|available)\b/.test(normalized)) return "close";
  if (/\b(update|modify|modified|unit|status)\b/.test(normalized)) return "update";
  return "new";
}

function validDate(value: string) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function normalize(values: Map<string, string>): CisCadParseResult {
  const incidentId = field(values, ["incidentId", "incidentNumber", "callNumber", "cadNumber", "eventNumber", "caseNumber", "reportNumber"]);
  const rawDispatchedAt = field(values, ["dispatchedAt", "dispatchDateTime", "dispatchTime", "callDateTime", "createdAt", "receivedAt"]);
  const dispatchedAt = validDate(rawDispatchedAt);
  const callType = field(values, ["callType", "nature", "problem", "incidentType", "eventTypeDescription", "callNature"]);
  const address = field(values, ["address", "location", "streetAddress", "incidentAddress", "callLocation"]);
  const timeIn = field(values, ["timeIn", "clearTime", "clearedAt", "closedAt", "completedAt"]);
  const status = field(values, ["eventAction", "action", "status", "incidentStatus", "eventType"]);
  const format = "json" as const;

  if (!incidentId) return { ok: false, error: "No stable CIS incident or call number was found.", format };
  if (!dispatchedAt) return { ok: false, error: "No valid dispatch date and time was found.", format };
  if (!callType && !address) return { ok: false, error: "The message has neither a call type nor an incident address.", format };

  return {
    ok: true,
    format,
    incident: {
      incidentId,
      eventId: field(values, ["eventId", "messageId", "transactionId", "sequenceId", "updateId"]),
      eventType: eventType(status, timeIn),
      callType: callType || "CAD incident",
      category: field(values, ["category", "serviceType", "discipline", "agencyType"]),
      address,
      city: field(values, ["city", "municipality", "jurisdiction"]),
      narrative: field(values, ["narrative", "comments", "notes", "remarks", "callNotes"]),
      respondingUnits: field(values, ["respondingUnits", "units", "assignedUnits", "unitIds", "apparatus"]),
      longitude: number(field(values, ["longitude", "lon", "lng", "xCoordinate"])),
      latitude: number(field(values, ["latitude", "lat", "yCoordinate"])),
      dispatchedAt,
      timeOut: field(values, ["timeOut", "enrouteTime", "dispatchTimeMilitary"]),
      timeIn,
    },
  };
}

function parseXml(body: string) {
  const values = new Map<string, string>();
  for (const match of body.matchAll(/<([A-Za-z_][\w:.-]*)\b[^>]*>([^<]*)<\/\1>/g)) {
    const name = match[1].split(":").at(-1) ?? match[1];
    const value = match[2].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
    if (value && !values.has(key(name))) values.set(key(name), value);
  }
  return values;
}

function parseText(body: string) {
  const values = new Map<string, string>();
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^\s*([^:=]{2,60})\s*[:=]\s*(.+?)\s*$/);
    if (match) values.set(key(match[1]), match[2]);
  }
  return values;
}

export function parseCisCadPayload(body: string, contentType = "application/json"): CisCadParseResult {
  const type = contentType.toLowerCase();
  let values: Map<string, string>;
  let format: CisCadParseResult["format"] = "text";
  try {
    if (type.includes("json") || body.trim().startsWith("{")) {
      values = flatten(JSON.parse(body));
      format = "json";
    } else if (type.includes("x-www-form-urlencoded")) {
      values = new Map(Array.from(new URLSearchParams(body).entries()).map(([name, value]) => [key(name), value.trim()]));
      format = "form";
    } else if (type.includes("xml") || body.trim().startsWith("<")) {
      values = parseXml(body);
      format = "xml";
    } else {
      values = parseText(body);
      format = "text";
    }
  } catch {
    return { ok: false, error: "The CIS message body could not be parsed.", format };
  }
  const result = normalize(values);
  return { ...result, format };
}

