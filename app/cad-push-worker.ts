import 'server-only';
import { after } from 'next/server';
import { createPostgresD1Adapter } from '../db/postgres-adapter';
import { getSupabaseSystemClient } from './supabase-system';
import { portalServerHeaders } from './portal-server-headers';
import { deliverCadPush, webPushPublicConfig } from './cad-push';
import { drainCadPush, type PushJob, type PushDeliveryStore } from './cad-push-delivery';

function database() {
  return createPostgresD1Adapter(getSupabaseSystemClient, 'firehouse_server_sql', portalServerHeaders()['x-firehouse-server-key']);
}
const store: PushDeliveryStore = {
  async claim(incidentId) {
    const encoded = incidentId === undefined ? null : Buffer.from(incidentId).toString('base64');
    const { results } = await database().prepare("SELECT claim_cad_push(50, convert_from(decode(?, 'base64'), 'UTF8')) AS job").bind(encoded).all<{ job: PushJob }>();
    return results.map(row => row.job);
  },
  async finish(outcomes) {
    const encoded = Buffer.from(JSON.stringify(outcomes)).toString('base64');
    await database().prepare('SELECT finish_cad_push_batch(?) AS changed').bind(encoded).first();
  },
};
export async function runCadPushWorker(incidentId?: string) {
  if (!webPushPublicConfig().configured) throw new Error('Push delivery is not configured');
  return drainCadPush(store, deliverCadPush, incidentId);
}
export function scheduleCadPushDelivery(incidentId: string) {
  // The trigger has already committed the work with the call. after starts normal
  // delivery now; the independent recovery cron handles a lost server invocation.
  try {
    after(async () => {
      try { await runCadPushWorker(incidentId); }
      catch { console.error('CAD push pending: immediate worker unavailable; recovery will retry.'); }
    });
  } catch {
    console.error('CAD push pending: immediate worker could not start; recovery will retry.');
  }
}
