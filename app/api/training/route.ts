import { ensureDatabase } from '../../../db/bootstrap';
import { trainingBoundary, trainingJson, trainingSnapshot, decodeTraining, type StoredTrainingRow } from '../../training/server';
import { trainingKinds, normalizeTrainingData, validateTraining, type TrainingKind } from '../../training/model';

export async function GET(request:Request) {
  const denied=trainingBoundary(request);if(denied)return denied;
  try {
    const db=await ensureDatabase(),department=request.headers.get('x-department-id')!;
    const historyId=new URL(request.url).searchParams.get('history');
    if(historyId) {const rows=await db.prepare('SELECT version,payload,kind,archived,actor,created_at createdAt FROM training_pilot_audit WHERE department_id=? AND record_id=? ORDER BY version DESC').bind(department,historyId).all();return trainingJson({history:rows.results});}
    return trainingJson(await trainingSnapshot(db,department));
  } catch {return trainingJson({error:'Training could not load. Retry; saved records have not been changed.'},503);}
}
export async function POST(request:Request) {
  const denied=trainingBoundary(request,true);if(denied)return denied;
  let writing=false;
  try {
    const text=await request.text();if(text.length>90000)return trainingJson({error:'This record is too large. Attach documents as files.'},413);
    const body=JSON.parse(text), id=String(body.id??''),version=Number(body.version),kind=body.kind as TrainingKind;
    if(!/^[a-zA-Z0-9_-]{8,100}$/.test(id)||!Number.isInteger(version)||version<0||!trainingKinds.includes(kind))return trainingJson({error:'The record ID, version, or type is invalid.'},400);
    const data=normalizeTrainingData(body.data),archived=body.archived===true;
    const department=request.headers.get('x-department-id')!,actor=request.headers.get('oai-authenticated-user-email')!.trim().toLowerCase();
    const db=await ensureDatabase(),snapshot=await trainingSnapshot(db,department);
    const current=snapshot.records.find(r=>r.id===id);
    const payload=JSON.stringify(data),timestamp=new Date().toISOString();
    if(current&&current.kind!==kind)return trainingJson({error:'A record cannot change its type.'},409);
    // Idempotent retry after a lost response. It neither duplicates credit nor rewrites a newer edit.
    if(current&&current.version===version+1&&JSON.stringify(current.data)===payload&&current.archived===archived)return trainingJson({record:current,saved:true});
    if((current?.version??0)!==version)return trainingJson({error:'This record changed in another tab. Your draft is kept. Reload the saved record before trying again.',code:'SAVE_CONFLICT'},409);
    validateTraining(kind,data,snapshot.records,snapshot.members);
    if(data.status==='completed'&&kind!=='completion')return trainingJson({error:'Only a training completion can earn completion credit.'},400);
    if(kind==='completion'&&data.status==='saved')return trainingJson({error:'Save this completion as a draft or a completed record.'},400);
    writing=true;
    const write=current
      ?db.prepare('UPDATE training_pilot_records SET payload=?,version=version+1,archived=?,updated_at=?,updated_by=? WHERE department_id=? AND id=? AND version=?').bind(payload,archived?1:0,timestamp,actor,department,id,version).expectChanges(1)
      :db.prepare('INSERT INTO training_pilot_records(id,department_id,kind,payload,version,archived,created_at,updated_at,updated_by) VALUES(?,?,?,?,1,?,?,?,?)').bind(id,department,kind,payload,archived?1:0,timestamp,timestamp,actor).expectChanges(1);
    await db.batch([write,db.prepare('INSERT INTO training_pilot_audit(id,department_id,record_id,version,kind,payload,archived,actor,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),department,id,version+1,kind,payload,archived?1:0,actor,timestamp)]);
    const saved=await db.prepare('SELECT id,kind,payload,version,archived,created_at createdAt,updated_at updatedAt,updated_by updatedBy FROM training_pilot_records WHERE department_id=? AND id=?').bind(department,id).first<StoredTrainingRow>();
    return trainingJson({record:saved?decodeTraining(saved):null,saved:true},current?200:201);
  } catch(error) {
    const message=error instanceof Error?error.message:'';
    if(message.includes('SAVE_CONFLICT')||message.includes('duplicate key'))return trainingJson({error:'Another save reached the server first. Reload the saved record; your draft is still on screen.',code:'SAVE_CONFLICT'},409);
    if(writing||message.startsWith('Portal database')||message.includes('fetch')||message.includes('bootstrap'))return trainingJson({error:'The save was not confirmed. Keep this screen open and retry. Retrying will not duplicate this record.'},503);
    return trainingJson({error:message||'The record was not saved. Check the details and try again.'},400);
  }
}
