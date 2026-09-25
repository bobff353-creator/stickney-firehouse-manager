import {ensureDatabase} from '../../../../db/bootstrap';
import {inspectionBoundary,inspectionJson} from '../../../fire-inspections/server';
import {normalizeCode} from '../../../fire-inspections/codes';
export async function POST(request:Request){
 const denied=inspectionBoundary(request,true);if(denied)return denied;
 let writing=false;
 try{
  const raw=await request.text();if(raw.length>65000)return inspectionJson({error:'Use a PDF attachment for longer documents.'},413);
  const b=JSON.parse(raw),id=String(b.id||''),version=Number(b.version),data=normalizeCode(b.data),archived=b.archived===true?1:0;
  if(!/^[a-zA-Z0-9_-]{8,120}$/.test(id)||!Number.isInteger(version)||version<0)throw Error('Invalid code record.');
  const db=await ensureDatabase(),department=request.headers.get('x-department-id')!,actor=request.headers.get('oai-authenticated-user-email')!,now=new Date().toISOString();
  const current=await db.prepare('SELECT version,payload,archived FROM fire_inspection_code_entries WHERE department_id=? AND id=?').bind(department,id).first<{version:number;payload:string;archived:number}>();
  const payload=JSON.stringify(data);
  if(current&&current.version===version+1&&current.payload===payload&&current.archived===archived)return inspectionJson({saved:true,entry:{id,version:current.version,data,archived:Boolean(archived),updatedAt:now,updatedBy:actor}});
  if((current?.version??0)!==version)return inspectionJson({error:'This code entry changed in another tab. Your edits are kept; refresh before replacing the saved version.'},409);
  writing=true;await db.batch([
   current?db.prepare('UPDATE fire_inspection_code_entries SET payload=?,version=version+1,archived=?,updated_at=?,updated_by=? WHERE department_id=? AND id=? AND version=?').bind(payload,archived,now,actor,department,id,version).expectChanges(1):db.prepare('INSERT INTO fire_inspection_code_entries(id,department_id,payload,version,archived,updated_at,updated_by) VALUES(?,?,?,1,?,?,?)').bind(id,department,payload,archived,now,actor).expectChanges(1),
   db.prepare('INSERT INTO fire_inspection_code_audit(id,department_id,code_id,version,payload,archived,actor,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),department,id,version+1,payload,archived,actor,now)
  ]);
  return inspectionJson({saved:true,entry:{id,version:version+1,data,archived:Boolean(archived),updatedAt:now,updatedBy:actor}});
 }catch(e){return inspectionJson({error:writing?'Save was not confirmed. Retry; your code entry will not duplicate.':e instanceof Error?e.message:'Code entry was not saved.'},writing?503:400);}
}
