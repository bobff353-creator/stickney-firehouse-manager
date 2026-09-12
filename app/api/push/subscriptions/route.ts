import { ensureDatabase } from "../../../../db/bootstrap";
import {
  sameOriginInventoryRequest,
  sessionFailureResponse,
  verifyPushRequest,
} from "../../../lib/inventory-session";
import { webPushPublicConfig } from "../../../cad-push";

type SubscriptionBody = {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
};

function text(value: unknown, limit = 8192) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

export async function GET(request: Request) {
  const session = await verifyPushRequest(request);
  if (!session.ok) return sessionFailureResponse(session);
  return Response.json(webPushPublicConfig(), {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function POST(request: Request) {
  const session = await verifyPushRequest(request);
  if (!session.ok) return sessionFailureResponse(session);
  if (!['field_preplans.view','scheduling.view','scheduling.manage'].some(key => session.context.grants.includes(key as typeof session.context.grants[number]))) return Response.json({ error: 'Respond or scheduling access is required for portal notifications.' }, { status: 403 });
  if (!sameOriginInventoryRequest(request)) {
    return Response.json({ error: "Invalid notification registration origin." }, { status: 403 });
  }
  const config = webPushPublicConfig();
  if (!config.configured) {
    return Response.json({ error: "Portal phone alerts are not configured yet." }, { status: 503 });
  }
  const body = await request.json() as SubscriptionBody;
  const endpoint = text(body.endpoint);
  const p256dh = text(body.keys?.p256dh, 2048);
  const auth = text(body.keys?.auth, 2048);
  if (!endpoint.startsWith("https://") || !p256dh || !auth) {
    return Response.json({ error: "The phone did not provide a valid push subscription." }, { status: 400 });
  }
  const db = await ensureDatabase();
  await db.prepare(
    "INSERT INTO push_subscriptions (id, user_id, department_id, endpoint, p256dh, auth, user_agent, active, failure_count, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, department_id = excluded.department_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent, active = 1, failure_count = 0, last_error = '', updated_at = CURRENT_TIMESTAMP",
  ).bind(
    crypto.randomUUID(),
    session.context.user.id,
    session.context.department.id,
    endpoint,
    p256dh,
    auth,
    text(request.headers.get("user-agent"), 500),
  ).run();
  return Response.json({ subscribed: true });
}

export async function DELETE(request: Request) {
  const session = await verifyPushRequest(request);
  if (!session.ok) return sessionFailureResponse(session);
  if (!sameOriginInventoryRequest(request)) {
    return Response.json({ error: "Invalid notification registration origin." }, { status: 403 });
  }
  const body = await request.json() as { endpoint?: unknown };
  const endpoint = text(body.endpoint);
  if (!endpoint) return Response.json({ error: "Missing push subscription." }, { status: 400 });
  const db = await ensureDatabase();
  await db.prepare(
    "UPDATE push_subscriptions SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE endpoint = ? AND user_id = ? AND department_id = ?",
  ).bind(endpoint, session.context.user.id, session.context.department.id).run();
  return Response.json({ subscribed: false });
}
