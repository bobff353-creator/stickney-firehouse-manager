import {ensureDatabase} from '../../../db/bootstrap';
import {permissionsForEmail} from '../../server-permissions';
import {getPortalDepartment} from '../../department-portal';
import {verifyInventoryRequest} from '../../lib/inventory-session';
import {createInventorySupabaseClient} from '../../lib/supabase-server';
import {programKinds,normalizeProgram,validateProgram,type ProgramKind,type ProgramRecord,type ProgramSource} from '../../operational-program-model';
import {chicagoQueueDate} from '../../task-queue-model';
type Db=Awaited<ReturnType<typeof ensureDatabase>>;
type Stored={id:string;kind:ProgramKind;payload:string;version:number;updatedAt:string;updatedBy:string};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie'}});
function decode(row:Stored):ProgramRecord{return {id:row.id,kind:row.kind,data:JSON.parse(row.payload),version:row.version,updatedAt:row.updatedAt,updatedBy:row.updatedBy};}
async function boundary(request:Request,kind:ProgramKind,write=false){
  const actor=request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase(),department=request.headers.get('x-department-id');
  if(!actor||!department)return {denied:json({error:'Verified department access is required.'},401)};
  const portal=await getPortalDepartment();if(portal.id!==department)return {denied:json({error:'Department access does not match this portal.'},403)};
  const db=await ensureDatabase(),permissions=await permissionsForEmail(actor,db);
  const read=kind==='hydrants'?'field_preplans.view':kind==='replacement'?'inventory.view':'command_center.view';
  const edit=kind==='hydrants'?'field_preplans.edit':kind==='replacement'?'inventory.repairs.manage':'incident_command.manage';
  if(!permissions.has(read)||(write&&!permissions.has(edit)))return {denied:json({error:'This program requires department permission.'},403)};
  if(kind==='replacement'){const session=await verifyInventoryRequest(request);if(!session.ok||session.context.department.id!==department||session.context.user.email.toLowerCase()!==actor)return {denied:json({error:'Verified inventory access is required.'},403)};}
  return {db,actor,department,canEdit:permissions.has(edit)};
}
async function sourcesFor(db:Db,kind:ProgramKind,department:string):Promise<ProgramSource[]>{
  if(kind==='outreach')return [];
  if(kind==='hydrants'){
    const [hydrants,flushes]=await Promise.all([db.prepare('SELECT id,hydrant_number number,address,service_status status,latitude,longitude FROM field_hydrants ORDER BY id LIMIT 10001').all<{id:string;number:string;address:string;status:string;latitude:number|null;longitude:number|null}>(),db.prepare('SELECT id,hydrant_id hydrantId,flushed_at date FROM field_hydrant_flushes ORDER BY id LIMIT 10001').all<{id:string;hydrantId:string;date:string}>()]);
    if(hydrants.results.length>10000||flushes.results.length>10000)throw Error('This larger source needs a paged review.');
    return hydrants.results.map(h=>({id:h.id,name:[h.number,h.address].filter(Boolean).join(' · ')||h.id,status:h.status,latitude:h.latitude,longitude:h.longitude,flushes:flushes.results.filter(f=>f.hydrantId===h.id).map(f=>({id:f.id,date:chicagoQueueDate(new Date(/[zZ]|[+-]\d\d:\d\d$/.test(f.date)?f.date:f.date.replace(' ','T')+'Z'))}))}));
  }
  const client=await createInventorySupabaseClient(),sources:ProgramSource[]=[];
  for(let from=0;from<10000;from+=1000){const result=await client.from('inventory_equipment').select('id,name,service_status,expiration_date,purchase_date').eq('department_id',department).order('id').range(from,from+999);if(result.error||!result.data)throw Error('Equipment source could not load.');sources.push(...result.data.map(s=>({id:s.id,name:s.name,status:s.service_status,expirationDate:s.expiration_date||'',purchaseDate:s.purchase_date||''})));if(result.data.length<1000)return sources;}throw Error('This larger source needs a paged review.');
}
export async function GET(request:Request){
  try{const kind=new URL(request.url).searchParams.get('kind') as ProgramKind;if(!programKinds.includes(kind))return json({error:'Choose hydrants, outreach, or replacement.'},400);const access=await boundary(request,kind);if(access.denied)return access.denied;const {db,department,canEdit}=access;
    const history=new URL(request.url).searchParams.get('history');
    if(history){const record=await db.prepare('SELECT id FROM operational_program_records WHERE department_id=? AND kind=? AND id=?').bind(department,kind,history).first();if(!record)return json({error:'Program not found.'},404);const rows=await db.prepare('SELECT version,payload,actor,created_at createdAt FROM operational_program_audit WHERE department_id=? AND record_id=? ORDER BY version DESC LIMIT 101').bind(department,history).all<{version:number;payload:string;actor:string;createdAt:string}>();return json({history:rows.results.slice(0,100).map(row=>({...row,data:JSON.parse(row.payload),payload:undefined})),more:rows.results.length>100});}
    const [rows,members,sourceResult]=await Promise.all([db.prepare('SELECT id,kind,payload,version,updated_at updatedAt,updated_by updatedBy FROM operational_program_records WHERE department_id=? AND kind=? ORDER BY updated_at DESC,id LIMIT 1001').bind(department,kind).all<Stored>(),db.prepare('SELECT id,name FROM employees WHERE active=1 ORDER BY name LIMIT 1001').all<{id:string;name:string}>(),sourcesFor(db,kind,department).then(value=>({state:'ready' as const,value}),()=>({state:'unavailable' as const,value:[] as ProgramSource[]}))]);
    if(rows.results.length>1000||members.results.length>1000)return json({error:'This larger register needs a paged review.'},503);
    return json({records:rows.results.map(decode),members:members.results,sources:sourceResult.value,sourceState:sourceResult.state,canEdit,generatedAt:new Date().toISOString()});
  }catch{return json({error:'Programs could not load. Retry; saved records are unchanged.'},503);}
}
export async function POST(request:Request){
  let writing=false;
  try{
    if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Save from the department portal.'},403);
    const raw=await request.text();if(raw.length>180000)return json({error:'Split this work into smaller batches.'},413);
    const body=JSON.parse(raw),kind=body.kind as ProgramKind,id=String(body.id??''),version=Number(body.version);
    if(!programKinds.includes(kind)||!/^[-a-zA-Z0-9_]{8,100}$/.test(id)||!Number.isInteger(version)||version<0)return json({error:'Reload the program before saving.'},400);
    const access=await boundary(request,kind,true);if(access.denied)return access.denied;const {db,department,actor}=access;
    const currentRow=await db.prepare('SELECT id,kind,payload,version,updated_at updatedAt,updated_by updatedBy FROM operational_program_records WHERE department_id=? AND id=?').bind(department,id).first<Stored>();
    if(currentRow&&currentRow.kind!==kind)return json({error:'Program type cannot change.'},409);
    const data=normalizeProgram(body.data),payload=JSON.stringify(data),current=currentRow?decode(currentRow):undefined;
    if(currentRow&&currentRow.payload===payload&&(currentRow.version===version||currentRow.version===version+1))return json({record:current,saved:true});
    if((currentRow?.version??0)!==version)return json({error:'This program changed in another tab. Your draft is kept. Reload the saved record before retrying.',code:'SAVE_CONFLICT'},409);
    const [sources,members]=await Promise.all([sourcesFor(db,kind,department),db.prepare('SELECT id FROM employees WHERE active=1 ORDER BY id').all<{id:string}>()]);validateProgram(kind,data,sources,members.results,current?.data);
    const timestamp=new Date().toISOString();writing=true;
    const write=currentRow?db.prepare('UPDATE operational_program_records SET payload=?,version=version+1,updated_at=?,updated_by=? WHERE department_id=? AND id=? AND version=?').bind(payload,timestamp,actor,department,id,version).expectChanges(1):db.prepare('INSERT INTO operational_program_records(department_id,id,kind,payload,version,updated_at,updated_by) VALUES(?,?,?,?,1,?,?)').bind(department,id,kind,payload,timestamp,actor).expectChanges(1);
    await db.batch([write,db.prepare('INSERT INTO operational_program_audit(department_id,record_id,version,kind,payload,actor,created_at) VALUES(?,?,?,?,?,?,?)').bind(department,id,version+1,kind,payload,actor,timestamp)]);
    return json({record:{id,kind,data,version:version+1,updatedAt:timestamp,updatedBy:actor},saved:true},currentRow?200:201);
  }catch(error){const message=error instanceof Error?error.message:'';if(message.includes('SAVE_CONFLICT')||message.includes('Required changes')||message.includes('duplicate key'))return json({error:'Another save arrived first. Keep your draft and reload the saved record.',code:'SAVE_CONFLICT'},409);if(writing||message.startsWith('Portal'))return json({error:'Save was not confirmed. Your draft remains; retrying will not duplicate this program.'},503);return json({error:message||'Check the program details before saving.'},400);}
}
