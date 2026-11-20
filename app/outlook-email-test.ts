import 'server-only';
import type { PostgresD1Adapter } from '../db/postgres-adapter';

export const outlookTestRecipient = 'bwyant@stickneyfire.com';
export const outlookTestDepartment = '14a76771-4c24-481b-8def-e6cce005c17b';
export type OutlookTestReceipt = {
  requestId: string; departmentId: string; recipient: string; actor: string;
  status: 'Reserved' | 'Accepted' | 'Unconfirmed'; attemptedAt: string;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function outlookTestConfig(env: NodeJS.ProcessEnv = process.env) {
  if (env.OUTLOOK_EMAIL_TEST_ENABLED !== 'true' || !uuid.test(env.OUTLOOK_EMAIL_TEST_RUN_ID ?? '')) return null;
  try {
    const url = new URL(env.OUTLOOK_EMAIL_TEST_WEBHOOK_URL ?? '');
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash ||
      !(/^[a-z0-9-]+(?:\.[a-z0-9-]+)?\.environment\.api\.powerplatform\.com$/.test(url.hostname) || /^[a-z0-9.-]+\.logic\.azure\.com$/.test(url.hostname)) ||
      !url.searchParams.get('sig')) return null;
    return { url: url.toString(), requestId: env.OUTLOOK_EMAIL_TEST_RUN_ID! };
  } catch { return null; }
}

function receiptKey(requestId: string) { return `outlook-email-test:${outlookTestDepartment}:${requestId}`; }
export async function readOutlookTest(db: PostgresD1Adapter, requestId: string) {
  const row = await db.prepare('SELECT value FROM system_meta WHERE key=?').bind(receiptKey(requestId)).first<{value: string}>();
  return row ? JSON.parse(row.value) as OutlookTestReceipt : null;
}

// A deployment authorizes one attempt, not one per browser, process or click.
// Reserve durably BEFORE contacting Outlook. A lost response never permits a resend.
export async function sendOutlookTest(db: PostgresD1Adapter, actor: string, config: NonNullable<ReturnType<typeof outlookTestConfig>>, send: typeof fetch = fetch) {
  const receipt: OutlookTestReceipt = { requestId: config.requestId, departmentId: outlookTestDepartment,
    recipient: outlookTestRecipient, actor, status: 'Reserved', attemptedAt: new Date().toISOString() };
  const claimed = await db.prepare('INSERT INTO system_meta(key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO NOTHING')
    .bind(receiptKey(config.requestId), JSON.stringify(receipt), receipt.attemptedAt).run();
  if (claimed.meta.changes !== 1) return { receipt: await readOutlookTest(db, config.requestId), replayed: true };
  receipt.status = 'Unconfirmed';
  try {
    // No caller-provided recipient, message, record, attachment or retry policy.
    const response = await send(config.url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: config.requestId, testOnly: true }) });
    // Only a completed, explicit flow response counts as acceptance. A 202 alone
    // says the flow was queued; it does not prove the Outlook action succeeded.
    if (response.status === 200) {
      const body = await response.text();
      if (body.length <= 2048) {
        const result = JSON.parse(body);
        if (result.status === 'Accepted' && result.recipient === outlookTestRecipient && result.requestId === config.requestId) receipt.status = 'Accepted';
      }
    }
  } catch { /* Provider URLs and exception messages can contain credentials. */ }
  await db.prepare('UPDATE system_meta SET value=?,updated_at=? WHERE key=?')
    .bind(JSON.stringify(receipt), new Date().toISOString(), receiptKey(config.requestId)).run();
  return { receipt, replayed: false };
}
