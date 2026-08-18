import { ensureDatabase } from "../../../../../db/bootstrap";
import { hasPermission } from "../../../../server-permissions";

type Bucket = { get(key:string):Promise<{body:ReadableStream;httpMetadata?:{contentType?:string};httpEtag?:string}|null>; delete(key:string):Promise<void> };

export async function GET(request:Request, { params }:{ params:Promise<{assetId:string}> }) {
  try {
    const db = await ensureDatabase();
    const allowed = await hasPermission(request, db, "field_preplans.view");
    if (!allowed) return Response.json({ error:"Field preplan access is required." }, { status:403 });
    const { assetId } = await params;
    const asset = await db.prepare("SELECT object_key objectKey,mime_type mimeType,original_filename originalFilename,archived FROM field_preplan_assets WHERE id=?").bind(assetId).first<{objectKey:string;mimeType:string;originalFilename:string;archived:number}>();
    if (!asset || asset.archived) return Response.json({ error:"Attachment not found." }, { status:404 });
    const { env } = await import("@/app/cf-env");
    const object = await (env as unknown as {BUCKET?:Bucket}).BUCKET?.get(asset.objectKey);
    if (!object) return Response.json({ error:"Attachment file is unavailable." }, { status:404 });
    const disposition = asset.mimeType === "application/pdf" ? "attachment" : "inline";
    return new Response(object.body, {
      headers: {
        "content-type": object.httpMetadata?.contentType || asset.mimeType,
        "cache-control": "private, max-age=300",
        "content-disposition": `${disposition}; filename="${asset.originalFilename.replaceAll('"', "")}"`,
        "x-content-type-options": "nosniff",
        ...(object.httpEtag ? { etag:object.httpEtag } : {}),
      },
    });
  } catch (error) { return Response.json({ error:error instanceof Error ? error.message : "Unable to load attachment." }, { status:500 }); }
}

export async function DELETE(request:Request, { params }:{ params:Promise<{assetId:string}> }) {
  try {
    const db = await ensureDatabase();
    const allowed = await hasPermission(request, db, "field_preplans.manage_attachments");
    if (!allowed) return Response.json({ error:"Field preplan attachment management permission is required." }, { status:403 });
    const { assetId } = await params;
    const asset = await db.prepare("SELECT object_key objectKey FROM field_preplan_assets WHERE id=?").bind(assetId).first<{objectKey:string}>();
    if (!asset) return Response.json({ error:"Attachment not found." }, { status:404 });
    await db.prepare("DELETE FROM field_preplan_assets WHERE id=?").bind(assetId).run();
    try {
      const { env } = await import("@/app/cf-env");
      await (env as unknown as {BUCKET?:Bucket}).BUCKET?.delete(asset.objectKey);
    } catch { /* Best effort cleanup — the database row is already gone. */ }
    return Response.json({ ok:true });
  } catch (error) { return Response.json({ error:error instanceof Error ? error.message : "Unable to delete attachment." }, { status:500 }); }
}
