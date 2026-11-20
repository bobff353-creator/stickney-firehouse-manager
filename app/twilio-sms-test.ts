import 'server-only';
import { createHash } from 'node:crypto';
import type { PostgresD1Adapter } from '../db/postgres-adapter';

export const smsTestDepartment = '14a76771-4c24-481b-8def-e6cce005c17b';
export const smsTestRecipientLabel = 'Phone ending 5300';
const approvedRecipientHash = '0e0e5735cee15a71fa9f0381af3f6ed68365a64ad10a23d78d8dace9aa24d917';
export const smsTrialTemplate = 'sms_customer_support';
export type SmsTestReceipt = { requestId: string; departmentId: string; actor: string; recipient: string;
  attemptedAt: string; status: 'Reserved' | 'Accepted' | 'Sent' | 'Delivered' | 'Failed' | 'Unconfirmed'; providerId?: string; errorCode?: number };
export function smsTestRunId(env: NodeJS.ProcessEnv = process.env) {
  const id = env.TWILIO_SMS_TEST_RUN_ID ?? '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : null;
}
export function smsTestConfig(env: NodeJS.ProcessEnv = process.env) {
  const requestId = smsTestRunId(env), account = env.TWILIO_SMS_TEST_ACCOUNT_SID ?? '', token = env.TWILIO_SMS_TEST_AUTH_TOKEN ?? '', to = env.TWILIO_SMS_TEST_TO ?? '', from = env.TWILIO_SMS_TEST_FROM ?? '';
  const expires = Date.parse(env.TWILIO_SMS_TEST_EXPIRES_AT ?? '');
  if (env.TWILIO_SMS_TEST_ENABLED !== 'true' || !requestId || !Number.isFinite(expires) || expires <= Date.now() ||
    !/^AC[0-9a-f]{32}$/i.test(account) || !/^[0-9a-f]{32}$/i.test(token) ||
    !/^\+[1-9]\d{7,14}$/.test(from) || createHash('sha256').update(to).digest('hex') !== approvedRecipientHash) return null;
  return { requestId, account, token, to, from };
}
type Config = NonNullable<ReturnType<typeof smsTestConfig>>;
const key = (id: string) => `twilio-sms-test:${smsTestDepartment}:${id}`;
export async function readSmsTest(db: PostgresD1Adapter, id: string) {
  const row = await db.prepare('SELECT value FROM system_meta WHERE key=?').bind(key(id)).first<{value:string}>();
  return row ? JSON.parse(row.value) as SmsTestReceipt : null;
}
async function save(db: PostgresD1Adapter, receipt: SmsTestReceipt, previous?: string) {
  const values = [JSON.stringify(receipt),new Date().toISOString(),key(receipt.requestId)];
  const result = previous === undefined
    ? await db.prepare('UPDATE system_meta SET value=?,updated_at=? WHERE key=?').bind(...values).run()
    : await db.prepare('UPDATE system_meta SET value=?,updated_at=? WHERE key=? AND value=?').bind(...values,previous).run();
  return result.meta.changes === 1;
}
async function provider(config: Config, path: string, send: typeof fetch, body?: URLSearchParams) {
  return send(`https://api.twilio.com/2010-04-01/Accounts/${config.account}${path}`, {
    method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: {Authorization:`Basic ${Buffer.from(`${config.account}:${config.token}`).toString('base64')}`,
      ...(body ? {'Content-Type':'application/x-www-form-urlencoded'} : {})}, ...(body ? {body:body.toString()} : {}) });
}
function applyMessage(receipt: SmsTestReceipt, message: Record<string,unknown>, config: Config) {
  if (message.account_sid !== config.account || message.to !== config.to || !/^SM[0-9a-f]{32}$/i.test(String(message.sid)) ||
    (receipt.providerId && message.sid !== receipt.providerId)) return;
  receipt.providerId = String(message.sid);
  const status = String(message.status);
  // A late queued/sent response must never erase a terminal delivery fact.
  if (receipt.status === 'Delivered' || receipt.status === 'Failed') return;
  if (status === 'delivered') receipt.status = 'Delivered';
  else if (['failed','undelivered','canceled'].includes(status)) receipt.status = 'Failed';
  else if (status === 'sent') receipt.status = 'Sent';
  else if (['queued','accepted','sending','scheduled'].includes(status)) receipt.status = 'Accepted';
  if (typeof message.error_code === 'number') receipt.errorCode = message.error_code;
}
export async function sendSmsTest(db: PostgresD1Adapter, actor: string, config: Config, send: typeof fetch = fetch) {
  const receipt: SmsTestReceipt = {requestId:config.requestId,departmentId:smsTestDepartment,actor,
    recipient:smsTestRecipientLabel,attemptedAt:new Date().toISOString(),status:'Reserved'};
  const claim = await db.prepare('INSERT INTO system_meta(key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO NOTHING')
    .bind(key(config.requestId),JSON.stringify(receipt),receipt.attemptedAt).run();
  if (claim.meta.changes !== 1) return {receipt:await readSmsTest(db,config.requestId),replayed:true};
  receipt.status = 'Unconfirmed';
  try {
    // Refuse paid/upgraded accounts. No provisioning, purchase or billing API exists here.
    const accountResponse = await provider(config,'.json',send);
    const account = accountResponse.ok ? await accountResponse.json() : null;
    if (!account || account.sid !== config.account || account.type !== 'Trial' || account.status !== 'active') {
      receipt.status = 'Failed';
    } else {
      // Use the Twilio-assigned trial sender. No custom content, links, records or attachments.
      const response = await provider(config,'/Messages.json',send,new URLSearchParams({To:config.to,From:config.from,Body:smsTrialTemplate}));
      if (response.status === 201) applyMessage(receipt,await response.json(),config);
      else if (response.status >= 400 && response.status < 500) receipt.status = 'Failed';
    }
  } catch { /* Never expose provider bodies, tokens, phone numbers or credential errors. */ }
  await save(db,receipt);
  return {receipt,replayed:false};
}
export async function refreshSmsTest(db: PostgresD1Adapter, config: Config, send: typeof fetch = fetch) {
  const receipt = await readSmsTest(db,config.requestId);
  if (!receipt?.providerId || ['Delivered','Failed'].includes(receipt.status)) return receipt;
  const previous = JSON.stringify(receipt);
  let message: Record<string,unknown>;
  try {
    const response = await provider(config,`/Messages/${receipt.providerId}.json`,send);
    if (!response.ok) return receipt;
    message = await response.json();
  } catch {return receipt; /* Refresh only reads provider status; it never resends. */}
  applyMessage(receipt,message,config);
  if (!(await save(db,receipt,previous))) return readSmsTest(db,config.requestId);
  return receipt;
}
