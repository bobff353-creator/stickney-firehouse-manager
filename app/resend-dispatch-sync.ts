import type { ensureDatabase } from "../db/bootstrap";
import { parseDispatchText } from "./dispatch-email";
import { projectDispatchIntoDailyLog } from "./dispatch-daily-log";

type Database = Awaited<ReturnType<typeof ensureDatabase>>;
type RuntimeEnv = {
  RESEND_API_KEY?: string;
  DISPATCH_EMAIL_FROM?: string;
  DISPATCH_EMAIL_TO?: string;
};
type ReceivedEmailSummary = {
  id?: string;
  from?: string;
  to?: string[];
  subject?: string;
  created_at?: string;
};

function plainText(html: string) {
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+\n/g, "\n").trim();
}

function chicagoMilitaryTime(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  return `${parts.find((part) => part.type === "hour")?.value || "00"}${parts.find((part) => part.type === "minute")?.value || "00"}`;
}

async function resendGet(path: string, apiKey: string) {
  const response = await fetch(`https://api.resend.com${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error(`Resend retrieval failed (${response.status})`);
  return response.json() as Promise<Record<string, unknown>>;
}

export async function syncRecentResendDispatches(db: Database) {
  const runtime = process.env as RuntimeEnv;
  if (!runtime.RESEND_API_KEY || !runtime.DISPATCH_EMAIL_FROM || !runtime.DISPATCH_EMAIL_TO) return;

  const list = await resendGet("/emails/receiving", runtime.RESEND_API_KEY);
  const approvedSender = runtime.DISPATCH_EMAIL_FROM.trim().toLowerCase();
  const approvedRecipient = runtime.DISPATCH_EMAIL_TO.trim().toLowerCase();
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const candidates = (Array.isArray(list.data) ? list.data as ReceivedEmailSummary[] : [])
    .filter((email) =>
      email.id &&
      (email.from || "").trim().toLowerCase() === approvedSender &&
      (email.to || []).some((recipient) => recipient.trim().toLowerCase() === approvedRecipient) &&
      (email.subject || "").startsWith("[BRYX Dispatch] STIF") &&
      Date.parse(email.created_at || "") >= cutoff
    )
    .slice(0, 20)
    .reverse();

  for (const summary of candidates) {
    const emailId = summary.id || "";
    const existing = await db.prepare("SELECT incident_id FROM dispatch_incidents WHERE resend_email_id = ? LIMIT 1").bind(emailId).first();
    if (existing) continue;
    const email = await resendGet(`/emails/receiving/${encodeURIComponent(emailId)}`, runtime.RESEND_API_KEY);
    const incident = parseDispatchText(String(email.text || "") || plainText(String(email.html || "")));
    if (!incident) continue;
    const timeOut = chicagoMilitaryTime(incident.dispatchedAt);
    const attachmentCount = Array.isArray(email.attachments) ? email.attachments.length : 0;
    await db.prepare(
      "INSERT INTO dispatch_incidents (incident_id, resend_email_id, call_type, category, address, city, narrative, responding_units, longitude, latitude, dispatched_at, time_out, attachment_count, source_payload, received_at, cleared_at, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, NULL, 1) ON CONFLICT(incident_id) DO UPDATE SET resend_email_id=excluded.resend_email_id, call_type=excluded.call_type, category=excluded.category, address=excluded.address, city=excluded.city, narrative=excluded.narrative, responding_units=excluded.responding_units, longitude=excluded.longitude, latitude=excluded.latitude, dispatched_at=excluded.dispatched_at, time_out=excluded.time_out, attachment_count=excluded.attachment_count, source_payload=excluded.source_payload, received_at=CURRENT_TIMESTAMP, cleared_at=NULL, active=1"
    ).bind(
      incident.incidentId,
      emailId,
      incident.callType,
      incident.category,
      incident.address,
      incident.city,
      incident.narrative,
      incident.units,
      incident.longitude,
      incident.latitude,
      incident.dispatchedAt,
      timeOut,
      attachmentCount,
      JSON.stringify({ source: "resend-text", emailId, incident }),
    ).run();
    await projectDispatchIntoDailyLog(db, {
      reportNumber: incident.incidentId,
      dispatchedAt: incident.dispatchedAt,
      timeOut,
      respondingUnits: incident.units,
      address: incident.address,
      callType: incident.callType,
    });
  }
}
