import {ensureDatabase} from '../../../../../db/bootstrap';
import {hasPermission,canReadPreplanLifecycle,preplanReadAccess} from '../../../../server-permissions';
import {getPortalStorage} from '../../../../portal-storage';
export async function GET(request:Request){
 const db=await ensureDatabase();
 if(!await hasPermission(request,db,'field_preplans.view'))return new Response('Forbidden',{status:403});
 const id=new URL(request.url).searchParams.get('id')??'';
 const row=await db.prepare('SELECT o.preplan_id preplanId,o.photo_key photoKey,o.photo_type photoType,p.publication_status publicationStatus,p.created_by createdBy,p.updated_by updatedBy FROM field_preplan_observations o LEFT JOIN field_preplans p ON p.id=o.preplan_id WHERE o.id=?').bind(id).first();
 if(!row?.photoKey||row.preplanId&&!canReadPreplanLifecycle(row,await preplanReadAccess(request,db)))return new Response('Not found',{status:404});
 const object=await getPortalStorage().get(String(row.photoKey));
 return object?new Response(object.body,{headers:{'Content-Type':String(row.photoType),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}}):new Response('Not found',{status:404});
}
