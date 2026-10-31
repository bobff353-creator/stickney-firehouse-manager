import {ensureDatabase} from '../../db/bootstrap';
import {createInventorySupabaseClient} from '../lib/supabase-server';
import {verifyDisciplinaryRequest,sessionFailureResponse,sameOriginInventoryRequest} from '../lib/inventory-session';
export const disciplinaryBucket='stickney-disciplinary-private';
export const disciplinaryJson=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store, max-age=0',Pragma:'no-cache',Vary:'Cookie'}});
export const disciplinaryUuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export async function disciplinarySession(request:Request,write=false){
 const session=await verifyDisciplinaryRequest(request);
 if(!session.ok)return {ok:false as const,response:session.status===423?disciplinaryJson({error:'Unlock the department portal with your PIN before opening disciplinary reports.'},423):sessionFailureResponse(session)};
 if(write&&!sameOriginInventoryRequest(request))return {ok:false as const,response:disciplinaryJson({error:'Open this form from the department portal.'},403)};
 const db=await createInventorySupabaseClient();
 const access=await db.rpc('disciplinary_access',{p_department:session.context.department.id});
 if(access.error)return {ok:false as const,response:disciplinaryJson({error:'Disciplinary access could not be verified. Retry after reconnecting.'},503)};
 if(access.data!==true)return {ok:false as const,response:disciplinaryJson({error:'You do not have access to disciplinary reports. A permissions administrator can configure access by rank or employee.'},403)};
 return {ok:true as const,db,context:session.context};
}
export async function disciplinaryRoster(){
 const db=await ensureDatabase();
 return (await db.prepare('SELECT e.id,e.name,p.label rank,e.active FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id ORDER BY e.active DESC,e.name').all<{id:string;name:string;rank:string;active:number}>()).results.map(row=>({...row,active:Boolean(row.active)}));
}
