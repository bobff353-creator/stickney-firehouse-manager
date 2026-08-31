import { ensureDatabase } from "../../../db/bootstrap";
import { hasPermission } from "../../server-permissions";

type ResultInput = {
  templateItemId?: string;
  status?: string;
  deficiencyNote?: string;
  correctedOnSite?: boolean;
};

const allowedStatuses = new Set(["not_checked", "pass", "deficient", "not_applicable"]);

function privateJson(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" },
  });
}

function actorEmail(request: Request) {
  return request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() || "Unknown member";
}

function text(value: unknown, limit = 2000) {
  return String(value ?? "").trim().slice(0, limit);
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

async function viewerFor(request: Request, db: Awaited<ReturnType<typeof ensureDatabase>>) {
  const email = actorEmail(request);
  const employee = await db.prepare(
    "SELECT e.id,e.name FROM employees e JOIN employee_profiles p ON p.employee_id=e.id WHERE e.active=1 AND lower(p.email)=? LIMIT 1",
  ).bind(email).first<{ id: string; name: string }>();
  const [canView, canComplete, canManage] = await Promise.all([
    hasPermission(request, db, "safety_inspections.view"),
    hasPermission(request, db, "safety_inspections.complete"),
    hasPermission(request, db, "safety_inspections.manage"),
  ]);
  return { email, employee, canView, canComplete, canManage };
}

export async function GET(request: Request) {
  try {
    const db = await ensureDatabase();
    const viewer = await viewerFor(request, db);
    if (!viewer.canView) return privateJson({ error: "Your department role cannot view safety inspections." }, 403);
    const url = new URL(request.url);
    const selectedId = text(url.searchParams.get("inspectionId"), 80);
    const [templateRows, itemRows, inspectionRows] = await Promise.all([
      db.prepare("SELECT id,slug,title,description,cadence,category,location_options locationOptions,active,updated_by updatedBy,updated_at updatedAt FROM safety_inspection_templates WHERE active=1 ORDER BY cadence,title").all(),
      db.prepare("SELECT id,template_id templateId,section_name sectionName,label,equipment_type equipmentType,required,active,sort_order sortOrder,updated_by updatedBy,updated_at updatedAt FROM safety_inspection_template_items ORDER BY template_id,sort_order,label").all(),
      db.prepare("SELECT i.id,i.template_id templateId,t.title templateTitle,i.inspection_date inspectionDate,i.inspection_location inspectionLocation,i.inspector_employee_id inspectorEmployeeId,i.inspector_name inspectorName,i.status,i.overall_notes overallNotes,i.created_by createdBy,i.created_at createdAt,i.updated_by updatedBy,i.updated_at updatedAt,i.submitted_by submittedBy,i.submitted_at submittedAt,(SELECT COUNT(*) FROM safety_inspection_results r WHERE r.inspection_id=i.id) totalItems,(SELECT COUNT(*) FROM safety_inspection_results r WHERE r.inspection_id=i.id AND r.result_status='pass') passedItems,(SELECT COUNT(*) FROM safety_inspection_results r WHERE r.inspection_id=i.id AND r.result_status='deficient') deficientItems,(SELECT COUNT(*) FROM safety_inspection_results r WHERE r.inspection_id=i.id AND r.result_status='not_applicable') notApplicableItems FROM safety_inspections i JOIN safety_inspection_templates t ON t.id=i.template_id ORDER BY i.inspection_date DESC,i.updated_at DESC LIMIT 250").all(),
    ]);
    let inspection = null;
    let results: unknown[] = [];
    let attachments: unknown[] = [];
    if (selectedId) {
      inspection = await db.prepare("SELECT id,template_id templateId,inspection_date inspectionDate,inspection_location inspectionLocation,inspector_employee_id inspectorEmployeeId,inspector_name inspectorName,status,overall_notes overallNotes,created_by createdBy,created_at createdAt,updated_by updatedBy,updated_at updatedAt,submitted_by submittedBy,submitted_at submittedAt FROM safety_inspections WHERE id=? LIMIT 1").bind(selectedId).first();
      if (inspection) {
        const [resultRows, attachmentRows] = await Promise.all([
          db.prepare("SELECT r.id,r.inspection_id inspectionId,r.template_item_id templateItemId,r.result_status status,r.deficiency_note deficiencyNote,r.corrected_on_site correctedOnSite,r.snapshot_section_name snapshotSectionName,r.snapshot_label snapshotLabel,r.snapshot_equipment_type snapshotEquipmentType,r.snapshot_required snapshotRequired,r.snapshot_sort_order snapshotSortOrder,r.updated_by updatedBy,r.updated_at updatedAt FROM safety_inspection_results r WHERE r.inspection_id=? ORDER BY r.snapshot_sort_order,r.id").bind(selectedId).all(),
          db.prepare("SELECT id,inspection_id inspectionId,filename,content_type contentType,size_bytes sizeBytes,created_by createdBy,created_at createdAt FROM safety_inspection_attachments WHERE inspection_id=? ORDER BY created_at").bind(selectedId).all(),
        ]);
        results = resultRows.results;
        attachments = attachmentRows.results;
      }
    }
    return privateJson({
      viewer: { name: viewer.employee?.name || viewer.email, employeeId: viewer.employee?.id || null, canComplete: viewer.canComplete, canManage: viewer.canManage },
      templates: templateRows.results,
      templateItems: itemRows.results,
      inspections: inspectionRows.results,
      inspection,
      results,
      attachments,
    });
  } catch (error) {
    return privateJson({ error: error instanceof Error ? error.message : "Unable to load safety inspections." }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const db = await ensureDatabase();
    const viewer = await viewerFor(request, db);
    if (!viewer.canComplete) return privateJson({ error: "Your department role cannot complete safety inspections." }, 403);
    const body = await request.json() as {
      action?: string;
      inspectionId?: string;
      templateId?: string;
      inspectionDate?: string;
      inspectionLocation?: string;
      overallNotes?: string;
      results?: ResultInput[];
      item?: { id?: string; sectionName?: string; label?: string; equipmentType?: string; required?: boolean; active?: boolean; sortOrder?: number };
      template?: { id?: string; title?: string; description?: string; cadence?: string; category?: string; locationOptions?: string[] };
    };
    const action = text(body.action, 40);
    const actor = viewer.email;

    if (action === "create") {
      const templateId = text(body.templateId, 80);
      const inspectionDate = text(body.inspectionDate, 10);
      if (!templateId || !validDate(inspectionDate)) return privateJson({ error: "Choose an inspection and a valid date." }, 400);
      const template = await db.prepare("SELECT id FROM safety_inspection_templates WHERE id=? AND active=1 LIMIT 1").bind(templateId).first();
      if (!template) return privateJson({ error: "The inspection checklist is unavailable." }, 404);
      const inspectionId = crypto.randomUUID();
      await db.prepare("INSERT INTO safety_inspections(id,template_id,inspection_date,inspector_employee_id,inspector_name,created_by,updated_by) VALUES(?,?,?,?,?,?,?)")
        .bind(inspectionId, templateId, inspectionDate, viewer.employee?.id || null, viewer.employee?.name || actor, actor, actor).run();
      const items = await db.prepare("SELECT id,section_name sectionName,label,equipment_type equipmentType,required,sort_order sortOrder FROM safety_inspection_template_items WHERE template_id=? AND active=1 ORDER BY sort_order").bind(templateId).all<{ id: string; sectionName: string; label: string; equipmentType: string; required: number; sortOrder: number }>();
      await db.batch(items.results.map((item) => db.prepare("INSERT INTO safety_inspection_results(id,inspection_id,template_item_id,snapshot_section_name,snapshot_label,snapshot_equipment_type,snapshot_required,snapshot_sort_order,updated_by) VALUES(?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), inspectionId, item.id, item.sectionName, item.label, item.equipmentType, item.required, item.sortOrder, actor)));
      return privateJson({ ok: true, inspectionId }, 201);
    }

    if (action === "updateTemplate") {
      if (!viewer.canManage) return privateJson({ error: "Officer or administrator approval is required to edit an inspection form." }, 403);
      const template = body.template || {};
      const templateId = text(template.id, 80);
      const title = text(template.title, 180);
      const description = text(template.description, 1000);
      const cadence = text(template.cadence, 40).toLowerCase();
      const category = text(template.category, 120);
      const locationOptions = Array.isArray(template.locationOptions) ? template.locationOptions.map((value) => text(value, 120)).filter(Boolean).slice(0, 30) : [];
      if (!templateId || !title || !["weekly", "monthly"].includes(cadence)) return privateJson({ error: "Form name and a weekly or monthly frequency are required." }, 400);
      await db.prepare("UPDATE safety_inspection_templates SET title=?,description=?,cadence=?,category=?,location_options=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(title, description, cadence, category || "Field safety", JSON.stringify(locationOptions), actor, templateId).run();
      return privateJson({ ok: true });
    }

    if (action === "createItem") {
      if (!viewer.canManage) return privateJson({ error: "Officer or administrator approval is required to edit an inspection form." }, 403);
      const templateId = text(body.templateId, 80);
      const template = await db.prepare("SELECT id FROM safety_inspection_templates WHERE id=? AND active=1 LIMIT 1").bind(templateId).first();
      if (!template) return privateJson({ error: "The inspection form was not found." }, 404);
      const next = await db.prepare("SELECT COALESCE(MAX(sort_order),0)+10 nextOrder FROM safety_inspection_template_items WHERE template_id=?").bind(templateId).first<{ nextOrder: number }>();
      const itemId = `custom-${crypto.randomUUID()}`;
      await db.prepare("INSERT INTO safety_inspection_template_items(id,template_id,section_name,label,equipment_type,required,active,sort_order,updated_by) VALUES(?,?,?,?,?,1,1,?,?)")
        .bind(itemId, templateId, "New section", "New checkpoint", "", Number(next?.nextOrder) || 10, actor).run();
      return privateJson({ ok: true, itemId }, 201);
    }

    if (action === "updateItem") {
      if (!viewer.canManage) return privateJson({ error: "Officer or administrator approval is required to edit a checklist." }, 403);
      const item = body.item || {};
      const itemId = text(item.id, 80);
      const sectionName = text(item.sectionName, 120);
      const label = text(item.label, 180);
      const equipmentType = text(item.equipmentType, 120);
      if (!itemId || !sectionName || !label) return privateJson({ error: "Section and checkpoint are required." }, 400);
      await db.prepare("UPDATE safety_inspection_template_items SET section_name=?,label=?,equipment_type=?,required=?,active=?,sort_order=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(sectionName, label, equipmentType, item.required ? 1 : 0, item.active === false ? 0 : 1, Number(item.sortOrder) || 0, actor, itemId).run();
      return privateJson({ ok: true });
    }

    const inspectionId = text(body.inspectionId, 80);
    if (!inspectionId) return privateJson({ error: "Choose an inspection record." }, 400);
    const existing = await db.prepare("SELECT i.id,i.status,i.created_by createdBy,t.location_options locationOptions FROM safety_inspections i JOIN safety_inspection_templates t ON t.id=i.template_id WHERE i.id=? LIMIT 1").bind(inspectionId).first<{ id: string; status: string; createdBy: string; locationOptions: string }>();
    if (!existing) return privateJson({ error: "The inspection record was not found." }, 404);

    if (action === "reopen") {
      if (!viewer.canManage) return privateJson({ error: "Officer or administrator approval is required to reopen an inspection." }, 403);
      await db.prepare("UPDATE safety_inspections SET status='reopened',updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(actor, inspectionId).run();
      return privateJson({ ok: true });
    }

    if (!viewer.canManage && existing.createdBy.toLowerCase() !== actor) return privateJson({ error: "Only the inspector or an officer can edit this record." }, 403);
    if (existing.status === "submitted") return privateJson({ error: "Reopen this submitted inspection before editing it." }, 409);
    if (action !== "save" && action !== "submit") return privateJson({ error: "Unsupported safety inspection action." }, 400);

    const inspectionDate = text(body.inspectionDate, 10);
    if (!validDate(inspectionDate)) return privateJson({ error: "Enter a valid inspection date." }, 400);
    const inspectionLocation = text(body.inspectionLocation, 120);
    let locationOptions: string[] = [];
    try { locationOptions = JSON.parse(existing.locationOptions || "[]") as string[]; } catch { locationOptions = []; }
    if (action === "submit" && locationOptions.length && !locationOptions.includes(inspectionLocation)) return privateJson({ error: "Choose the facility inspected before submitting." }, 400);
    const inputs = Array.isArray(body.results) ? body.results : [];
    const templateItems = await db.prepare("SELECT template_item_id templateItemId,snapshot_required required FROM safety_inspection_results WHERE inspection_id=?").bind(inspectionId).all<{ templateItemId: string; required: number }>();
    const known = new Map(templateItems.results.map((item) => [item.templateItemId, item]));
    const normalized = inputs.filter((item) => known.has(text(item.templateItemId, 80))).map((item) => {
      const templateItemId = text(item.templateItemId, 80);
      const status = text(item.status, 30);
      return {
        templateItemId,
        status: allowedStatuses.has(status) ? status : "not_checked",
        deficiencyNote: text(item.deficiencyNote, 2000),
        correctedOnSite: Boolean(item.correctedOnSite),
      };
    });
    if (action === "submit") {
      const byId = new Map(normalized.map((item) => [item.templateItemId, item]));
      const incomplete = templateItems.results.filter((item) => item.required && (!byId.get(item.templateItemId) || byId.get(item.templateItemId)?.status === "not_checked"));
      const undocumentedDeficiencies = normalized.filter((item) => item.status === "deficient" && !item.deficiencyNote);
      if (incomplete.length) return privateJson({ error: `${incomplete.length} required checkpoint${incomplete.length === 1 ? " is" : "s are"} still not checked.` }, 400);
      if (undocumentedDeficiencies.length) return privateJson({ error: "Add a deficiency note for every deficient checkpoint." }, 400);
    }
    await db.batch(normalized.map((item) => db.prepare("UPDATE safety_inspection_results SET result_status=?,deficiency_note=?,corrected_on_site=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE inspection_id=? AND template_item_id=?")
      .bind(item.status, item.deficiencyNote, item.correctedOnSite ? 1 : 0, actor, inspectionId, item.templateItemId)));
    const notes = text(body.overallNotes, 6000);
    if (action === "submit") {
      await db.prepare("UPDATE safety_inspections SET inspection_date=?,inspection_location=?,overall_notes=?,status='submitted',submitted_by=?,submitted_at=CURRENT_TIMESTAMP,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(inspectionDate, inspectionLocation, notes, actor, actor, inspectionId).run();
    } else {
      await db.prepare("UPDATE safety_inspections SET inspection_date=?,inspection_location=?,overall_notes=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(inspectionDate, inspectionLocation, notes, actor, inspectionId).run();
    }
    return privateJson({ ok: true });
  } catch (error) {
    return privateJson({ error: error instanceof Error ? error.message : "Unable to save the safety inspection." }, 500);
  }
}
