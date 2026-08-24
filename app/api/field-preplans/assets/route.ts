import { ensureDatabase } from "../../../../db/bootstrap";
import { getPortalStorage } from "../../../portal-storage";
import { hasPermission } from "../../../server-permissions";

const allowedTypes=new Set(["image/jpeg","image/png","image/webp","application/pdf"]);
const maxBytes=25*1024*1024;

export async function POST(request:Request){
  let objectKey="";
  try{
    const db=await ensureDatabase();
    if(!await hasPermission(request,db,"field_preplans.manage_attachments"))return Response.json({error:"Preplan attachment permission is required."},{status:403});
    const form=await request.formData();
    const preplanId=String(form.get("preplanId")??"").trim(),levelId=String(form.get("levelId")??"").trim(),hazmatId=String(form.get("hazmatId")??"").trim();
    const assetType=String(form.get("assetType")??"attachment").trim().slice(0,40),caption=String(form.get("caption")??"").trim().slice(0,500);
    const file=form.get("asset");
    if(!(file instanceof File)||!allowedTypes.has(file.type)||file.size<=0||file.size>maxBytes)return Response.json({error:"Choose a JPG, PNG, WebP, or PDF file up to 25 MB."},{status:400});
    const plan=await db.prepare("SELECT id FROM field_preplans WHERE id=?").bind(preplanId).first();
    if(!plan)return Response.json({error:"Preplan not found."},{status:404});
    if(levelId){const level=await db.prepare("SELECT id FROM field_preplan_levels WHERE id=? AND preplan_id=? AND archived=0").bind(levelId,preplanId).first();if(!level)return Response.json({error:"The selected level does not belong to this preplan."},{status:400});}
    if(assetType==="sds"&&!hazmatId)return Response.json({error:"Choose the verified HazMat record for this SDS."},{status:400});
    if(hazmatId){const hazmat=await db.prepare("SELECT id FROM field_preplan_hazmat WHERE id=? AND preplan_id=? AND archived=0").bind(hazmatId,preplanId).first();if(!hazmat)return Response.json({error:"The selected HazMat record does not belong to this preplan."},{status:400});}
    const id=crypto.randomUUID(),safeName=file.name.replace(/[^\w.\-]/g,"_").slice(0,100)||"preplan-asset";
    objectKey=`field-preplans/${preplanId}/assets/${id}-${safeName}`;
    await getPortalStorage().put(objectKey,file.stream(),{httpMetadata:{contentType:file.type}});
    const user=request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase()||"Authenticated user";
    await db.prepare("INSERT INTO field_preplan_assets(id,preplan_id,level_id,hazmat_id,category,original_filename,object_key,mime_type,file_size,caption,created_by,updated_by) VALUES(?,?,NULLIF(?,''),NULLIF(?,''),?,?,?,?,?,?,?,?)").bind(id,preplanId,levelId,hazmatId,assetType,safeName,objectKey,file.type,file.size,caption,user,user).run();
    return Response.json({ok:true,id,filename:safeName,contentType:file.type,sizeBytes:file.size});
  }catch(error){
    if(objectKey)try{await getPortalStorage().delete(objectKey);}catch{/* Best-effort rollback after metadata failure. */}
    return Response.json({error:error instanceof Error?error.message:"Unable to upload preplan asset."},{status:500});
  }
}
