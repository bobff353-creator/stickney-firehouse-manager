import {createInventorySupabaseClient} from '../../../lib/supabase-server';
import {canMutateInventory,sameOriginInventoryRequest,sessionFailureResponse,verifyInventoryRequest} from '../../../lib/inventory-session';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store, max-age=0'}});
export async function POST(request:Request){
 const session=await verifyInventoryRequest(request);if(!session.ok)return sessionFailureResponse(session);
 if(!sameOriginInventoryRequest(request)||!canMutateInventory(session.context,'inventory.setup.manage')||!canMutateInventory(session.context,'inventory.check'))return json({error:'Inventory setup and checking permissions are required.'},403);
 let body;try{body=await request.json();}catch{return json({error:'Choose the original weekly check and explain why it is being replaced.'},400);}
 if(!body||typeof body.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id)||typeof body.reason!=='string'||!body.reason.trim()||body.reason.length>2000)return json({error:'Choose the original weekly check and enter a reason of up to 2,000 characters.'},400);
 try{const db=await createInventorySupabaseClient();const result=await db.rpc('inventory_restart_weekly_check',{p_department:session.context.department.id,p_check:body.id,p_reason:body.reason.trim()});
 if(result.error)return json({error:result.error.code==='42501'?'This weekly check is unavailable for your department role.':result.error.code==='P0001'?result.error.message:'The archive and replacement were not confirmed. Refresh before retrying.'},result.error.code==='42501'?403:409);
 if(result.data?.saved!==true||result.data?.archivedCheckId!==body.id||typeof result.data.checkId!=='string')return json({error:'The server did not confirm the replacement. Refresh and review before retrying.'},503);
 return json(result.data);
 }catch{return json({error:'Save confirmation was not received. Refresh and review before retrying.'},503);}
}
