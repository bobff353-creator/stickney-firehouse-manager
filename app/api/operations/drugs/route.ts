import {createInventorySupabaseClient} from '../../../lib/supabase-server';
import {canMutateInventory,sameOriginInventoryRequest,sessionFailureResponse,verifyInventoryRequest} from '../../../lib/inventory-session';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store, max-age=0'}});
const uuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export async function POST(request:Request){
 const session=await verifyInventoryRequest(request);
 if(!session.ok)return sessionFailureResponse(session);
 if(!sameOriginInventoryRequest(request))return json({error:'Open this form from the department app.'},403);
 if(!canMutateInventory(session.context,'inventory.check'))return json({error:'Your Inventory permission does not allow this change.'},403);
 let body;
 try{if(Number(request.headers.get('content-length')||0)>32000)return json({error:'Drug inventory entry is too large.'},413);body=await request.json();}catch{return json({error:'Enter valid drug inventory observations.'},400);}
 if(!body||!uuid(body.id)||!Number.isInteger(body.version)||body.version<0||typeof body.complete!=='boolean'||!body.response||typeof body.response!=='object'||Array.isArray(body.response)||JSON.stringify(body.response).length>24000||(body.photoId&&!uuid(body.photoId)))return json({error:'Choose a saved drug entry and enter valid observations.'},400);
 try{
  const db=await createInventorySupabaseClient();
  const result=await db.rpc('inventory_save_drug_atomic',{p_department_id:session.context.department.id,p_item_id:body.id,p_response:JSON.stringify(body.response),p_expected_version:body.version,p_complete:body.complete,p_photo_id:body.photoId||null});
  if(result.error){const code=result.error.code;return json({error:code==='42501'?'This drug entry is unavailable for your department role.':code==='40001'||code==='P0001'?result.error.message:'The drug entry could not be saved. Refresh and review before retrying.'},code==='42501'?403:code==='40001'?409:400);}
  if(result.data?.saved!==true||!result.data.checkItems?.some((row:{id?:string})=>row.id===body.id))return json({error:'The server did not confirm this save. Refresh and review before retrying.'},503);
  return json(result.data);
 }catch{return json({error:'Save confirmation was not received. Refresh and review the saved entry before retrying.'},503);}
}
