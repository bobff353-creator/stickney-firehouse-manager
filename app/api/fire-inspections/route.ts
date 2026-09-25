import { ensureDatabase } from '../../../db/bootstrap';
import { inspectionBoundary,inspectionJson,inspectionSnapshot,decodeInspection,inspectionColumns,type StoredInspection,type InspectionDb } from '../../fire-inspections/server';
import { normalizeInspection,validateInspection,followUpRecord,blankSignature,type InspectionRecord } from '../../fire-inspections/model';
export async function GET(request:Request){
 const denied=inspectionBoundary(request);if(denied)return denied;
 try{const db=await ensureDatabase(),department=request.headers.get('x-department-id')!,id=new URL(request.url).searchParams.get('history');
 if(id)return inspectionJson({history:(await db.prepare('SELECT version,payload,archived,actor,created_at createdAt FROM fire_inspection_pilot_audit WHERE department_id=? AND record_id=? ORDER BY version DESC').bind(department,id).all()).results});
 return inspectionJson(await inspectionSnapshot(db,department));}catch{return inspectionJson({error:'Inspections could not load. Retry; saved records have not changed.'},503);}
}
function writes(db:InspectionDb,r:InspectionRecord,department:string,actor:string,time:string){
 const payload=JSON.stringify(r.data),archived=r.archived?1:0;
 return[r.version?db.prepare('UPDATE fire_inspection_pilot_records SET payload=?,version=version+1,archived=?,updated_at=?,updated_by=? WHERE department_id=? AND id=? AND version=?').bind(payload,archived,time,actor,department,r.id,r.version).expectChanges(1):db.prepare('INSERT INTO fire_inspection_pilot_records(id,department_id,kind,payload,version,archived,created_at,updated_at,updated_by) VALUES(?,?,?,?,1,?,?,?,?)').bind(r.id,department,r.kind,payload,archived,time,time,actor).expectChanges(1),db.prepare('INSERT INTO fire_inspection_pilot_audit(id,department_id,record_id,version,kind,payload,archived,actor,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),department,r.id,r.version+1,r.kind,payload,archived,actor,time)];
}
// Ignore server-generated signature timestamp when recognizing a safe retry.
function comparable(r:InspectionRecord){return JSON.stringify({...r.data,representative:{...r.data.representative,signedAt:''}});}
export async function POST(request:Request){
 const denied=inspectionBoundary(request,true);if(denied)return denied;let writing=false;
 try{
  const raw=await request.text();if(raw.length>180000)return inspectionJson({error:'This inspection is too large. Attach photos and documents as files.'},413);
  const body=JSON.parse(raw),id=String(body.id??''),version=Number(body.version),kind=body.kind;
  if(!/^[a-zA-Z0-9_-]{8,120}$/.test(id)||!Number.isInteger(version)||version<0||!['inspection','template'].includes(kind))throw Error('The record ID, type, or version is invalid.');
  const data=normalizeInspection(body.data),department=request.headers.get('x-department-id')!,actor=request.headers.get('oai-authenticated-user-email')!.trim().toLowerCase(),db=await ensureDatabase(),time=new Date().toISOString();
  const currentRow=await db.prepare(`SELECT ${inspectionColumns} FROM fire_inspection_pilot_records WHERE department_id=? AND id=?`).bind(department,id).first<StoredInspection>();
  const current=currentRow?decodeInspection(currentRow):null,r:InspectionRecord={id,version,kind,data,archived:body.archived===true,createdAt:current?.createdAt??time,updatedAt:time,updatedBy:actor};
  if(current&&current.kind!==kind)throw Error('A record cannot change its type.');
  if(current&&current.version===version+1&&comparable(current)===comparable(r)&&current.archived===r.archived){const children=await db.prepare(`SELECT ${inspectionColumns} FROM fire_inspection_pilot_records WHERE department_id=? AND (id=? OR id=?)`).bind(department,`${id}-routine`,`${id}-reinspection`).all<StoredInspection>();return inspectionJson({saved:true,record:current,followUps:children.results.map(decodeInspection)});}
  if((current?.version??0)!==version)return inspectionJson({error:'Another tab changed this record. Your draft remains here. Download it before opening the latest saved version.',code:'SAVE_CONFLICT'},409);
  if(current?.data.status==='Completed'){
   if(comparable(current)!==comparable(r)){
    if(data.status!=='Draft'||!data.changeReason)throw Error('Reopen the completed report with a correction reason before changing it.');
    data.representative=blankSignature();data.inspectorAttested=false;
   }
  }
  // Parent links, test classification, and the source of a follow-up cannot silently change.
  if(current&&(current.data.parentId!==data.parentId||current.data.followUpKind!==data.followUpKind||current.data.test!==data.test))throw Error('The source inspection and test designation cannot be changed.');
  if(data.parentId){const parent=await db.prepare('SELECT payload FROM fire_inspection_pilot_records WHERE department_id=? AND id=?').bind(department,data.parentId).first<{payload:string}>();if(!parent)throw Error('The source inspection is not available in this department.');if(Boolean(JSON.parse(parent.payload).test)!==data.test)throw Error('A test inspection cannot create a live follow-up.');}
  if(data.propertyId&&!await db.prepare('SELECT id FROM field_preplans WHERE id=?').bind(data.propertyId).first())throw Error('Select a property from this department, or enter a new property.');
  if(data.representative.state==='Signed')data.representative.signedAt=current&&JSON.stringify({...current.data.representative,signedAt:''})===JSON.stringify({...data.representative,signedAt:''})?current.data.representative.signedAt:time;
  validateInspection(kind,data);
  const batch=writes(db,r,department,actor,time),followUps:InspectionRecord[]=[];
  if(kind==='inspection'&&data.status==='Completed'&&current?.data.status!=='Completed'&&!r.archived){
   for(const [mode,date]of [['routine',data.repeatMonths?data.nextDueDate:''],['reinspection',data.followUpDate]] as const){
    if(!date)continue;const child=followUpRecord(r,mode,date);
    if(!await db.prepare('SELECT id FROM fire_inspection_pilot_records WHERE department_id=? AND id=?').bind(department,child.id).first()){batch.push(...writes(db,child,department,actor,time));followUps.push({...child,version:1,createdAt:time,updatedAt:time,updatedBy:actor});}
   }
  }
  writing=true;await db.batch(batch);
  const saved=await db.prepare(`SELECT ${inspectionColumns} FROM fire_inspection_pilot_records WHERE department_id=? AND id=?`).bind(department,id).first<StoredInspection>();
  return inspectionJson({saved:true,record:saved?decodeInspection(saved):null,followUps},current?200:201);
 }catch(error){const message=error instanceof Error?error.message:'';
  if(message.includes('SAVE_CONFLICT')||message.includes('duplicate key'))return inspectionJson({error:'Another save reached the server first. Your draft is kept; load the latest version before changing it.',code:'SAVE_CONFLICT'},409);
  if(writing||/Portal database|fetch|bootstrap/.test(message))return inspectionJson({error:'Save was not confirmed. Keep this screen open and retry. Retrying will not create duplicates.'},503);
  return inspectionJson({error:message||'The record was not saved. Check the details and retry.'},400);
 }
}
