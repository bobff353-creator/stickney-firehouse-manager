import { ensureDatabase } from '../../../../db/bootstrap';
import { evaluatePreplanExpirations } from '../../../preplans/expiration-evaluator';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) return new Response('Unauthorized', { status: 401 });
  // Existing preplan-expiration job is preserved and no longer refreshes news.
  const result = await evaluatePreplanExpirations(await ensureDatabase());
  return Response.json({ ok: true, refreshedAt: new Date().toISOString(), preplanExpirationReview: {
    expired: result.expired.length, upcoming: result.upcoming.length, invalid: result.invalid.length, reviewCount: result.reviewCount,
  } }, { headers: { 'Cache-Control': 'no-store' } });
}
