import type { PostgresD1Adapter } from '../db/postgres-adapter';
import { dispatchDailyLogStatements } from './dispatch-daily-log';
import { parseDispatchJson, parseDispatchText, type DispatchIncident } from './dispatch-email';

type EmailSummary = { id?: string; from?: string; to?: string[]; subject?: string; created_at?: string };
export type RecoveryConfig = { apiKey: string; from: string; to: string };
const MAX_AGE = 48 * 60 * 60 * 1000;
const ALERT_AGE = 5 * 60 * 1000;

export function isFreshDispatch(dispatchedAt: string, now = Date.now()) {
  const age = now - Date.parse(dispatchedAt);
  return Number.isFinite(age) && age >= -60_000 && age < ALERT_AGE;
}

export function resendReader(apiKey: string) {
  let nextRequest = 0;
  return async (path: string): Promise<Record<string, unknown>> => {
    // Resend's account-wide rate limit also serves the live webhook. Leave space
    // between recovery requests; a 429 is retried on the next scheduled run.
    const wait = nextRequest - Date.now();
    if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
    nextRequest = Date.now() + 750;
    const response = await fetch(`https://api.resend.com${path}`, {
      headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(6000), cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Resend retrieval failed (${response.status})`);
    return response.json();
  };
}

export async function readDispatchEmail(emailId: string, get: ReturnType<typeof resendReader>) {
  const email = await get(`/emails/receiving/${encodeURIComponent(emailId)}`);
  const attachments = Array.isArray(email.attachments) ? email.attachments as Array<Record<string, unknown>> : [];
  const json = attachments.find(item => String(item.filename || '').toLowerCase().endsWith('.json'));
  if (json?.id) {
    const attachment = await get(`/emails/receiving/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(String(json.id))}`);
    if (typeof attachment.download_url === 'string') {
      const response = await fetch(attachment.download_url, { signal: AbortSignal.timeout(6000) });
      if (!response.ok) throw new Error(`Dispatch attachment download failed (${response.status})`);
      const incident = parseDispatchJson(await response.json());
      if (incident) return { incident, attachmentCount: attachments.length };
    }
  }
  const html = String(email.html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&');
  const incident = parseDispatchText(String(email.text || '') || html);
  if (!incident) throw new Error('Received dispatch has no valid incident number, call type, or time');
  return { incident, attachmentCount: attachments.length };
}

export async function saveRecoveredDispatch(db: PostgresD1Adapter, emailId: string, incident: DispatchIncident, attachmentCount: number, now = Date.now()) {
  const fresh = isFreshDispatch(incident.dispatchedAt, now);
  const timeOut = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(incident.dispatchedAt)).replace(':', '');
  // A retry must never reopen a cleared call or overwrite authoritative CAD.
  // Incident + Daily Log commit together; a failed projection remains retryable.
  const insert = db.prepare(`WITH cad_push_enabled AS MATERIALIZED (SELECT ${fresh ? 'enable_cad_push_outbox()' : 'true'}) INSERT INTO dispatch_incidents (incident_id,resend_email_id,call_type,category,address,city,narrative,responding_units,longitude,latitude,dispatched_at,time_out,attachment_count,source_payload,received_at,active) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,? FROM cad_push_enabled ON CONFLICT(incident_id) DO NOTHING`).bind(
    incident.incidentId, emailId, incident.callType, incident.category, incident.address, incident.city, incident.narrative, incident.units, incident.longitude, incident.latitude, incident.dispatchedAt, timeOut, attachmentCount,
    JSON.stringify({ source: 'resend-recovery', emailId, recoveredAt: new Date(now).toISOString(), incident }), fresh ? 1 : 0,
  );
  const result = await db.batch([insert, ...dispatchDailyLogStatements(db, {
    reportNumber: incident.incidentId, dispatchedAt: incident.dispatchedAt, timeOut, respondingUnits: incident.units, address: incident.address, callType: incident.callType,
  })]);
  return { inserted: result[0].meta.changes > 0, fresh };
}

export async function recoverResendDispatches(db: PostgresD1Adapter, config: RecoveryConfig, now = Date.now(), get = resendReader(config.apiKey)) {
  const started = Date.now();
  const summaries: EmailSummary[] = [];
  let after = '';
  for (let page = 0; page < 3; page++) {
    const list = await get(`/emails/receiving?limit=100${after ? `&after=${encodeURIComponent(after)}` : ''}`);
    const data = Array.isArray(list.data) ? list.data as EmailSummary[] : [];
    summaries.push(...data);
    const last = data.at(-1);
    if (!list.has_more || !last?.id || Date.parse(last.created_at || '') < now - MAX_AGE) break;
    after = last.id;
  }
  const candidates = summaries.filter(email => email.id && (email.from || '').trim().toLowerCase() === config.from.trim().toLowerCase()
    && (email.to || []).some(to => to.trim().toLowerCase() === config.to.trim().toLowerCase())
    && (email.subject || '').startsWith('[BRYX Dispatch] STIF') && Date.parse(email.created_at || '') >= now - MAX_AGE);
  if (!candidates.length) return { checked: 0, recovered: 0, historical: 0, failed: 0, pending: 0 };
  const { results } = await db.prepare(`SELECT resend_email_id FROM dispatch_incidents WHERE resend_email_id IN (${candidates.map(() => '?').join(',')})`).bind(...candidates.map(email => email.id!)).all<{ resend_email_id: string }>();
  const saved = new Set(results.map(row => row.resend_email_id));
  const missing = candidates.filter(email => !saved.has(email.id!));
  // Newest first so a large historical backlog never delays a fresh dispatch.
  missing.sort((a, b) => Date.parse(b.created_at || '') - Date.parse(a.created_at || ''));
  let recovered = 0, historical = 0, failed = 0, attempted = 0;
  for (const summary of missing.slice(0, 20)) {
    if (Date.now() - started > 35_000) break;
    attempted++;
    try {
      const { incident, attachmentCount } = await readDispatchEmail(summary.id!, get);
      const result = await saveRecoveredDispatch(db, summary.id!, incident, attachmentCount, now);
      if (result.inserted) { recovered++; if (!result.fresh) historical++; }
    } catch {
      failed++;
      // No email body, patient information, or credentials in infrastructure logs.
      console.error('Dispatch recovery: one received email remains pending.');
    }
  }
  return { checked: candidates.length, recovered, historical, failed, pending: missing.length - attempted + failed };
}

// Called only when recovery actually finds a missed call. Never logs secrets.
export async function dispatchWebhookHealth(apiKey: string, secret: string) {
  const get = resendReader(apiKey);
  const list = await get('/webhooks');
  const hooks = (Array.isArray(list.data) ? list.data : []) as Array<{ id: string; endpoint: string }>;
  const matches = [];
  for (const hook of hooks.filter(h => h.endpoint === 'https://stickney-firehouse-manager.vercel.app/api/resend-dispatch')) {
    const detail = await get(`/webhooks/${encodeURIComponent(hook.id)}`);
    matches.push({ id: hook.id, status: detail.status, matchesConfiguredKey: Boolean(secret) && detail.signing_secret === secret });
  }
  return matches;
}
