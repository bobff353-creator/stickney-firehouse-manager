import { ensureDatabase } from "../../../db/bootstrap";
import { hasPermission } from "../../server-permissions";

function resourceType(request: Request) {
  return new URL(request.url).searchParams.get("type") === "boxCard" ? "boxCard" : "policy";
}

async function addRevision(db: Awaited<ReturnType<typeof ensureDatabase>>, type: string, id: string, action: string, summary: string, actor: string) {
  await db.prepare("INSERT INTO record_revisions (id, record_type, record_id, revision_number, action, summary, actor) SELECT ?, ?, ?, COALESCE(MAX(revision_number), 0) + 1, ?, ?, ? FROM record_revisions WHERE record_type = ? AND record_id = ?").bind(crypto.randomUUID(), type, id, action, summary, actor, type, id).run();
}

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    const type = resourceType(request);
    if (!await hasPermission(request, db, "documents.view")) return Response.json({ error: "Document access is not enabled for this account." }, { status: 403 });
    const canEdit = await hasPermission(request, db, type === "policy" ? "policies.manage" : "box_cards.manage");
    const rows = type === "policy"
      ? await db.prepare("SELECT id, title, policy_number AS policyNumber, category, effective_date AS effectiveDate, body, status, created_by AS createdBy, COALESCE(CAST(created_at AS TEXT), CAST(updated_at AS TEXT)) AS createdAt, updated_by AS updatedBy, updated_at AS updatedAt FROM policies ORDER BY CAST(policy_number AS INTEGER), title COLLATE NOCASE").all()
      : await db.prepare("SELECT id, title, address, box_number AS boxNumber, access_notes AS accessNotes, details, department, document_url AS documentUrl, document_page AS documentPage, effective_date AS effectiveDate, review_date AS reviewDate, layout_data AS layoutData, status, created_by AS createdBy, COALESCE(CAST(created_at AS TEXT), CAST(updated_at AS TEXT)) AS createdAt, updated_by AS updatedBy, updated_at AS updatedAt FROM box_cards ORDER BY department COLLATE NOCASE, title COLLATE NOCASE").all();
    const revisions = await db.prepare("SELECT record_id AS recordId, revision_number AS revisionNumber, action, summary, actor, changed_at AS changedAt FROM record_revisions WHERE record_type = ? ORDER BY revision_number DESC").bind(type).all();
    const byRecord = new Map<string, unknown[]>();
    for (const revision of revisions.results as Array<Record<string, unknown>>) { const key = String(revision.recordId); byRecord.set(key, [...(byRecord.get(key) ?? []), revision]); }
    return Response.json({ items: rows.results.map((row) => ({ ...row, revisions: byRecord.get(String((row as { id: string }).id)) ?? [] })), canEdit });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load records" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = await ensureDatabase();
    const type = resourceType(request);
    if (!await hasPermission(request, db, type === "policy" ? "policies.manage" : "box_cards.manage")) return Response.json({ error: "Editing is not enabled for this account." }, { status: 403 });
    const body = await request.json() as Record<string, unknown>;
    const updatedBy = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() || "Administrator";
    const id = String(body.id || crypto.randomUUID());
    const existing = type === "policy" ? await db.prepare("SELECT id FROM policies WHERE id = ?").bind(id).first() : await db.prepare("SELECT id FROM box_cards WHERE id = ?").bind(id).first();
    const title = String(body.title ?? "").trim();
    if (!title) return Response.json({ error: "A title is required." }, { status: 400 });
    if (type === "policy") {
      await db.prepare("INSERT INTO policies (id, title, policy_number, category, effective_date, body, created_by, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET title = excluded.title, policy_number = excluded.policy_number, category = excluded.category, effective_date = excluded.effective_date, body = excluded.body, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP").bind(id, title, String(body.policyNumber ?? "").trim(), String(body.category ?? "General").trim(), String(body.effectiveDate ?? ""), String(body.body ?? "").trim(), updatedBy, updatedBy).run();
    } else {
      await db.prepare("INSERT INTO box_cards (id, title, address, box_number, access_notes, details, department, document_url, document_page, effective_date, review_date, layout_data, created_by, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET title = excluded.title, address = excluded.address, box_number = excluded.box_number, access_notes = excluded.access_notes, details = excluded.details, department = excluded.department, document_url = excluded.document_url, document_page = excluded.document_page, effective_date = excluded.effective_date, review_date = excluded.review_date, layout_data = excluded.layout_data, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP").bind(id, title, String(body.address ?? "").trim(), String(body.boxNumber ?? "").trim(), String(body.accessNotes ?? "").trim(), String(body.details ?? "").trim(), String(body.department ?? "Stickney").trim() || "Stickney", String(body.documentUrl ?? "").trim(), Number(body.documentPage ?? 0), String(body.effectiveDate ?? ""), String(body.reviewDate ?? ""), String(body.layoutData ?? ""), updatedBy, updatedBy).run();
    }
    await addRevision(db, type, id, existing ? "Updated" : "Created", `${type === "policy" ? "Policy" : "Box Card"} ${existing ? "content updated" : "record created"}`, updatedBy);
    return Response.json({ ok: true, id });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save record" }, { status: 500 });
  }
}
