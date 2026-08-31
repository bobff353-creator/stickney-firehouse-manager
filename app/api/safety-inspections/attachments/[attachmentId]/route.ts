import { ensureDatabase } from "../../../../../db/bootstrap";
import { getPortalStorage } from "../../../../portal-storage";
import { hasPermission } from "../../../../server-permissions";

function privateJson(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" } });
}

export async function GET(request: Request, context: { params: Promise<{ attachmentId: string }> }) {
  try {
    const db = await ensureDatabase();
    if (!await hasPermission(request, db, "safety_inspections.view")) return privateJson({ error: "Your department role cannot view inspection files." }, 403);
    const { attachmentId } = await context.params;
    const attachment = await db.prepare("SELECT object_key objectKey,filename,content_type contentType FROM safety_inspection_attachments WHERE id=? LIMIT 1").bind(attachmentId).first<{ objectKey: string; filename: string; contentType: string }>();
    if (!attachment) return privateJson({ error: "Attachment not found." }, 404);
    const stored = await getPortalStorage().get(attachment.objectKey);
    if (!stored) return privateJson({ error: "The stored file is unavailable." }, 404);
    return new Response(stored.body, {
      headers: {
        "Content-Type": stored.httpMetadata.contentType || attachment.contentType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    return privateJson({ error: error instanceof Error ? error.message : "Unable to open the attachment." }, 500);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ attachmentId: string }> }) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return privateJson({ error: "The delete request did not come from this portal." }, 403);
    const db = await ensureDatabase();
    if (!await hasPermission(request, db, "safety_inspections.complete")) return privateJson({ error: "Your department role cannot remove inspection files." }, 403);
    const actor = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() || "Unknown member";
    const canManage = await hasPermission(request, db, "safety_inspections.manage");
    const { attachmentId } = await context.params;
    const attachment = await db.prepare("SELECT a.object_key objectKey,i.status,i.created_by createdBy FROM safety_inspection_attachments a JOIN safety_inspections i ON i.id=a.inspection_id WHERE a.id=? LIMIT 1").bind(attachmentId).first<{ objectKey: string; status: string; createdBy: string }>();
    if (!attachment) return privateJson({ error: "Attachment not found." }, 404);
    if (attachment.status === "submitted") return privateJson({ error: "Reopen this submitted inspection before removing files." }, 409);
    if (!canManage && attachment.createdBy.toLowerCase() !== actor) return privateJson({ error: "Only the inspector or an officer can remove files." }, 403);
    await getPortalStorage().delete(attachment.objectKey);
    await db.prepare("DELETE FROM safety_inspection_attachments WHERE id=?").bind(attachmentId).run();
    return privateJson({ ok: true });
  } catch (error) {
    return privateJson({ error: error instanceof Error ? error.message : "Unable to remove the attachment." }, 500);
  }
}
