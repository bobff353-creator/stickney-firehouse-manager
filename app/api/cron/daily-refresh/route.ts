import { backgroundDatabase } from '../../../background-database';
import { evaluatePreplanExpirations } from '../../../preplans/expiration-evaluator';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) return new Response('Unauthorized', { status: 401 });
  const db = backgroundDatabase();
  const id = crypto.randomUUID();
  try {
    await db.prepare("INSERT INTO background_job_runs (id,job_name,status,started_at) VALUES (?,'preplan-expiration','running',?)").bind(id, new Date().toISOString()).run();
    const result = await evaluatePreplanExpirations(db);
    const counts = { expired: result.expired.length, upcoming: result.upcoming.length, invalid: result.invalid.length, reviewCount: result.reviewCount };
    const finishedAt = new Date().toISOString();
    await db.prepare("UPDATE background_job_runs SET status='succeeded',finished_at=?,summary=? WHERE id=?").bind(finishedAt, `${counts.expired} expired · ${counts.upcoming} upcoming · ${counts.invalid} invalid dates.`, id).run();
    return Response.json({ ok: true, refreshedAt: finishedAt, preplanExpirationReview: counts }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    console.error('Preplan expiration job failed; check database connectivity and server credentials.');
    await db.prepare("UPDATE background_job_runs SET status='failed',finished_at=? WHERE id=?").bind(new Date().toISOString(), id).run().catch(() => undefined);
    return Response.json({ ok: false, error: 'The preplan check failed. Review background-job health and deployment logs.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
