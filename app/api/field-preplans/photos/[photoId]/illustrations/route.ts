import { ensureDatabase } from '../../../../../../db/bootstrap';
import { canReadPreplanLifecycle, hasPermission, preplanReadAccess } from '../../../../../server-permissions';
import { readIllustrations } from '../../../../../preplans/photo-illustrations';
import { illustrationPayload, savePhotoIllustrations } from '../../../../../preplans/photo-illustration-store';

export async function GET(request:Request,{params}:{params:Promise<{photoId:string}>}){
  try{
    const db=await ensureDatabase();
    if(!await hasPermission(request,db,'field_preplans.view'))return Response.json({error:'Preplan photo access is required.'},{status:403});
    const {photoId}=await params;
    const photo=await db.prepare(`SELECT photo.id,photo.caption,photo.illustrations,photo.illustration_version illustrationVersion,
      COALESCE(plan.publication_status,'published') publicationStatus,plan.created_by createdBy,plan.updated_by updatedBy
      FROM field_preplan_photos photo JOIN field_preplans plan ON plan.id=photo.preplan_id WHERE photo.id=?`).bind(photoId).first<{id:string;caption:string;illustrations:string;illustrationVersion:number;publicationStatus:string;createdBy:string;updatedBy:string}>();
    if(!photo||!canReadPreplanLifecycle(photo,await preplanReadAccess(request,db)))return Response.json({error:'Photo not found.'},{status:404});
    return Response.json({id:photo.id,caption:photo.caption,illustrations:readIllustrations(photo.illustrations),illustrationVersion:photo.illustrationVersion},{headers:{'cache-control':'private, no-store'}});
  }catch{return Response.json({error:'Could not check the latest photo changes. Try again when connected.'},{status:503});}
}

export async function PATCH(request:Request,{params}:{params:Promise<{photoId:string}>}){
  try{
    const db=await ensureDatabase();
    if(!await hasPermission(request,db,'field_preplans.manage_attachments'))return Response.json({error:'Photo editing permission is required.'},{status:403});
    const {photoId}=await params;
    const raw=await request.text();
    if(raw.length>40000)return Response.json({error:'Photo symbol data is too large.'},{status:413});
    let body:ReturnType<typeof illustrationPayload>;
    try{body=illustrationPayload(JSON.parse(raw));}catch(error){return Response.json({error:error instanceof Error?error.message:'Invalid photo symbols.'},{status:400});}
    // The DB adapter uses the current authenticated department session, never a service-role client.
    const photo=await db.prepare(`SELECT photo.preplan_id preplanId,photo.side,photo.feature_id featureId,photo.illustrations,photo.illustration_version version,photo.caption,
      COALESCE(plan.publication_status,'published') publicationStatus,plan.created_by createdBy,plan.updated_by updatedBy
      FROM field_preplan_photos photo JOIN field_preplans plan ON plan.id=photo.preplan_id WHERE photo.id=?`).bind(photoId).first<{preplanId:string;side:string;featureId:string|null;illustrations:string;version:number;caption:string;publicationStatus:string;createdBy:string;updatedBy:string}>();
    if(!photo||!canReadPreplanLifecycle(photo,await preplanReadAccess(request,db)))return Response.json({error:'Photo not found.'},{status:404});
    if(photo.featureId||!['A','B','C','D'].includes(photo.side))return Response.json({error:'Illustration symbols belong on A, B, C or D exterior photos only.'},{status:400});
    if(photo.version!==body.version)return Response.json({error:'This photo was changed on another screen. Close and reopen it to review the latest version before editing.'},{status:409});
    if(photo.caption===body.caption&&JSON.stringify(readIllustrations(photo.illustrations))===JSON.stringify(body.illustrations))return Response.json({ok:true,version:photo.version,unchanged:true,illustrations:body.illustrations,caption:body.caption});
    const actor=request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase()??'';
    const saved=await savePhotoIllustrations(db,photoId,photo.preplanId,body,actor);
    if(!saved)return Response.json({error:'This photo changed while saving. Reopen it to review the latest version.'},{status:409});
    return Response.json({ok:true,version:saved.version,illustrations:body.illustrations,caption:body.caption});
  }catch{return Response.json({error:'Photo changes could not be saved. Your edits remain here; try again.'},{status:500});}
}
