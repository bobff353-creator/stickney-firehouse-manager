import { runCadPushWorker } from '../../../cad-push-worker';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 });
  try {
    const result = await runCadPushWorker();
    return Response.json(result, { status: result.failed ? 207 : 200, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Push recovery unavailable. Pending jobs are retained until their five-minute expiry.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
