import { ensureDatabase } from "../../../../db/bootstrap";

type Bucket = { put(key:string,value:ReadableStream,options:{httpMetadata:{contentType:string}}):Promise<unknown>; delete(key:string):Promise<void> };
const ownerAdminEmails = ["bobff353@gmail.com"];
const sides = new Set(["A","B","C","D","FEATURE","OVERVIEW"]);

async function runtime() {
  const { env } = await import("cloudflare:workers");
  return env as unknown as { BUCKET?:Bucket };
}

async function editor(request:Request, db:Awaited<ReturnType<typeof ensureDatabase>>) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  if (ownerAdminEmails.includes(email)) return email;
  const row = email ? await db.prepare("SELECT e.name,p.label rank,COALESCE(ep.is_admin,0) isAdmin FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND lower(ep.email)=? LIMIT 1").bind(email).first<{name:string;rank:string;isAdmin:number}>() : null;
  if (!row) return "";
  return row.isAdmin || /\b(chief|captain|lieutenant|firefighter|ff)\b/i.test(row.rank) ? row.name : "";
}

export async function POST(request:Request) {
  let storedKey = "";
  try {
    const db = await ensureDatabase(), actor = await editor(request, db);
    if (!actor) return Response.json({ error:"Field preplan edit permission is required." }, { status:403 });
    const config = await runtime();
    if (!config.BUCKET) return Response.json({ error:"Photo storage is unavailable." }, { status:503 });
    const form = await request.formData();
    const preplanId = String(form.get("preplanId") ?? ""), featureId = String(form.get("featureId") ?? ""), side = String(form.get("side") ?? "overview").toUpperCase();
    const file = form.get("photo");
    if (!(file instanceof File) || !file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) return Response.json({ error:"Choose a JPG, PNG, or WebP image up to 12 MB." }, { status:400 });
    if (!sides.has(side) && !["A","B","C","D"].includes(side)) return Response.json({ error:"Choose A, B, C, D, overview, or feature." }, { status:400 });
    const plan = await db.prepare("SELECT id FROM field_preplans WHERE id=?").bind(preplanId).first();
    if (!plan) return Response.json({ error:"Preplan not found." }, { status:404 });
    const id = crypto.randomUUID(), safeName = file.name.replace(/[^\w.\-]/g, "_").slice(0, 100) || "photo.jpg";
    storedKey = `field-preplans/${preplanId}/${id}-${safeName}`;
    await config.BUCKET.put(storedKey, file.stream(), { httpMetadata:{ contentType:file.type } });
    await db.prepare("INSERT INTO field_preplan_photos(id,preplan_id,feature_id,side,object_key,filename,content_type,size_bytes,caption,created_by) VALUES(?,?,NULLIF(?,''),?,?,?,?,?,?,?)")
      .bind(id,preplanId,featureId,side,storedKey,safeName,file.type,file.size,String(form.get("caption") ?? "").slice(0,500),actor).run();
    return Response.json({ ok:true, id });
  } catch (error) {
    if (storedKey) try { (await runtime()).BUCKET?.delete(storedKey); } catch { /* Best effort cleanup. */ }
    return Response.json({ error:error instanceof Error ? error.message : "Unable to upload photo." }, { status:500 });
  }
}
