import { ensureDatabase } from "../../../../../db/bootstrap";

type Bucket = { get(key:string):Promise<{body:ReadableStream;httpMetadata?:{contentType?:string};httpEtag?:string}|null> };

export async function GET(_request:Request, { params }:{ params:Promise<{photoId:string}> }) {
  try {
    const db = await ensureDatabase(), { photoId } = await params;
    const photo = await db.prepare("SELECT object_key objectKey,content_type contentType,filename FROM field_preplan_photos WHERE id=?").bind(photoId).first<{objectKey:string;contentType:string;filename:string}>();
    if (!photo) return Response.json({ error:"Photo not found." }, { status:404 });
    const { env } = await import("cloudflare:workers");
    const object = await (env as unknown as {BUCKET?:Bucket}).BUCKET?.get(photo.objectKey);
    if (!object) return Response.json({ error:"Photo file is unavailable." }, { status:404 });
    return new Response(object.body, { headers:{ "content-type":object.httpMetadata?.contentType || photo.contentType, "cache-control":"private, max-age=300", "content-disposition":`inline; filename="${photo.filename.replaceAll('"', "")}"`, ...(object.httpEtag ? { etag:object.httpEtag } : {}) } });
  } catch (error) { return Response.json({ error:error instanceof Error ? error.message : "Unable to load photo." }, { status:500 }); }
}
