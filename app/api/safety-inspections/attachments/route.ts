import { ensureDatabase } from "../../../../db/bootstrap";
import { getPortalStorage } from "../../../portal-storage";
import { hasPermission } from "../../../server-permissions";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"]);

function privateJson(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" } });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return privateJson({ error: "The attachment request did not come from this portal." }, 403);
    const db = await ensureDatabase();
    if (!await hasPermission(request, db, "safety_inspections.complete")) return privateJson({ error: "Your department role cannot attach inspection files." }, 403);
    const form = await request.formData();
    const inspectionId = String(form.get("inspectionId") || "").trim().slice(0, 80);
    const file = form.get("file");
    if (!inspectionId || !(file instanceof File)) return privateJson({ error: "Choose an inspection and a file." }, 400);
    if (!allowedTypes.has(file.type) || file.size <= 0 || file.size > 20 * 1024 * 1024) return privateJson({ error: "Use a JPG, PNG, WebP, HEIC, or PDF no larger than 20 MB." }, 400);
    const actor = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() || "Unknown member";
    const canManage = await hasPermission(request, db, "safety_inspections.manage");
    const inspection = await db.prepare("SELECT id,status,created_by createdBy FROM safety_inspections WHERE id=? LIMIT 1").bind(inspectionId).first<{ id: string; status: string; createdBy: string }>();
    if (!inspection) return privateJson({ error: "The inspection record was not found." }, 404);
    if (inspection.status === "submitted") return privateJson({ error: "Reopen this submitted inspection before adding files." }, 409);
    if (!canManage && inspection.createdBy.toLowerCase() !== actor) return privateJson({ error: "Only the inspector or an officer can attach files." }, 403);
    const id = crypto.randomUUID();
    const extension = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : ["image/heic", "image/heif"].includes(file.type) ? "heic" : "jpg";
    const objectKey = `safety-inspections/${inspectionId}/${id}.${extension}`;
    await getPortalStorage().put(objectKey, file.stream(), { httpMetadata: { contentType: file.type } });
    try {
      await db.prepare("INSERT INTO safety_inspection_attachments(id,inspection_id,object_key,filename,content_type,size_bytes,created_by) VALUES(?,?,?,?,?,?,?)")
        .bind(id, inspectionId, objectKey, file.name.slice(0, 240), file.type, file.size, actor).run();
    } catch (error) {
      await getPortalStorage().delete(objectKey);
      throw error;
    }
    return privateJson({ attachment: { id, filename: file.name, url: `/api/safety-inspections/attachments/${id}` } }, 201);
  } catch (error) {
    return privateJson({ error: error instanceof Error ? error.message : "Unable to attach the file." }, 500);
  }
}
