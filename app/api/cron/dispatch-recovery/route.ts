import { createPostgresD1Adapter } from '../../../../db/postgres-adapter';
import { getSupabaseSystemClient } from '../../../supabase-system';
import { portalServerHeaders } from '../../../portal-server-headers';
import { recoverResendDispatches, dispatchWebhookHealth } from '../../../resend-dispatch-recovery';
import { runCadPushWorker } from '../../../cad-push-worker';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 });
  const { RESEND_API_KEY: apiKey, DISPATCH_EMAIL_FROM: from, DISPATCH_EMAIL_TO: to } = process.env;
  if (!apiKey || !from || !to) return Response.json({ error: 'Incoming dispatch recovery is not configured' }, { status: 503 });
  try {
    const db = createPostgresD1Adapter(getSupabaseSystemClient, 'firehouse_server_sql', portalServerHeaders()['x-firehouse-server-key']);
    const result = await recoverResendDispatches(db, { apiKey, from, to });
    console.info('Dispatch recovery result', JSON.stringify(result));
    if (result.recovered) {
      try { console.info('Dispatch webhook health', JSON.stringify(await dispatchWebhookHealth(apiKey, process.env.RESEND_WEBHOOK_SECRET || ''))); }
      catch { console.error('Dispatch webhook health check unavailable'); }
    }
    // Keep the independent push retry schedule even when email retrieval fails.
    if (result.recovered > result.historical) await runCadPushWorker();
    return Response.json(result, { status: result.failed ? 207 : 200, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    console.error('Dispatch recovery unavailable; received emails remain at Resend for the next retry.');
    return Response.json({ error: 'Incoming dispatch recovery unavailable' }, { status: 503 });
  }
}
