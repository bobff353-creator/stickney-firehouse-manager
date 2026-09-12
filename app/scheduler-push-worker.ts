import 'server-only';
import { after } from 'next/server';
import { createPostgresD1Adapter } from '../db/postgres-adapter';
import { getSupabaseSystemClient } from './supabase-system';
import { portalServerHeaders } from './portal-server-headers';
import { deliverSchedulerPush, webPushPublicConfig } from './cad-push';
import { drainSchedulerPush, type SchedulerPushJob } from './scheduler-push-delivery';

export async function runSchedulerPushWorker() {
  if (!webPushPublicConfig().configured) throw new Error('Push delivery is not configured');
  const db = createPostgresD1Adapter(getSupabaseSystemClient, 'firehouse_server_sql', portalServerHeaders()['x-firehouse-server-key']);
  return drainSchedulerPush({
    enqueue: () => db.prepare('SELECT enqueue_scheduler_push() AS count').first(),
    claim: async () => (await db.prepare('SELECT claim_scheduler_push() AS job').all<{ job: SchedulerPushJob }>()).results.map(row => row.job),
    finish: outcomes => db.prepare('SELECT finish_scheduler_push_batch(?) AS count').bind(Buffer.from(JSON.stringify(outcomes)).toString('base64')).first(),
  }, job => deliverSchedulerPush(job, job.payload, job.ttl));
}
export function scheduleSchedulerPushDelivery() {
  try {
    after(async () => {
      try { await runSchedulerPushWorker(); }
      catch { console.error('Scheduler push pending: background recovery will retry.'); }
    });
  } catch { console.error('Scheduler push pending: immediate worker unavailable.'); }
}
