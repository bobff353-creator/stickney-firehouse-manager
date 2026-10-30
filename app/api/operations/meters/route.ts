import { createInventorySupabaseClient } from '../../../lib/supabase-server';
import { verifyInventoryRequest, sameOriginInventoryRequest, canMutateInventory, sessionFailureResponse } from '../../../lib/inventory-session';
import { meterErrors, meterResponse, meterSummary } from '../../../inventory-meter-model';

const json = (value: unknown,status=200) => Response.json(value,{status,headers:{'Cache-Control':'private, no-store, max-age=0',Vary:'Cookie'}});
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export async function POST(request: Request) {
  const session = await verifyInventoryRequest(request);
  if (!session.ok) return sessionFailureResponse(session);
  if (!sameOriginInventoryRequest(request)) return json({error:'Open this form from the department app.'},403);
  let body;
  try { if(Number(request.headers.get('content-length') || 0)>24000) return json({error:'Meter entry is too large.'},413); body=await request.json(); } catch { return json({error:'Enter valid meter inspection details.'},400); }
  if (!body || !['save_response','save_template'].includes(body.action)) return json({error:'Choose a meter inspection action.'},400);
  const template = body.action === 'save_template';
  if (!canMutateInventory(session.context,template ? 'inventory.setup.manage' : 'inventory.check')) return json({error:'Your department role cannot make this change.'},403);
  if (!uuid(body.id) || !Number.isInteger(body.version) || body.version<0) return json({error:'Choose a saved meter record and refresh its current version.'},400);
  try {
    const db=await createInventorySupabaseClient();
    const departmentId=session.context.department.id;
    let result;
    if (template) {
      if (typeof body.title !== 'string' || !body.title.trim() || body.title.length>100 || typeof body.instructions !== 'string' || body.instructions.length>2000) return json({error:'Enter a heading and instructions within their limits.'},400);
      result=await db.rpc('inventory_save_meter_template',{p_department_id:departmentId,p_equipment_id:body.id,p_expected_version:body.version,p_title:body.title,p_instructions:body.instructions});
    } else {
      if (typeof body.complete !== 'boolean' || !body.response || typeof body.response !== 'object' || Array.isArray(body.response) || JSON.stringify(body.response).length>12000 || (body.photoId && !uuid(body.photoId))) return json({error:'Enter valid meter inspection fields.'},400);
      const response=meterResponse(body.response);
      const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      if (body.complete) { const errors=meterErrors(response,today); if(errors.length)return json({error:errors.join(' ')},400); }
      // Pass the original shape to database validation: invalid fields cannot be silently discarded.
      result=await db.rpc('inventory_save_meter_atomic',{p_department_id:departmentId,p_item_id:body.id,p_response:JSON.stringify(body.response),p_expected_version:body.version,p_complete:body.complete,p_notes:meterSummary(response),p_photo_id:body.photoId || null});
    }
    if (result.error) {
      if (result.error.code==='40001') return json({error:result.error.message},409);
      if (result.error.code==='42501') return json({error:'This meter record is unavailable for your department role.'},403);
      return json({error:result.error.code === 'P0001' ? result.error.message : 'The meter inspection could not be saved. Refresh and review before retrying.'},400);
    }
    if (template ? result.data?.id !== body.id : result.data?.saved !== true || !result.data.checkItems?.some((item: {id?: string}) => item.id === body.id)) return json({error:'The server did not confirm this save. Refresh and review before retrying.'},503);
    return json(template ? {equipment:result.data} : result.data);
  } catch { return json({error:'Save confirmation was not received. Refresh and review the saved entry before retrying.'},503); }
}
