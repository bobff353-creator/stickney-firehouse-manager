import { ensureDatabase } from "../../../../db/bootstrap";
import { hasPermission } from "../../../server-permissions";
import { isAllowedMimeType, isValidAssetSize, safeFilename, verifyFileSignature, type AssetCategory } from "../../../preplans/assets.ts";

type Bucket = { put(key:string,value:ReadableStream,options:{httpMetadata:{contentType:string}}):Promise<unknown>; delete(key:string):Promise<void> };

async function runtime() {
  const { env } = await import("@/app/cf-env");
  return env as unknown as { BUCKET?:Bucket };
}

const categories = new Set<AssetCategory>([
  "exterior_photo","feature_photo","feature_location_overview","interior_floor_plan","sprinkler_plan",
  "fire_alarm_map","hose_lay_plan","sds","emergency_action_plan","evacuation_plan","elevator_instructions",
  "inspection_document","general_operational_attachment",
]);

export async function POST(request:Request) {
  let storedKey = "";
  try {
    const db = await ensureDatabase();
    const allowed = await hasPermission(request, db, "field_preplans.manage_attachments");
    if (!allowed) return Response.json({ error:"Field preplan attachment management permission is required." }, { status:403 });
    const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
    const actorRow = await db.prepare("SELECT e.name FROM employees e LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND lower(ep.email)=? LIMIT 1").bind(email).first<{name:string}>();
    const actor = actorRow?.name || email;

    const config = await runtime();
    if (!config.BUCKET) return Response.json({ error:"Attachment storage is unavailable." }, { status:503 });

    const form = await request.formData();
    const preplanId = String(form.get("preplanId") ?? "");
    const featureId = String(form.get("featureId") ?? "") || null;
    const hazmatId = String(form.get("hazmatId") ?? "") || null;
    const levelId = String(form.get("levelId") ?? "") || null;
    const requestedCategory = String(form.get("category") ?? "") as AssetCategory;
    const category = categories.has(requestedCategory) ? requestedCategory : "general_operational_attachment";
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error:"No file was provided." }, { status:400 });
    if (!isAllowedMimeType(file.type)) return Response.json({ error:"Only JPG, PNG, WebP, and PDF files are allowed." }, { status:400 });
    if (!isValidAssetSize(file.size)) return Response.json({ error:"File must be larger than 0 bytes and no more than 20 MB." }, { status:400 });

    const headerBytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (!verifyFileSignature(file.type, headerBytes)) return Response.json({ error:"The file's contents do not match its declared type. Upload rejected." }, { status:400 });

    const plan = await db.prepare("SELECT id FROM field_preplans WHERE id=?").bind(preplanId).first();
    if (!plan) return Response.json({ error:"Preplan not found." }, { status:404 });
    if (featureId) {
      const feature = await db.prepare("SELECT id FROM field_preplan_features WHERE id=? AND preplan_id=?").bind(featureId,preplanId).first();
      if (!feature) return Response.json({ error:"The linked feature does not belong to this preplan." }, { status:400 });
    }
    if (hazmatId) {
      const hazmat = await db.prepare("SELECT id FROM field_preplan_hazmat WHERE id=? AND preplan_id=?").bind(hazmatId,preplanId).first();
      if (!hazmat) return Response.json({ error:"The linked HazMat record does not belong to this preplan." }, { status:400 });
    }
    if (levelId) {
      const level = await db.prepare("SELECT id FROM field_preplan_levels WHERE id=? AND preplan_id=?").bind(levelId,preplanId).first();
      if (!level) return Response.json({ error:"The linked level does not belong to this preplan." }, { status:400 });
    }

    const id = crypto.randomUUID();
    const filename = safeFilename(file.name);
    storedKey = `field-preplan-assets/${preplanId}/${id}-${filename}`;
    await config.BUCKET.put(storedKey, file.stream(), { httpMetadata:{ contentType:file.type } });
    await db.prepare("INSERT INTO field_preplan_assets(id,preplan_id,feature_id,hazmat_id,level_id,category,original_filename,object_key,mime_type,file_size_bytes,caption,description,pin_to_respond,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id,preplanId,featureId,hazmatId,levelId,category,filename,storedKey,file.type,file.size,String(form.get("caption") ?? "").slice(0,300),String(form.get("description") ?? "").slice(0,2000),form.get("pinToRespond")==="true"?1:0,actor,actor).run();
    return Response.json({ ok:true, id });
  } catch (error) {
    if (storedKey) try { (await runtime()).BUCKET?.delete(storedKey); } catch { /* Best effort cleanup. */ }
    return Response.json({ error:error instanceof Error ? error.message : "Unable to upload attachment." }, { status:500 });
  }
}
