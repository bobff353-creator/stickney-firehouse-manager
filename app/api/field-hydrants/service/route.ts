import {ensureDatabase} from '../../../../db/bootstrap';
import {hasPermission} from '../../../server-permissions';
import {serviceInput} from '../../../preplans/field-workspace-data';

export async function GET(request:Request){
 const db=await ensureDatabase();
 if(!await hasPermission(request,db,'field_preplans.view'))return Response.json({error:'Hydrant access is required.'},{status:403});
 const id=new URL(request.url).searchParams.get('hydrantId')??'';
 const events=await db.prepare('SELECT id,kind,performed_on performedOn,flow_gpm flowGpm,notes,actor,created_at createdAt FROM field_hydrant_service_events WHERE hydrant_id=? AND source_system IS NULL ORDER BY performed_on DESC,created_at DESC LIMIT 100').bind(id).all();
 return Response.json({events:events.results},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
 try{
  const db=await ensureDatabase();
  if(!await hasPermission(request,db,'field_preplans.edit')||request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Open this hydrant in your department portal to record work.'},{status:403});
  const entry=serviceInput(await request.json()),actor=request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase()??'';
  const target=await db.prepare('SELECT service_status serviceStatus FROM field_hydrants WHERE id=?').bind(entry.hydrantId).first<{serviceStatus:string}>();
  if(!target)return Response.json({error:'Hydrant not found.'},{status:404});
  if(target.serviceStatus==='archived')return Response.json({error:'Restore this hydrant before adding service work.'},{status:409});
  const old=await db.prepare('SELECT hydrant_id hydrantId,kind,performed_on performedOn,flow_gpm flowGpm,notes,actor FROM field_hydrant_service_events WHERE id=?').bind(entry.id).first();
  const same=(row:Record<string,unknown>)=>row.hydrantId===entry.hydrantId&&row.kind===entry.kind&&row.performedOn===entry.performedOn&&row.flowGpm===entry.flowGpm&&row.notes===entry.notes&&row.actor===actor;
  if(old){if(!same(old))return Response.json({error:'This save ID was already used for different work. Reopen the service form.'},{status:409});return Response.json({ok:true,id:entry.id});}
  await db.prepare('INSERT INTO field_hydrant_service_events(id,hydrant_id,kind,performed_on,flow_gpm,notes,actor,created_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(entry.id,entry.hydrantId,entry.kind,entry.performedOn,entry.flowGpm,entry.notes,actor,new Date().toISOString()).run();
  const saved=await db.prepare('SELECT hydrant_id hydrantId,kind,performed_on performedOn,flow_gpm flowGpm,notes,actor FROM field_hydrant_service_events WHERE id=?').bind(entry.id).first();
  if(!saved||!same(saved))return Response.json({error:'This save ID belongs to different work. Reopen the service form.'},{status:409});
  return Response.json({ok:true,id:entry.id});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Service work was not confirmed. Keep your entry and retry.'},{status:400});}
}
