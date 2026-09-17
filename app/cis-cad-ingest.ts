import { createHash } from 'node:crypto';
import type { ensureDatabase } from '../db/bootstrap';
import { parseCisCadPayload } from './cis-cad';
import { reduceCisEvent, type CisState } from './cis-cad-routing';
import { cisSettingsKey, encodeCisRecord, readCisSettings } from './cis-cad-store';
import { dispatchDailyLogStatements } from './dispatch-daily-log';

type Database = Awaited<ReturnType<typeof ensureDatabase>>;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
function militaryTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)).replace(':', '');
}

export async function ingestCisDelivery(db: Database, body: string, contentType: string) {
  const parsed = parseCisCadPayload(body, contentType);
  for (let attempt = 0; attempt < 3; attempt++) {
    const config = await readCisSettings(db);
    if (config.settings.mode === 'disabled' || !config.value) return { httpStatus: 503, accepted: false, error: 'CIS delivery is disabled. The existing CAD-email feed is unchanged.' };
    const event = parsed.ok ? parsed.incident : null;
    const mode = config.settings.mode;
    const dedupeKey = hash(`${mode}:${event?.incidentId || ''}:${event?.eventId || hash(body)}`);
    const priorReceipt = await db.prepare("SELECT id,status,error_message error FROM cad_inbound_receipts WHERE provider='cis' AND dedupe_key=? LIMIT 1").bind(dedupeKey).first<{ id: string; status: string; error: string }>();
    if (priorReceipt) return { httpStatus: priorReceipt.status === 'rejected' ? 422 : 200, accepted: priorReceipt.status !== 'rejected', duplicate: true, receiptId: priorReceipt.id, status: priorReceipt.status, error: priorReceipt.error || undefined };
    const stateKey = `cis-incident:${mode}:${hash(event?.incidentId || '')}`;
    const saved = event ? await db.prepare('SELECT value FROM system_meta WHERE key=? LIMIT 1').bind(stateKey).first<{ value: string }>() : null;
    const previous: CisState | null = saved ? JSON.parse(Buffer.from(saved.value, 'base64').toString('utf8')) : null;
    const dispatch = mode === 'live' && event ? await db.prepare('SELECT source_payload sourcePayload,active,cleared_at clearedAt,call_type callType,category,address,city,narrative,responding_units respondingUnits,longitude,latitude,dispatched_at dispatchedAt,time_out timeOut FROM dispatch_incidents WHERE incident_id=? LIMIT 1').bind(event.incidentId).first<{ sourcePayload: string; active: number; clearedAt: string | null; callType: string; category: string; address: string; city: string; narrative: string; respondingUnits: string; longitude: number | null; latitude: number | null; dispatchedAt: string; timeOut: string }>() : null;
    // A full incident closure can arrive during the email-to-CIS handoff.
    // Retain that incident's existing details; it must not remain active just
    // because the vendor clear packet omits the original dispatch timestamp.
    const closingEmail = Boolean(!previous && dispatch && event?.eventType === 'close');
    const input = closingEmail && event && dispatch ? { ...event, callType: dispatch.callType, category: dispatch.category, address: dispatch.address, city: dispatch.city, narrative: dispatch.narrative, longitude: dispatch.longitude, latitude: dispatch.latitude, dispatchedAt: dispatch.dispatchedAt, timeOut: dispatch.timeOut } : event;
    let decision = input ? reduceCisEvent(previous, input, config.settings) : { status: 'rejected' as const, reason: parsed.ok ? 'Invalid incident.' : parsed.error };
    if (!previous && event?.eventType === 'update' && decision.status === 'rejected' && decision.reason.startsWith('An update arrived')) {
      // Do not permanently dedupe a retryable, out-of-order first delivery.
      return { httpStatus: 409, accepted: false, error: 'Initial incident has not arrived. Retry this event after the full incident snapshot.' };
    }
    // A record closed by a human or by the email path is also terminal.
    if (decision.status !== 'rejected' && dispatch && (!dispatch.active || dispatch.clearedAt)) decision = { status: 'ignored', reason: 'The operational incident is already closed.' };
    const receiptId = crypto.randomUUID();
    const applied = decision.status === 'applied' ? decision.state : null;
    const status = applied ? mode === 'shadow' ? 'shadow' : 'accepted' : decision.status;
    const reason = decision.status === 'applied' ? (decision.state.unmappedUnits.length ? `Unmapped units: ${decision.state.unmappedUnits.join(', ')}` : '') : decision.reason;
    const statements = [
      // Compare-and-swap guards run inside ONE existing PostgreSQL transaction.
      // No partial receipt, stale merge, signal, Daily Log write or push outbox survives a conflict.
      db.prepare('UPDATE system_meta SET value=value WHERE key=? AND value=?').bind(cisSettingsKey, config.value).expectChanges(1),
      db.prepare("INSERT INTO cad_inbound_receipts (id,provider,dedupe_key,external_event_id,external_incident_id,event_type,payload_format,raw_payload,normalized_payload,status,error_message,received_at,processed_at) VALUES (?,'cis',?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(provider,dedupe_key) DO NOTHING").bind(receiptId, dedupeKey, event?.eventId || '', event?.incidentId || '', event?.eventType || '', parsed.format, body, JSON.stringify({ mode, result: applied || null }), status, reason).expectChanges(1),
    ];
    if (applied) {
      const value = encodeCisRecord(applied);
      statements.push(saved
        ? db.prepare('UPDATE system_meta SET value=?,updated_at=CURRENT_TIMESTAMP WHERE key=? AND value=?').bind(value, stateKey, saved.value).expectChanges(1)
        : db.prepare('INSERT INTO system_meta (key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING').bind(stateKey, value).expectChanges(1));
      if (mode === 'live' && applied.dispatchedAt) {
        const timeOut = applied.timeOut || militaryTime(applied.dispatchedAt);
        const serialized = JSON.stringify(applied);
        const respondingUnits = closingEmail && dispatch ? dispatch.respondingUnits : applied.respondingUnits;
        const active = applied.closed ? 0 : 1;
        statements.push(db.prepare('SELECT enable_cad_push_outbox()'));
        if (dispatch) {
          statements.push(db.prepare("UPDATE dispatch_incidents SET call_type=?,category=?,address=?,city=?,narrative=?,responding_units=?,longitude=?,latitude=?,dispatched_at=?,time_out=?,source_payload=?,source_system='CIS CAD',received_at=CURRENT_TIMESTAMP,cleared_at=CASE WHEN ?=0 THEN CURRENT_TIMESTAMP ELSE NULL END,active=? WHERE incident_id=? AND source_payload=? AND active=? AND cleared_at IS NULL").bind(applied.callType || 'CAD incident', applied.category, applied.address, applied.city, applied.narrative, respondingUnits, applied.longitude, applied.latitude, applied.dispatchedAt, timeOut, serialized, active, active, applied.incidentId, dispatch.sourcePayload, dispatch.active).expectChanges(1));
        } else {
          statements.push(db.prepare("INSERT INTO dispatch_incidents (incident_id,resend_email_id,call_type,category,address,city,narrative,responding_units,longitude,latitude,dispatched_at,time_out,source_payload,source_system,active,cleared_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'CIS CAD',?,CASE WHEN ?=0 THEN CURRENT_TIMESTAMP ELSE NULL END) ON CONFLICT(incident_id) DO NOTHING").bind(applied.incidentId, `cis-${applied.incidentId}`, applied.callType || 'CAD incident', applied.category, applied.address, applied.city, applied.narrative, applied.respondingUnits, applied.longitude, applied.latitude, applied.dispatchedAt, timeOut, serialized, active, active).expectChanges(1));
        }
        if (!closingEmail) statements.push(...dispatchDailyLogStatements(db, { ...applied, respondingUnits: applied.involvedUnits.join(', '), reportNumber: applied.incidentId, timeOut }, true));
        if (applied.closed) {
          const timeIn = /^\d{4}$/.test(applied.timeIn) && Number(applied.timeIn.slice(0, 2)) < 24 && Number(applied.timeIn.slice(2)) < 60 ? applied.timeIn : applied.eventAt ? militaryTime(applied.eventAt) : '';
          // Preserve a return time already entered by a member. Never invent one from receipt time.
          if (timeIn) statements.push(db.prepare("UPDATE daily_log_calls SET time_in=? WHERE report_number=? AND trim(time_in)=''").bind(timeIn, applied.incidentId));
        }
      }
    }
    try {
      if (statements.some(statement => statement.batchPayload().sql.length > 200000)) return { httpStatus: 422, accepted: false, error: 'The merged incident is too large for a safe transaction. Shorten the narrative or send a smaller full snapshot.' };
      await db.batch(statements);
      return { httpStatus: status === 'rejected' ? 422 : 200, accepted: status !== 'rejected', receiptId, status, incidentId: event?.incidentId, error: status === 'rejected' ? reason : undefined, pushIncidentId: applied && !applied.closed && mode === 'live' ? applied.incidentId : undefined };
    } catch (error) {
      if (attempt === 2 || !(error instanceof Error) || !error.message.includes('SAVE_CONFLICT')) throw error;
    }
  }
  throw new Error('CIS delivery could not be committed; retry the delivery.');
}
