import { ensureDatabase } from "../../../../db/bootstrap";
import { buildCadPushPayload, sendCadPushNotifications, webPushPublicConfig } from "../../../cad-push";
import {
  sameOriginInventoryRequest,
  sessionFailureResponse,
  verifyInventoryRequest,
} from "../../../lib/inventory-session";

export async function POST(request: Request) {
  const session = await verifyInventoryRequest(request);
  if (!session.ok) return sessionFailureResponse(session);
  if (!sameOriginInventoryRequest(request)) {
    return Response.json({ error: "Invalid notification test origin." }, { status: 403 });
  }
  if (!webPushPublicConfig().configured) {
    return Response.json({ error: "CAD phone alerts are not configured yet." }, { status: 503 });
  }
  const db = await ensureDatabase();
  const owned = await db.prepare(
    "SELECT id FROM push_subscriptions WHERE user_id = ? AND department_id = ? AND active = 1 LIMIT 1",
  ).bind(session.context.user.id, session.context.department.id).first<{ id: string }>();
  if (!owned) return Response.json({ error: "Enable CAD phone alerts on this device first." }, { status: 409 });

  const incident = {
    incidentId: "TEST",
    callType: "TEST CAD ALERT",
    timeOut: new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date()).replace(":", ""),
    narrative: "This is a test from Stickney Firehouse Manager.",
  };
  const result = await sendCadPushNotifications(db, incident, {
    userId: session.context.user.id,
    departmentId: session.context.department.id,
  });
  return Response.json({ ...result, preview: buildCadPushPayload(incident) });
}
