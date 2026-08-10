import { ensureDatabase } from "../../../../db/bootstrap";
import { resolveViewer } from "../../../cad-auth";
import { buildOutboundEnvelope, isDeliverableUrl, outboundEventTypes, parseSubscriptions, signPayload } from "../../../cad-dispatch-service";

type Db = Awaited<ReturnType<typeof ensureDatabase>>;

const jsonHeaders = { "cache-control": "no-store" } as const;

function newToken() {
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
}

async function requireAdmin(request: Request, db: Db) {
  const viewer = await resolveViewer(request, db);
  return viewer.isAdmin ? viewer : null;
}

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    if (!(await requireAdmin(request, db))) return Response.json({ error: "Administrator access is required." }, { status: 403 });
    const agencies = await db.prepare("SELECT id, name, agency_type AS agencyType, contact, inbound_token AS inboundToken, outbound_url AS outboundUrl, subscriptions, active, last_inbound_at AS lastInboundAt, last_outbound_at AS lastOutboundAt, CASE WHEN outbound_secret <> '' THEN 1 ELSE 0 END AS hasSecret FROM cad_agencies ORDER BY name").all();
    return Response.json({ inboundUrl: new URL("/api/cad/webhooks", request.url).toString(), eventTypes: outboundEventTypes, agencies: agencies.results }, { headers: jsonHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load agencies." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await ensureDatabase();
    const admin = await requireAdmin(request, db);
    if (!admin) return Response.json({ error: "Administrator access is required." }, { status: 403 });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action ?? "create");

    if (action === "create") {
      const name = String(body.name ?? "").trim();
      if (!name) return Response.json({ error: "An agency name is required." }, { status: 422 });
      const outboundUrl = String(body.outboundUrl ?? "").trim();
      if (outboundUrl && !isDeliverableUrl(outboundUrl)) return Response.json({ error: "The outbound URL must be an http(s) URL." }, { status: 422 });
      const id = crypto.randomUUID();
      const inboundToken = newToken();
      await db.prepare("INSERT INTO cad_agencies (id, name, agency_type, contact, inbound_token, outbound_url, outbound_secret, subscriptions, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(
        id,
        name,
        String(body.agencyType ?? "cad").trim() || "cad",
        String(body.contact ?? "").trim(),
        inboundToken,
        outboundUrl,
        String(body.outboundSecret ?? "").trim(),
        JSON.stringify(parseSubscriptions(body.subscriptions)),
        admin.displayName || admin.email,
      ).run();
      return Response.json({ ok: true, id, inboundToken }, { headers: jsonHeaders });
    }

    const id = String(body.id ?? "").trim();
    if (!id) return Response.json({ error: "An agency id is required." }, { status: 422 });
    const agency = await db.prepare("SELECT id, name, outbound_url AS outboundUrl, outbound_secret AS outboundSecret FROM cad_agencies WHERE id = ? LIMIT 1").bind(id).first<{ id: string; name: string; outboundUrl: string; outboundSecret: string }>();
    if (!agency) return Response.json({ error: "Agency not found." }, { status: 404 });

    if (action === "update") {
      const outboundUrl = body.outboundUrl === undefined ? agency.outboundUrl : String(body.outboundUrl ?? "").trim();
      if (outboundUrl && !isDeliverableUrl(outboundUrl)) return Response.json({ error: "The outbound URL must be an http(s) URL." }, { status: 422 });
      await db.prepare("UPDATE cad_agencies SET name = COALESCE(?, name), agency_type = COALESCE(?, agency_type), contact = COALESCE(?, contact), outbound_url = ?, subscriptions = COALESCE(?, subscriptions), active = COALESCE(?, active), outbound_secret = CASE WHEN ? IS NOT NULL THEN ? ELSE outbound_secret END, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(
        body.name === undefined ? null : String(body.name).trim(),
        body.agencyType === undefined ? null : String(body.agencyType).trim(),
        body.contact === undefined ? null : String(body.contact).trim(),
        outboundUrl,
        body.subscriptions === undefined ? null : JSON.stringify(parseSubscriptions(body.subscriptions)),
        body.active === undefined ? null : (body.active ? 1 : 0),
        body.outboundSecret === undefined ? null : String(body.outboundSecret ?? "").trim(),
        body.outboundSecret === undefined ? null : String(body.outboundSecret ?? "").trim(),
        id,
      ).run();
      return Response.json({ ok: true, id }, { headers: jsonHeaders });
    }

    if (action === "rotate") {
      const inboundToken = newToken();
      await db.prepare("UPDATE cad_agencies SET inbound_token = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(inboundToken, id).run();
      return Response.json({ ok: true, id, inboundToken }, { headers: jsonHeaders });
    }

    if (action === "delete") {
      await db.prepare("DELETE FROM cad_agencies WHERE id = ?").bind(id).run();
      return Response.json({ ok: true, id }, { headers: jsonHeaders });
    }

    if (action === "test") {
      if (!isDeliverableUrl(agency.outboundUrl)) return Response.json({ error: "This agency has no valid outbound URL configured." }, { status: 422 });
      const envelope = buildOutboundEnvelope("note", { incidentId: "TEST", note: "CAD dispatch connectivity test", category: "note", author: admin.displayName || admin.email, eventAt: new Date().toISOString() });
      const payload = JSON.stringify(envelope);
      const deliveryId = crypto.randomUUID();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      let statusCode: number | null = null;
      let delivered = false;
      let error = "";
      try {
        const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "Stickney-CAD/1.0" };
        if (agency.outboundSecret) headers["x-cad-signature"] = `sha256=${await signPayload(agency.outboundSecret, payload)}`;
        const response = await fetch(agency.outboundUrl, { method: "POST", headers, body: payload, signal: controller.signal });
        statusCode = response.status;
        delivered = response.ok;
        if (!response.ok) error = `HTTP ${response.status}`;
      } catch (caught) {
        error = caught instanceof Error ? caught.message : "Delivery failed";
      } finally {
        clearTimeout(timer);
      }
      await db.prepare("INSERT INTO cad_outbound_deliveries (id, agency_id, agency_name, event_type, incident_id, endpoint, status, status_code, error, payload, delivered_at) VALUES (?, ?, ?, 'note', 'TEST', ?, ?, ?, ?, ?, ?)").bind(deliveryId, id, agency.name, agency.outboundUrl, delivered ? "delivered" : "failed", statusCode, error, payload, delivered ? new Date().toISOString() : null).run();
      await db.prepare("UPDATE cad_agencies SET last_outbound_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
      return Response.json({ ok: delivered, statusCode, error }, { headers: jsonHeaders });
    }

    return Response.json({ error: "Unknown agency action." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update agency." }, { status: 500 });
  }
}
