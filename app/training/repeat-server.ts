import { createHash } from 'node:crypto';
import { nextAssignmentData } from './phase-four';
import { validateTraining, type TrainingRecord } from './model';
import { trainingSnapshot, decodeTraining, type TrainingDb, type StoredTrainingRow } from './server';
export async function repeatAssignment(db: TrainingDb, department: string, id: string, version: number, actor: string) {
  const snapshot=await trainingSnapshot(db,department),current=snapshot.records.find(r=>r.id===id);
  if(!current||current.version!==version)throw Error('SAVE_CONFLICT: Reload the assignment before creating its next occurrence.');
  const data=nextAssignmentData(current);
  validateTraining('assignment',data,snapshot.records,snapshot.members);
  const nextId='training-repeat-'+createHash('sha256').update(`${department}:${data.seriesId}:${data.dueDate}`).digest('hex').slice(0,40);
  const existing=snapshot.records.find(r=>r.id===nextId);
  if(existing)return {record:existing,created:false};
  const payload=JSON.stringify(data),timestamp=new Date().toISOString();
  try {await db.batch([
    db.prepare('UPDATE training_pilot_records SET version=version WHERE department_id=? AND id=? AND version=? AND archived=0').bind(department,id,version).expectChanges(1),
    db.prepare('INSERT INTO training_pilot_records(id,department_id,kind,payload,version,archived,created_at,updated_at,updated_by) VALUES(?,?,?, ?,1,0,?,?,?)').bind(nextId,department,'assignment',payload,timestamp,timestamp,actor).expectChanges(1),
    db.prepare('INSERT INTO training_pilot_audit(id,department_id,record_id,version,kind,payload,archived,actor,created_at) VALUES(?,?,?,1,?,?,0,?,?)').bind(crypto.randomUUID(),department,nextId,'assignment',payload,actor,timestamp),
  ]);}catch(error){
    if(error instanceof Error&&error.message.includes('duplicate key')) {
      const row=await db.prepare('SELECT id,kind,payload,version,archived,created_at createdAt,updated_at updatedAt,updated_by updatedBy FROM training_pilot_records WHERE department_id=? AND id=?').bind(department,nextId).first<StoredTrainingRow>();
      if(row)return {record:decodeTraining(row),created:false};
    }
    throw error;
  }
  const record:TrainingRecord={id:nextId,kind:'assignment',data,version:1,archived:false,createdAt:timestamp,updatedAt:timestamp,updatedBy:actor};
  return {record,created:true};
}
