import { ensureDatabase } from "../../../db/bootstrap";

const ownerAdminEmails = ["bobff353@gmail.com"];

async function isAdmin(request: Request, db: Awaited<ReturnType<typeof ensureDatabase>>) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  if (ownerAdminEmails.includes(email)) return true;
  if (!email) return false;
  const row = await db.prepare("SELECT is_admin AS isAdmin FROM employee_profiles WHERE lower(email) = ? LIMIT 1").bind(email).first<{ isAdmin: number }>();
  return Boolean(row?.isAdmin);
}

function resourceType(request: Request) {
  return new URL(request.url).searchParams.get("type") === "boxCard" ? "boxCard" : "policy";
}

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    const type = resourceType(request);
    const canEdit = await isAdmin(request, db);
    const rows = type === "policy"
      ? await db.prepare("SELECT id, title, policy_number AS policyNumber, category, effective_date AS effectiveDate, body, updated_by AS updatedBy, updated_at AS updatedAt FROM policies ORDER BY title COLLATE NOCASE").all()
      : await db.prepare("SELECT id, title, address, box_number AS boxNumber, access_notes AS accessNotes, details, updated_by AS updatedBy, updated_at AS updatedAt FROM box_cards ORDER BY title COLLATE NOCASE").all();
    return Response.json({ items: rows.results, canEdit });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load records" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await ensureDatabase();
    if (!await isAdmin(request, db)) return Response.json({ error: "Administrator privileges are required." }, { status: 403 });
    const type = resourceType(request);
    const body = await request.json() as Record<string, unknown>;
    const updatedBy = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() || "Administrator";
    const id = String(body.id || crypto.randomUUID());
    const title = String(body.title ?? "").trim();
    if (!title) return Response.json({ error: "A title is required." }, { status: 400 });
    if (type === "policy") {
      await db.prepare("INSERT INTO policies (id, title, policy_number, category, effective_date, body, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET title = excluded.title, policy_number = excluded.policy_number, category = excluded.category, effective_date = excluded.effective_date, body = excluded.body, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP").bind(id, title, String(body.policyNumber ?? "").trim(), String(body.category ?? "General").trim(), String(body.effectiveDate ?? ""), String(body.body ?? "").trim(), updatedBy).run();
    } else {
      await db.prepare("INSERT INTO box_cards (id, title, address, box_number, access_notes, details, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET title = excluded.title, address = excluded.address, box_number = excluded.box_number, access_notes = excluded.access_notes, details = excluded.details, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP").bind(id, title, String(body.address ?? "").trim(), String(body.boxNumber ?? "").trim(), String(body.accessNotes ?? "").trim(), String(body.details ?? "").trim(), updatedBy).run();
    }
    return Response.json({ ok: true, id });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save record" }, { status: 500 });
  }
}
