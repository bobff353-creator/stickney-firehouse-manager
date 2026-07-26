import { ensureDatabase } from "../../../db/bootstrap";

const ownerAdminEmails = ["bobff353@gmail.com"];

async function isAdmin(request: Request, db: Awaited<ReturnType<typeof ensureDatabase>>) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  if (ownerAdminEmails.includes(email)) return true;
  if (!email) return false;
  const row = await db.prepare("SELECT is_admin AS isAdmin FROM employee_profiles WHERE lower(email) = ? LIMIT 1").bind(email).first<{ isAdmin: number }>();
  return Boolean(row?.isAdmin);
}

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    const canEdit = await isAdmin(request, db);
    const rows = await db.prepare("SELECT id, item_type AS itemType, title, body, event_date AS eventDate, created_by AS createdBy, created_at AS createdAt FROM chief_board_items WHERE active = 1 ORDER BY CASE WHEN item_type = 'event' AND event_date >= date('now') THEN 0 ELSE 1 END, event_date, created_at DESC LIMIT 20").all();
    return Response.json({ items: rows.results, canEdit });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load Chief Notes and Events" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await ensureDatabase();
    if (!await isAdmin(request, db)) return Response.json({ error: "Administrator privileges are required." }, { status: 403 });
    const body = await request.json() as { itemType?: string; title?: string; body?: string; eventDate?: string };
    const itemType = body.itemType === "event" ? "event" : "note";
    const title = String(body.title ?? "").trim();
    const detail = String(body.body ?? "").trim();
    const eventDate = itemType === "event" ? String(body.eventDate ?? "") : "";
    if (!title || !detail) return Response.json({ error: "A title and message are required." }, { status: 400 });
    if (itemType === "event" && !eventDate) return Response.json({ error: "An event date is required." }, { status: 400 });
    const actor = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() || "Administrator";
    await db.prepare("INSERT INTO chief_board_items (id, item_type, title, body, event_date, active, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)").bind(crypto.randomUUID(), itemType, title, detail, eventDate, actor).run();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to add Chief Note or Event" }, { status: 500 });
  }
}
