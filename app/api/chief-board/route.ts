import { ensureDatabase } from "../../../db/bootstrap";

const ownerAdminEmails = ["bobff353@gmail.com", "bwyant@stickneyfire.com"];
const allowedTypes = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf", "text/plain",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const maxFiles = 5;
const maxFileBytes = 10 * 1024 * 1024;

type BoardBucket = {
  get(key: string): Promise<{ body: ReadableStream; httpEtag?: string; httpMetadata?: { contentType?: string } } | null>;
  put(key: string, value: ReadableStream, options: { httpMetadata: { contentType: string } }): Promise<unknown>;
  delete(key: string): Promise<void>;
};

type Runtime = {
  BUCKET?: BoardBucket;
  RESEND_API_KEY?: string;
  CHIEF_EVENT_EMAIL_FROM?: string;
  DISPATCH_EMAIL_TO?: string;
};

async function runtime() {
  const { env } = await import("@/app/cf-env");
  return env as unknown as Runtime;
}

async function isAdmin(request: Request, db: Awaited<ReturnType<typeof ensureDatabase>>) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  if (ownerAdminEmails.includes(email)) return true;
  if (!email) return false;
  const row = await db.prepare("SELECT is_admin AS isAdmin FROM employee_profiles WHERE lower(email) = ? LIMIT 1").bind(email).first<{ isAdmin: number }>();
  return Boolean(row?.isAdmin);
}

function cleanFilename(value: string) {
  return value.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "attachment";
}

function requiredDate(value: FormDataEntryValue | null, label: string) {
  const raw = String(value ?? "").trim();
  const timestamp = Date.parse(raw);
  if (!raw || Number.isNaN(timestamp)) throw new Error(`${label} is required.`);
  return new Date(timestamp).toISOString();
}

function optionalDate(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const timestamp = Date.parse(raw);
  if (Number.isNaN(timestamp)) throw new Error("Choose a valid end date and time.");
  return new Date(timestamp).toISOString();
}

function icsEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function icsUtc(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function calendarInvite(id: string, title: string, detail: string, startsAt: string, endsAt: string, organizer: string, attendee: string) {
  const stamp = icsUtc(new Date().toISOString());
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Stickney Fire Department//Chief Board//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${id}@stickney-fire`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsUtc(startsAt)}`,
    `DTEND:${icsUtc(endsAt)}`,
    `SUMMARY:${icsEscape(title)}`,
    `DESCRIPTION:${icsEscape(detail)}`,
    `ORGANIZER;CN=Stickney Fire Department:mailto:${organizer}`,
    `ATTENDEE;CN=${icsEscape(attendee)};RSVP=TRUE:mailto:${attendee}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

function base64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function emailFrom(config: Runtime) {
  if (config.CHIEF_EVENT_EMAIL_FROM) return config.CHIEF_EVENT_EMAIL_FROM;
  const receivingAddress = config.DISPATCH_EMAIL_TO?.trim();
  return receivingAddress ? `Stickney Fire Department <${receivingAddress}>` : "";
}

function addressOnly(value: string) {
  return value.match(/<([^>]+)>/)?.[1] ?? value;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

async function sendInvites(
  config: Runtime,
  event: { id: string; title: string; body: string; startsAt: string; endsAt: string },
  recipients: string[],
) {
  const from = emailFrom(config);
  if (!config.RESEND_API_KEY || !from) return { status: "not_configured", sent: 0, failed: recipients.length };
  let sent = 0;
  let failed = 0;
  const organizer = addressOnly(from);
  for (let index = 0; index < recipients.length; index += 5) {
    const results = await Promise.all(recipients.slice(index, index + 5).map(async (recipient) => {
      const invite = calendarInvite(event.id, event.title, event.body, event.startsAt, event.endsAt, organizer, recipient);
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            authorization: `Bearer ${config.RESEND_API_KEY}`,
            "content-type": "application/json",
            "idempotency-key": `chief-event/${event.id}/${recipient}`.slice(0, 256),
          },
          body: JSON.stringify({
            from,
            to: [recipient],
            subject: `Department event: ${event.title}`,
            text: `${event.title}\n\n${event.body}\n\nA calendar invitation is attached.`,
            html: `<h2>${escapeHtml(event.title)}</h2><p>${escapeHtml(event.body).replace(/\n/g, "<br>")}</p><p>A calendar invitation is attached.</p>`,
            attachments: [{ filename: "stickney-department-event.ics", content: base64(invite) }],
          }),
        });
        return response.ok;
      } catch {
        return false;
      }
    }));
    sent += results.filter(Boolean).length;
    failed += results.filter((result) => !result).length;
  }
  return { status: failed ? (sent ? "partial" : "failed") : "sent", sent, failed };
}

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    const canEdit = await isAdmin(request, db);
    const rows = await db.prepare(
      "SELECT id, item_type AS itemType, title, body, event_date AS eventDate, starts_at AS startsAt, ends_at AS endsAt, expires_at AS expiresAt, invite_status AS inviteStatus, created_by AS createdBy, created_at AS createdAt FROM chief_board_items WHERE active = 1 AND (expires_at = '' OR datetime(expires_at) > datetime('now')) AND (item_type <> 'event' OR ends_at = '' OR datetime(ends_at) > datetime('now')) ORDER BY CASE WHEN item_type = 'event' THEN 0 ELSE 1 END, CASE WHEN starts_at = '' THEN event_date ELSE starts_at END, created_at DESC LIMIT 20"
    ).all<{ id: string }>();
    const attachments = rows.results.length
      ? await db.prepare(`SELECT id, item_id AS itemId, filename, content_type AS contentType, size_bytes AS sizeBytes FROM chief_board_attachments WHERE item_id IN (${rows.results.map(() => "?").join(",")}) ORDER BY created_at`).bind(...rows.results.map((row) => row.id)).all<{ id: string; itemId: string; filename: string; contentType: string; sizeBytes: number }>()
      : { results: [] };
    const grouped = new Map<string, typeof attachments.results>();
    for (const attachment of attachments.results) grouped.set(attachment.itemId, [...(grouped.get(attachment.itemId) ?? []), attachment]);
    return Response.json({
      items: rows.results.map((row) => ({
        ...row,
        attachments: (grouped.get(row.id) ?? []).map((attachment) => ({ ...attachment, url: `/api/chief-board/attachments/${attachment.id}` })),
      })),
      canEdit,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load Chief Notes and Events" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const storedKeys: string[] = [];
  try {
    const db = await ensureDatabase();
    if (!await isAdmin(request, db)) return Response.json({ error: "Administrator privileges are required." }, { status: 403 });
    const form = await request.formData();
    const itemType = form.get("itemType") === "event" ? "event" : "note";
    const title = String(form.get("title") ?? "").trim();
    const detail = String(form.get("body") ?? "").trim();
    if (!title || !detail) return Response.json({ error: "A title and message are required." }, { status: 400 });

    const startsAt = itemType === "event" ? requiredDate(form.get("startsAt"), "An event start date and time") : "";
    const endsAt = itemType === "event" ? requiredDate(form.get("endsAt"), "An event end date and time") : "";
    const expiresAt = itemType === "note" ? optionalDate(form.get("expiresAt")) : "";
    if (itemType === "event" && Date.parse(endsAt) <= Date.parse(startsAt)) {
      return Response.json({ error: "The event end must be after the start." }, { status: 400 });
    }
    if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
      return Response.json({ error: "The note end must be in the future." }, { status: 400 });
    }

    const files = form.getAll("attachments").filter((value): value is File => value instanceof File && value.size > 0);
    if (files.length > maxFiles) return Response.json({ error: `Add no more than ${maxFiles} files.` }, { status: 400 });
    for (const file of files) {
      if (!allowedTypes.has(file.type)) return Response.json({ error: `${file.name} is not a supported photo or document.` }, { status: 400 });
      if (file.size > maxFileBytes) return Response.json({ error: `${file.name} is larger than 10 MB.` }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const actor = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() || "Administrator";
    const config = await runtime();
    if (files.length && !config.BUCKET) return Response.json({ error: "Attachment storage is unavailable." }, { status: 503 });
    const attachmentRows: Array<{ id: string; key: string; file: File }> = [];
    for (const file of files) {
      const attachmentId = crypto.randomUUID();
      const key = `chief-board/${id}/${attachmentId}-${cleanFilename(file.name)}`;
      await config.BUCKET!.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
      storedKeys.push(key);
      attachmentRows.push({ id: attachmentId, key, file });
    }

    const statements = [
      db.prepare("INSERT INTO chief_board_items (id, item_type, title, body, event_date, starts_at, ends_at, expires_at, invite_status, active, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)").bind(id, itemType, title, detail, startsAt ? startsAt.slice(0, 10) : "", startsAt, endsAt, expiresAt, actor),
      ...attachmentRows.map(({ id: attachmentId, key, file }) =>
        db.prepare("INSERT INTO chief_board_attachments (id, item_id, object_key, filename, content_type, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)").bind(attachmentId, id, key, cleanFilename(file.name), file.type, file.size)
      ),
    ];
    await db.batch(statements);
    storedKeys.length = 0;

    let invite = { status: "", sent: 0, failed: 0 };
    if (itemType === "event") {
      const employees = await db.prepare("SELECT DISTINCT lower(trim(p.email)) AS email FROM employee_profiles p JOIN employees e ON e.id = p.employee_id WHERE e.active = 1 AND p.email IS NOT NULL AND trim(p.email) <> ''").all<{ email: string }>();
      invite = await sendInvites(config, { id, title, body: detail, startsAt, endsAt }, employees.results.map((row) => row.email));
      const status = `${invite.status}:${invite.sent}:${invite.failed}`;
      await db.prepare("UPDATE chief_board_items SET invite_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(status, id).run();
    }
    return Response.json({ ok: true, invite });
  } catch (error) {
    if (storedKeys.length) {
      try {
        const config = await runtime();
        await Promise.all(storedKeys.map((key) => config.BUCKET?.delete(key)));
      } catch { /* Best-effort cleanup after a failed database write. */ }
    }
    const message = error instanceof Error ? error.message : "Unable to add Chief Note or Event";
    const status = /required|valid|future/i.test(message) ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
