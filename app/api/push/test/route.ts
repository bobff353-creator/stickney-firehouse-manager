import { ensureDatabase } from "../../../../db/bootstrap";
import { buildCadPushPayload, deliverSchedulerPush, sendCadPushNotifications, webPushPublicConfig } from "../../../cad-push";
import {
  sameOriginInventoryRequest,
  sessionFailureResponse,
  verifyPushRequest,
} from "../../../lib/inventory-session";

export async function POST(request: Request) {
  const session = await verifyPushRequest(request);
  if (!session.ok) return sessionFailureResponse(session);
  if (!sameOriginInventoryRequest(request)) {
    return Response.json({ error: "Invalid notification test origin." }, { status: 403 });
  }
  if (!webPushPublicConfig().configured) {
    return Response.json({ error: "Portal phone alerts are not configured yet." }, { status: 503 });
  }
  const db = await ensureDatabase();
  const owned = await db.prepare(
    "SELECT id FROM push_subscriptions WHERE user_id = ? AND department_id = ? AND active = 1 LIMIT 1",
  ).bind(session.context.user.id, session.context.department.id).first<{ id: string }>();
  if (!owned) return Response.json({ error: "Enable portal phone alerts on this device first." }, { status: 409 });

  if (!session.context.grants.includes('field_preplans.view')) {
    const rows=await db.prepare('SELECT endpoint,p256dh,auth FROM push_subscriptions WHERE active=1 AND user_id=? AND department_id=? ORDER BY created_at LIMIT 10').bind(session.context.user.id,session.context.department.id).all<{endpoint:string;p256dh:string;auth:string}>();
    const payload={eventId:crypto.randomUUID(),kind:'scheduler',title:'TEST schedule notification',body:'Personal device test only. No schedule changed.',url:'/?page=scheduling',tag:'scheduler-device-test'};
    const results=await Promise.allSettled(rows.results.map(subscription=>deliverSchedulerPush(subscription,payload,300)));
    return Response.json({configured:true,delivered:results.filter(result=>result.status==='fulfilled').length,failed:results.filter(result=>result.status==='rejected').length,preview:payload});
  }

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
