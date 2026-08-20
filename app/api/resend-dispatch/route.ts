import { createPostgresD1Adapter } from "../../../db/postgres-adapter";
import { projectDispatchIntoDailyLog } from "../../dispatch-daily-log";
import { parseDispatchJson, parseDispatchText, type DispatchIncident } from "../../dispatch-email";
import { getSupabaseSystemClient } from "../../supabase-system";
import { sendCadPushNotifications } from "../../cad-push";

type ResendEvent = {
  type?: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string[];
    subject?: string;
    attachments?: Array<{ id?: string; filename?: string; content_type?: string }>;
  };
};

type RuntimeEnv = {
  RESEND_API_KEY?: string;
  RESEND_WEBHOOK_SECRET?: string;
  DISPATCH_EMAIL_FROM?: string;
  DISPATCH_EMAIL_TO?: string;
  FIREHOUSE_DATABASE_SECRET?: string;
};

function cleanDatabaseSecret(value: string | undefined) {
  let cleaned = value?.replace(/[\uFEFF\r\n]/g, "").trim() ?? "";
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
}

function safeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index++) mismatch |= left[index] ^ right[index];
  return mismatch === 0;
}

async function verifyWebhook(body: string, headers: Headers, secret: string) {
  const id = headers.get("svix-id") || "", timestamp = headers.get("svix-timestamp") || "", signatures = headers.get("svix-signature") || "";
  if (!id || !timestamp || !signatures || !secret.startsWith("whsec_")) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const keyBytes = Uint8Array.from(atob(secret.slice(6)), (character) => character.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`)));
  return signatures.split(" ").some((item) => {
    const [, encoded] = item.split(",", 2);
    if (!encoded) return false;
    try { return safeEqual(digest, Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))); } catch { return false; }
  });
}

async function resendGet(path: string, apiKey: string) {
  const response = await fetch(`https://api.resend.com${path}`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!response.ok) throw new Error(`Resend retrieval failed (${response.status})`);
  return response.json() as Promise<Record<string, unknown>>;
}

function plainText(html: string) {
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+\n/g, "\n").trim();
}

function chicagoMilitaryTime(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  return `${parts.find((part) => part.type === "hour")?.value || "00"}${parts.find((part) => part.type === "minute")?.value || "00"}`;
}

async function retrieveIncident(event: ResendEvent, apiKey: string): Promise<{ incident: DispatchIncident; attachmentCount: number }> {
  const emailId = event.data?.email_id;
  if (!emailId) throw new Error("Received email event is missing email_id");
  const email = await resendGet(`/emails/receiving/${encodeURIComponent(emailId)}`, apiKey);
  const attachments = Array.isArray(email.attachments) ? email.attachments as Array<Record<string, unknown>> : event.data?.attachments ?? [];
  const jsonAttachment = attachments.find((item) => String(item.filename || "").toLowerCase().endsWith(".json"));
  if (jsonAttachment?.id) {
    const attachment = await resendGet(`/emails/receiving/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(String(jsonAttachment.id))}`, apiKey);
    const downloadUrl = String(attachment.download_url || "");
    if (downloadUrl) {
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error(`Dispatch attachment download failed (${response.status})`);
      const incident = parseDispatchJson(await response.json());
      if (incident) return { incident, attachmentCount: attachments.length };
    }
  }
  const incident = parseDispatchText(String(email.text || "") || plainText(String(email.html || "")));
  if (!incident) throw new Error("The dispatch email did not match the approved Stickney format");
  return { incident, attachmentCount: attachments.length };
}

export async function POST(request: Request) {
  try {
    const runtime = process.env as RuntimeEnv;
    const databaseSecret = cleanDatabaseSecret(runtime.FIREHOUSE_DATABASE_SECRET);
    if (!runtime.RESEND_API_KEY || !runtime.RESEND_WEBHOOK_SECRET || !runtime.DISPATCH_EMAIL_FROM || !runtime.DISPATCH_EMAIL_TO || !databaseSecret) {
      return Response.json({ error: "Dispatch email integration is not configured" }, { status: 503 });
    }
    const body = await request.text();
    if (!await verifyWebhook(body, request.headers, runtime.RESEND_WEBHOOK_SECRET)) {
      return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
    }
    const event = JSON.parse(body) as ResendEvent;
    if (event.type !== "email.received") return Response.json({ ignored: true });
    if ((event.data?.from || "").trim().toLowerCase() !== runtime.DISPATCH_EMAIL_FROM.trim().toLowerCase()) {
      return Response.json({ error: "Unapproved dispatch sender" }, { status: 403 });
    }
    const approvedRecipient = runtime.DISPATCH_EMAIL_TO.trim().toLowerCase();
    if (!(event.data?.to || []).some((recipient) => recipient.trim().toLowerCase() === approvedRecipient)) {
      return Response.json({ error: "Unapproved dispatch recipient" }, { status: 403 });
    }
    if (!(event.data?.subject || "").startsWith("[BRYX Dispatch] STIF")) {
      return Response.json({ ignored: true, reason: "Not a Stickney Bryx dispatch" });
    }
    const { incident, attachmentCount } = await retrieveIncident(event, runtime.RESEND_API_KEY);
    const db = createPostgresD1Adapter(
      getSupabaseSystemClient,
      "firehouse_server_sql",
      databaseSecret,
    );
    const timeOut = chicagoMilitaryTime(incident.dispatchedAt);
    const existing = await db.prepare(
      "SELECT incident_id FROM dispatch_incidents WHERE incident_id = ? LIMIT 1",
    ).bind(incident.incidentId).first<{ incident_id: string }>();
    await db.prepare(
      "INSERT INTO dispatch_incidents (incident_id, resend_email_id, call_type, category, address, city, narrative, responding_units, longitude, latitude, dispatched_at, time_out, attachment_count, source_payload, received_at, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 1) ON CONFLICT(incident_id) DO UPDATE SET call_type=excluded.call_type, category=excluded.category, address=excluded.address, city=excluded.city, narrative=excluded.narrative, responding_units=excluded.responding_units, longitude=excluded.longitude, latitude=excluded.latitude, dispatched_at=excluded.dispatched_at, time_out=excluded.time_out, attachment_count=excluded.attachment_count, source_payload=excluded.source_payload, received_at=CURRENT_TIMESTAMP"
    ).bind(incident.incidentId, event.data?.email_id || "", incident.callType, incident.category, incident.address, incident.city, incident.narrative, incident.units, incident.longitude, incident.latitude, incident.dispatchedAt, timeOut, attachmentCount, JSON.stringify(incident)).run();
    await projectDispatchIntoDailyLog(db, {
      reportNumber: incident.incidentId,
      dispatchedAt: incident.dispatchedAt,
      timeOut,
      respondingUnits: incident.units,
      address: incident.address,
      callType: incident.callType,
    });
    if (!existing) {
      await sendCadPushNotifications(db, {
        incidentId: incident.incidentId,
        callType: incident.callType,
        timeOut,
        narrative: incident.narrative,
      });
    }
    return Response.json({ accepted: true, incidentId: incident.incidentId });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to process dispatch email" }, { status: 500 });
  }
}
