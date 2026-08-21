import { ensureDatabase } from "../../../../../db/bootstrap";
import { getPortalStorage } from "../../../../portal-storage";
import { canReadPreplanLifecycle, hasPermission, preplanReadAccess } from "../../../../server-permissions";

type Bucket = { get(key:string):Promise<{body:ReadableStream;httpMetadata?:{contentType?:string};httpEtag?:string}|null> };

export async function GET(request:Request, { params }:{ params:Promise<{photoId:string}> }) {
  try {
    const db = await ensureDatabase(), { photoId } = await params;
    if (!await hasPermission(request, db, "field_preplans.view")) return Response.json({ error:"Field preplan access is required." }, { status:403 });
    const photo = await db.prepare("SELECT photo.object_key objectKey,photo.content_type contentType,photo.filename,COALESCE(plan.publication_status,'published') publicationStatus,plan.created_by createdBy,plan.updated_by updatedBy FROM field_preplan_photos photo JOIN field_preplans plan ON plan.id=photo.preplan_id WHERE photo.id=?").bind(photoId).first<{objectKey:string;contentType:string;filename:string;publicationStatus:string;createdBy:string;updatedBy:string}>();
    if (!photo) return Response.json({ error:"Photo not found." }, { status:404 });
    if (!canReadPreplanLifecycle(photo, await preplanReadAccess(request, db))) return Response.json({ error:"Photo not found." }, { status:404 });
    const object = await (getPortalStorage() as Bucket).get(photo.objectKey);
    if (!object) return Response.json({ error:"Photo file is unavailable." }, { status:404 });
    return new Response(object.body, { headers:{ "content-type":object.httpMetadata?.contentType || photo.contentType, "cache-control":"private, max-age=300", "content-disposition":`inline; filename="${photo.filename.replaceAll('"', "")}"`, ...(object.httpEtag ? { etag:object.httpEtag } : {}) } });
  } catch (error) { return Response.json({ error:error instanceof Error ? error.message : "Unable to load photo." }, { status:500 }); }
}
