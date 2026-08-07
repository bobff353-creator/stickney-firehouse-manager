import { ensureDatabase } from "../../../../db/bootstrap";
import { hasPermission } from "../../../server-permissions";

const allowed = new Set(["image/jpeg","image/png","image/webp","image/heic","image/heif"]);
const clean=(value:FormDataEntryValue|null,limit=100)=>typeof value==="string"?value.trim().slice(0,limit):"";

export async function POST(request:Request){
  const db=await ensureDatabase();
  if(!await hasPermission(request,db,"settings.manage"))return Response.json({error:"Your department role cannot change Inventory photos."},{status:403});
  const form=await request.formData(),file=form.get("photo"),apparatusId=clean(form.get("apparatusId")),compartmentId=clean(form.get("compartmentId"))||null,equipmentId=clean(form.get("equipmentId"))||null,photoType=clean(form.get("photoType"),40);
  if(!(file instanceof File)||!apparatusId||!photoType)return Response.json({error:"A saved apparatus, photo type, and image are required."},{status:400});
  if(!allowed.has(file.type)||file.size>20*1024*1024)return Response.json({error:"Use a JPEG, PNG, WebP, HEIC, or HEIF image no larger than 20 MB."},{status:400});
  const apparatus=await db.prepare("SELECT id FROM fleet_apparatus WHERE id=?").bind(apparatusId).first();if(!apparatus)return Response.json({error:"Save the Fleet apparatus before adding photos."},{status:404});
  if(compartmentId){const match=await db.prepare("SELECT id FROM inventory_compartments WHERE id=? AND apparatus_id=?").bind(compartmentId,apparatusId).first();if(!match)return Response.json({error:"Select a compartment on this apparatus."},{status:400});}
  const {env}=await import("@/app/cf-env"); if(!env.BUCKET)return Response.json({error:"Department photo storage is unavailable."},{status:503});
  const prior=await db.prepare("SELECT id,object_key objectKey FROM inventory_photos WHERE apparatus_id=? AND COALESCE(compartment_id,'')=? AND COALESCE(equipment_id,'')=? AND photo_type=?").bind(apparatusId,compartmentId||"",equipmentId||"",photoType).first<{id:string;objectKey:string}>();
  const id=prior?.id||crypto.randomUUID(),extension=file.type.includes("png")?"png":file.type.includes("webp")?"webp":file.type.includes("hei")?"heic":"jpg",objectKey=`inventory/${apparatusId}/${photoType}/${crypto.randomUUID()}.${extension}`,actor=request.headers.get("oai-authenticated-user-email")||"Verified user";
  await env.BUCKET.put(objectKey,file.stream(),{httpMetadata:{contentType:file.type},customMetadata:{apparatusId,photoType,uploadedBy:actor}});
  await db.prepare("INSERT INTO inventory_photos(id,apparatus_id,compartment_id,equipment_id,photo_type,object_key,filename,content_type,byte_size,created_by) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET object_key=excluded.object_key,filename=excluded.filename,content_type=excluded.content_type,byte_size=excluded.byte_size,created_by=excluded.created_by,created_at=CURRENT_TIMESTAMP").bind(id,apparatusId,compartmentId,equipmentId,file.type?photoType:photoType,objectKey,file.name,file.type,file.size,actor).run();
  await db.prepare("INSERT INTO inventory_audit_events(id,actor,action,record_type,record_id,summary) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),actor,prior?"photo.replaced":"photo.added","photo",id,`${photoType} photo`).run();
  if(prior?.objectKey&&prior.objectKey!==objectKey)await env.BUCKET.delete(prior.objectKey);
  return Response.json({id,url:`/api/inventory/photos?id=${encodeURIComponent(id)}`},{status:prior?200:201});
}

export async function GET(request:Request){
  const db=await ensureDatabase();if(!await hasPermission(request,db,"documents.view"))return new Response("Unauthorized",{status:401});
  const id=new URL(request.url).searchParams.get("id")||"",photo=await db.prepare("SELECT object_key objectKey,content_type contentType FROM inventory_photos WHERE id=?").bind(id).first<{objectKey:string;contentType:string}>();if(!photo)return new Response("Photo not found",{status:404});
  const {env}=await import("@/app/cf-env"),object=await env.BUCKET?.get(photo.objectKey);if(!object)return new Response("Photo unavailable",{status:404});return new Response(object.body,{headers:{"Content-Type":photo.contentType,"Cache-Control":"private, max-age=300"}});
}

export async function DELETE(request:Request){
  const db=await ensureDatabase();if(!await hasPermission(request,db,"settings.manage"))return Response.json({error:"Your department role cannot remove photos."},{status:403});
  const id=new URL(request.url).searchParams.get("id")||"",photo=await db.prepare("SELECT object_key objectKey FROM inventory_photos WHERE id=?").bind(id).first<{objectKey:string}>();if(!photo)return Response.json({error:"Photo not found."},{status:404});
  const used=await db.prepare("SELECT id FROM inventory_hotspots WHERE photo_id=? LIMIT 1").bind(id).first();if(used)return Response.json({error:"Remove hotspots from this photo before deleting it."},{status:409});
  const {env}=await import("@/app/cf-env");await env.BUCKET?.delete(photo.objectKey);await db.prepare("DELETE FROM inventory_photos WHERE id=?").bind(id).run();return Response.json({deleted:true});
}
