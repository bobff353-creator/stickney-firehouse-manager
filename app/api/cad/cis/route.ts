import { hasPermission } from "../../../server-permissions";
import { ensureDatabase } from "../../../../db/bootstrap";
import { parseCisCadPayload } from "../../../cis-cad";
import { ingestCisDelivery } from "../../../cis-cad-ingest";
import { readCisSettings, saveCisSettings } from "../../../cis-cad-store";
import { reduceCisEvent, validateCisSettings } from "../../../cis-cad-routing";
import { scheduleCadPushDelivery } from "../../../cad-push-worker";
import { createPostgresD1Adapter } from '../../../../db/postgres-adapter';
import { getSupabaseSystemClient } from '../../../supabase-system';
import { GET as getFleetContext } from '../../suite-context/route';
import { normalizeFleetApparatusName } from '../../../respond-device';

type RuntimeEnv = {
  CIS_CAD_WEBHOOK_SECRET?: string;
};


function safeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index++)
    mismatch |= left[index] ^ right[index];
  return mismatch === 0;
}
async function isAdmin(request: Request, db: Awaited<ReturnType<typeof ensureDatabase>>) {
  return hasPermission(request, db, "settings.manage");
}

async function runtime() {
  return process.env as RuntimeEnv;
}

async function routingFleet(request: Request) {
  const response = await getFleetContext(new Request(new URL('/api/suite-context', request.url), { headers: request.headers }));
  if (!response.ok) throw new Error('Current department Fleet records are unavailable. No mappings were saved.');
  const payload = await response.json() as { apparatus: Array<{ unitNumber: string; name: string }> };
  return payload.apparatus.map(row => ({ unitNumber: normalizeFleetApparatusName(row.unitNumber), name: row.name })).filter(row => row.unitNumber);
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

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    if (!(await isAdmin(request, db)))
      return Response.json(
        { error: "Administrator access is required." },
        { status: 403 },
      );
    const env = await runtime();
    const { settings } = await readCisSettings(db);
    const fleet = await routingFleet(request);
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
        settings,
        fleet,
        readiness: "App-side controls available. Vendor message contract and end-to-end live delivery remain unverified.",
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
    const { settings } = await readCisSettings(db);
    const routing = result.ok ? reduceCisEvent(null, result.incident, settings) : null;
    return Response.json({ ...result, routing, writes: false, notifications: false }, {
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

export async function PATCH(request: Request) {
  try {
    const db = await ensureDatabase();
    if (!await isAdmin(request, db)) return Response.json({ error: "Administrator access is required." }, { status: 403 });
    const raw = await request.text();
    if (raw.length > 20000) return Response.json({ error: "Configuration is too large." }, { status: 413 });
    const body = JSON.parse(raw);
    const fleet = await routingFleet(request);
    const settings = validateCisSettings(body.settings, fleet.map(row => row.unitNumber));
    if (settings.mode === "live" && (!process.env.CIS_CAD_WEBHOOK_SECRET || body.confirmLive !== true || !settings.units.length)) {
      return Response.json({ error: "Live delivery requires the hosted webhook secret, approved unit mappings and explicit confirmation after vendor testing." }, { status: 400 });
    }
    const saved = await saveCisSettings(db, settings, request.headers.get("oai-authenticated-user-email") || "");
    return Response.json({ settings: saved }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Settings were not saved." }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    // Bounded payload also stays below the signed database executor's query limit.
    if (Number(request.headers.get("content-length") || "0") > 65536) return Response.json({ error: "Payload is larger than 64 KB." }, { status: 413 });
    const body = await request.text();
    if (!body || Buffer.byteLength(body, "utf8") > 65536) return Response.json({ error: "Payload must be between 1 byte and 64 KB." }, { status: 413 });
    const env = await runtime();
    if (!env.CIS_CAD_WEBHOOK_SECRET) return Response.json({ error: "CIS CAD delivery is not configured." }, { status: 503 });
    if (!await authenticated(request, body, env.CIS_CAD_WEBHOOK_SECRET)) return Response.json({ error: "Invalid CIS CAD authentication." }, { status: 401 });
    const databaseSecret = process.env.FIREHOUSE_DATABASE_SECRET?.replace(/[\uFEFF\r\n]/g, '').trim().replace(/^['"]|['"]$/g, '');
    if (!databaseSecret) return Response.json({ error: 'CIS server database access is not configured.' }, { status: 503 });
    const db = createPostgresD1Adapter(getSupabaseSystemClient, 'firehouse_server_sql', databaseSecret);
    const { httpStatus, pushIncidentId, ...result } = await ingestCisDelivery(db, body, request.headers.get("content-type") || "text/plain");
    if (pushIncidentId) scheduleCadPushDelivery(pushIncidentId);
    return Response.json(result, { status: httpStatus, headers: { "cache-control": "no-store" } });
  } catch {
    // Do not expose database details or payloads to an external sender.
    return Response.json({ accepted: false, error: "Unable to commit CIS delivery. Retry this delivery." }, { status: 503 });
  }
}
