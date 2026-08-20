import { ensureDatabase } from "../../../../db/bootstrap";
import { parseCisCadPayload } from "../../../cis-cad";
import { projectDispatchIntoDailyLog } from "../../../dispatch-daily-log";

type RuntimeEnv = {
  CIS_CAD_WEBHOOK_SECRET?: string;
};

const ownerAdminEmails = ["bobff353@gmail.com"];

function safeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index++)
    mismatch |= left[index] ^ right[index];
  return mismatch === 0;
}
async function isAdmin(
  request: Request,
  db: Awaited<ReturnType<typeof ensureDatabase>>,
) {
  const email =
    request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ??
    "";
  if (ownerAdminEmails.includes(email)) return true;
  const profile = email
    ? await db
        .prepare(
          "SELECT is_admin AS isAdmin FROM employee_profiles WHERE lower(email) = ? LIMIT 1",
        )
        .bind(email)
        .first<{ isAdmin: number }>()
    : null;
  return Boolean(profile?.isAdmin);
}

async function runtime() {
  return process.env as RuntimeEnv;
}

async function sha256(value: string) {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function authenticated(request: Request, body: string, secret: string) {
  if (!secret) return false;
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.startsWith("Bearer ")) {
    return safeEqual(
      new TextEncoder().encode(authorization.slice(7)),
      new TextEncoder().encode(secret),
    );
  }
  const signature = (request.headers.get("x-cis-signature") ?? "").replace(
    /^sha256=/i,
    "",
  );
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)),
  );
  const provided = Uint8Array.from(signature.match(/.{2}/g) ?? [], (pair) =>
    Number.parseInt(pair, 16),
  );
  return safeEqual(digest, provided);
}

function chicagoMilitaryTime(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  return `${parts.find((part) => part.type === "hour")?.value || "00"}${parts.find((part) => part.type === "minute")?.value || "00"}`;
}

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    if (!(await isAdmin(request, db)))
      return Response.json(
        { error: "Administrator access is required." },
        { status: 403 },
      );
    const env = await runtime();
    const receipts = await db
      .prepare(
        "SELECT id, external_incident_id AS incidentId, event_type AS eventType, payload_format AS payloadFormat, status, error_message AS errorMessage, duplicate_of AS duplicateOf, received_at AS receivedAt, processed_at AS processedAt FROM cad_inbound_receipts WHERE provider = 'cis' ORDER BY datetime(received_at) DESC LIMIT 12",
      )
      .all();
    const accepted = await db
      .prepare(
        "SELECT COUNT(*) AS count FROM cad_inbound_receipts WHERE provider = 'cis' AND status = 'accepted'",
      )
      .first<{ count: number }>();
    const failed = await db
      .prepare(
        "SELECT COUNT(*) AS count FROM cad_inbound_receipts WHERE provider = 'cis' AND status = 'rejected'",
      )
      .first<{ count: number }>();
    return Response.json(
      {
        provider: "CIS / Cicero Consolidated Dispatch",
        stage: env.CIS_CAD_WEBHOOK_SECRET
          ? "credentials_configured"
          : "prebuilt",
        secretConfigured: Boolean(env.CIS_CAD_WEBHOOK_SECRET),
        webhookUrl: new URL("/api/cad/cis", request.url).toString(),
        acceptedCount: Number(accepted?.count ?? 0),
        failedCount: Number(failed?.count ?? 0),
        receipts: receipts.results,
        liveVerified: false,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load CIS CAD status.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const db = await ensureDatabase();
    if (!(await isAdmin(request, db)))
      return Response.json(
        { error: "Administrator access is required." },
        { status: 403 },
      );
    const payload = (await request.json()) as {
      sample?: unknown;
      contentType?: unknown;
    };
    const sample =
      typeof payload.sample === "string"
        ? payload.sample
        : JSON.stringify(payload.sample ?? {});
    if (sample.length > 262_144)
      return Response.json(
        { error: "Sample is larger than 256 KB." },
        { status: 413 },
      );
    const result = parseCisCadPayload(
      sample,
      String(payload.contentType || "application/json"),
    );
    return Response.json(result, {
      status: result.ok ? 200 : 422,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "The sample could not be validated." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const receiptId = crypto.randomUUID();
  let body = "";
  try {
    const declaredLength = Number(request.headers.get("content-length") || "0");
    if (declaredLength > 262_144)
      return Response.json(
        { error: "Payload is larger than 256 KB.", receiptId },
        { status: 413 },
      );
    body = await request.text();
    if (!body || body.length > 262_144)
      return Response.json(
        { error: "Payload must be between 1 byte and 256 KB.", receiptId },
        { status: 413 },
      );

    const env = await runtime();
    if (!env.CIS_CAD_WEBHOOK_SECRET)
      return Response.json(
        { error: "CIS CAD delivery is not configured.", receiptId },
        { status: 503 },
      );
    if (!(await authenticated(request, body, env.CIS_CAD_WEBHOOK_SECRET)))
      return Response.json(
        { error: "Invalid CIS CAD authentication.", receiptId },
        { status: 401 },
      );

    const db = await ensureDatabase();
    const payloadHash = await sha256(body);
    const prior = await db
      .prepare(
        "SELECT id FROM cad_inbound_receipts WHERE provider = 'cis' AND dedupe_key = ? LIMIT 1",
      )
      .bind(payloadHash)
      .first<{ id: string }>();
    if (prior)
      return Response.json({
        accepted: true,
        duplicate: true,
        receiptId: prior.id,
      });

    const contentType = request.headers.get("content-type") || "text/plain";
    const parsed = parseCisCadPayload(body, contentType);
    if (!parsed.ok) {
      await db
        .prepare(
          "INSERT INTO cad_inbound_receipts (id, provider, dedupe_key, payload_format, raw_payload, status, error_message, received_at, processed_at) VALUES (?, 'cis', ?, ?, ?, 'rejected', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
        )
        .bind(receiptId, payloadHash, parsed.format, body, parsed.error)
        .run();
      return Response.json(
        { accepted: false, receiptId, error: parsed.error },
        { status: 422 },
      );
    }

    const incident = parsed.incident;
    const active = incident.eventType === "close" ? 0 : 1;
    const timeOut =
      incident.timeOut || chicagoMilitaryTime(incident.dispatchedAt);
    const receipt = db
      .prepare(
        "INSERT INTO cad_inbound_receipts (id, provider, dedupe_key, external_event_id, external_incident_id, event_type, payload_format, raw_payload, normalized_payload, status, received_at, processed_at) VALUES (?, 'cis', ?, ?, ?, ?, ?, ?, ?, 'accepted', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
      )
      .bind(
        receiptId,
        payloadHash,
        incident.eventId,
        incident.incidentId,
        incident.eventType,
        parsed.format,
        body,
        JSON.stringify(incident),
      );
    const upsert = db
      .prepare(
        "INSERT INTO dispatch_incidents (incident_id, resend_email_id, call_type, category, address, city, narrative, responding_units, longitude, latitude, dispatched_at, time_out, attachment_count, source_payload, source_system, received_at, cleared_at, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'CIS CAD', CURRENT_TIMESTAMP, CASE WHEN ? = 0 THEN CURRENT_TIMESTAMP ELSE NULL END, ?) ON CONFLICT(incident_id) DO UPDATE SET call_type=excluded.call_type, category=excluded.category, address=excluded.address, city=excluded.city, narrative=excluded.narrative, responding_units=excluded.responding_units, longitude=excluded.longitude, latitude=excluded.latitude, dispatched_at=excluded.dispatched_at, time_out=excluded.time_out, source_payload=excluded.source_payload, source_system='CIS CAD', received_at=CURRENT_TIMESTAMP, cleared_at=CASE WHEN excluded.active=0 THEN CURRENT_TIMESTAMP ELSE NULL END, active=excluded.active",
      )
      .bind(
        incident.incidentId,
        `cis-${incident.incidentId}`,
        incident.callType,
        incident.category,
        incident.address,
        incident.city,
        incident.narrative,
        incident.respondingUnits,
        incident.longitude,
        incident.latitude,
        incident.dispatchedAt,
        timeOut,
        JSON.stringify(incident),
        active,
        active,
      );
    await db.batch([receipt, upsert]);
    if (active) {
      await projectDispatchIntoDailyLog(db, {
        reportNumber: incident.incidentId,
        dispatchedAt: incident.dispatchedAt,
        timeOut,
        respondingUnits: incident.respondingUnits,
        address: incident.address,
        callType: incident.callType,
      });
    }
    return Response.json({
      accepted: true,
      duplicate: false,
      receiptId,
      incidentId: incident.incidentId,
      eventType: incident.eventType,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to process CIS CAD delivery.",
        receiptId,
      },
      { status: 500 },
    );
  }
}
