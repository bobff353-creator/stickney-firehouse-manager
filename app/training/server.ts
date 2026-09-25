import { ensureDatabase } from '../../db/bootstrap';
import { trainingRequestAllowed } from './access';
import type { TrainingRecord, TrainingMember, TrainingAttachment } from './model';
export const trainingJson=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store, max-age=0',Vary:'Cookie'}});
export function trainingBoundary(request:Request,write=false) {
  if(!trainingRequestAllowed(request)||!request.headers.get('x-department-id'))return trainingJson({error:'Training is a private pilot for the designated owner.'},403);
  const origin=request.headers.get('origin');
  if(write&&origin&&origin!==new URL(request.url).origin)return trainingJson({error:'Open Training in this portal before saving.'},403);
  return null;
}
export type TrainingDb=Awaited<ReturnType<typeof ensureDatabase>>;
export type StoredTrainingRow={id:string;kind:TrainingRecord['kind'];payload:string;version:number;archived:number;createdAt:string;updatedAt:string;updatedBy:string};
export function decodeTraining(row:StoredTrainingRow):TrainingRecord {return {id:row.id,kind:row.kind,data:JSON.parse(row.payload),version:row.version,archived:Boolean(row.archived),createdAt:row.createdAt,updatedAt:row.updatedAt,updatedBy:row.updatedBy};}
export async function trainingSnapshot(db:TrainingDb,department:string) {
  const [rows,members,attachments]=await Promise.all([
    db.prepare('SELECT id,kind,payload,version,archived,created_at createdAt,updated_at updatedAt,updated_by updatedBy FROM training_pilot_records WHERE department_id=? ORDER BY updated_at DESC LIMIT 10001').bind(department).all<StoredTrainingRow>(),
    db.prepare('SELECT e.id,e.name,e.active,p.label rank FROM employees e LEFT JOIN pay_scales p ON p.id=e.pay_scale_id ORDER BY e.name').all<TrainingMember>(),
    db.prepare('SELECT id,record_id recordId,filename,size_bytes size,content_type contentType,created_at createdAt FROM training_pilot_files WHERE department_id=? ORDER BY created_at DESC LIMIT 10001').bind(department).all<TrainingAttachment>(),
  ]);
  if(rows.results.length>10000||attachments.results.length>10000)throw new Error('Training needs paginated loading before adding more records.');
  return {records:rows.results.map(decodeTraining),members:members.results,attachments:attachments.results};
}
