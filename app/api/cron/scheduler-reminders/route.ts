import { runSchedulerPushWorker } from '../../../scheduler-push-worker';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 });
  try {
    const result = await runSchedulerPushWorker();
    return Response.json(result, { status: result.failed ? 207 : 200, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Scheduler reminders unavailable. Pending reminders are retained until their deadline or 24-hour expiry.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
