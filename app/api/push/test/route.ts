import { ensureDatabase } from '../../../../db/bootstrap';
import { deliverSchedulerPush, webPushPublicConfig } from '../../../cad-push';
import { sameOriginInventoryRequest, sessionFailureResponse, verifyPushRequest } from '../../../lib/inventory-session';
import { trustedPushEndpoint } from '../../../push-subscription-security';
export async function POST(request: Request) {
  const session=await verifyPushRequest(request);
  if(!session.ok)return sessionFailureResponse(session);
  if(!sameOriginInventoryRequest(request))return Response.json({error:'Invalid notification test origin.'},{status:403});
  if(!webPushPublicConfig().configured)return Response.json({error:'Push service is not configured.'},{status:503});
  const body=await request.json().catch(()=>null);
  if(!body || typeof body.endpoint!=='string' || !trustedPushEndpoint(body.endpoint))return Response.json({error:'Enable alerts on this device, then test again.'},{status:400});
  const db=await ensureDatabase();
  const owned=await db.prepare('SELECT id,endpoint,p256dh,auth FROM push_subscriptions WHERE endpoint=? AND user_id=? AND department_id=? AND active=1 LIMIT 1').bind(body.endpoint,session.context.user.id,session.context.department.id).first<{id:string;endpoint:string;p256dh:string;auth:string}>();
  if(!owned)return Response.json({error:'This device is not registered to your current account. Enable push here first.'},{status:409});
  try {
    await deliverSchedulerPush(owned,{eventId:crypto.randomUUID(),kind:'test',title:'TEST · Stickney Firehouse Manager',body:'This device only. Tap to open Home. No department records changed.',url:'/?page=home&display=portal',tag:'personal-device-test'},300);
  } catch(e) {
    const code=typeof e==='object'&&e&&'statusCode' in e?Number(e.statusCode):0;
    await db.prepare('UPDATE push_subscriptions SET active=?,failure_count=failure_count+1,last_error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(code===404||code===410?0:1,`Test provider status ${code}`,owned.id).run();
    return Response.json({error:code===404||code===410?'Device registration expired. Turn push off, then enable it again.':'The provider did not accept the test. Retry when connected.'},{status:502});
  }
  await db.prepare("UPDATE push_subscriptions SET failure_count=0,last_success_at=CURRENT_TIMESTAMP,last_error='',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(owned.id).run();
  return Response.json({accepted:1,received:false},{headers:{'Cache-Control':'no-store'}});
}
