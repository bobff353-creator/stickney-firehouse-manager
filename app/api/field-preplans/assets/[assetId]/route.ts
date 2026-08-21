import { ensureDatabase } from "../../../../../db/bootstrap";
import { getPortalStorage } from "../../../../portal-storage";
import { canReadPreplanLifecycle, hasPermission, preplanReadAccess } from "../../../../server-permissions";

export async function GET(request:Request,{params}:{params:Promise<{assetId:string}>}){
  try{
    const db=await ensureDatabase();
    if(!await hasPermission(request,db,"field_preplans.view"))return Response.json({error:"Field preplan access is required."},{status:403});
    const {assetId}=await params;
    const asset=await db.prepare("SELECT asset.object_key objectKey,asset.original_filename filename,asset.mime_type contentType,COALESCE(plan.publication_status,'published') publicationStatus,plan.created_by createdBy,plan.updated_by updatedBy FROM field_preplan_assets asset JOIN field_preplans plan ON plan.id=asset.preplan_id WHERE asset.id=? AND asset.archived=0 LIMIT 1").bind(assetId).first<{objectKey:string;filename:string;contentType:string;publicationStatus:string;createdBy:string;updatedBy:string}>();
    if(!asset)return Response.json({error:"Preplan asset not found."},{status:404});
    if(!canReadPreplanLifecycle(asset,await preplanReadAccess(request,db)))return Response.json({error:"Preplan asset not found."},{status:404});
    const stored=await getPortalStorage().get(asset.objectKey);
    if(!stored)return Response.json({error:"Stored preplan asset not found."},{status:404});
    const disposition=asset.contentType==="application/pdf"?"inline":"inline";
    const safeName=asset.filename.replace(/["\r\n]/g,"_");
    return new Response(stored.body,{headers:{"content-type":asset.contentType||stored.httpMetadata.contentType||"application/octet-stream","content-disposition":`${disposition}; filename="${safeName}"`,"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to load preplan asset."},{status:500});}
}

export async function DELETE(request:Request,{params}:{params:Promise<{assetId:string}>}){
  try{
    const db=await ensureDatabase();
    if(!await hasPermission(request,db,"field_preplans.manage_attachments"))return Response.json({error:"Preplan attachment permission is required."},{status:403});
    const {assetId}=await params;
    const asset=await db.prepare("SELECT object_key objectKey FROM field_preplan_assets WHERE id=? LIMIT 1").bind(assetId).first<{objectKey:string}>();
    if(!asset)return Response.json({error:"Preplan asset not found."},{status:404});
    await db.prepare("DELETE FROM field_preplan_assets WHERE id=?").bind(assetId).run();
    try{await getPortalStorage().delete(asset.objectKey);}catch{return Response.json({ok:true,storageCleanupPending:true});}
    return Response.json({ok:true,storageCleanupPending:false});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"Unable to delete preplan asset."},{status:500});}
}
