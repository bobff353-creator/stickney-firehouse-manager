import { ensureDatabase } from '../../db/bootstrap';
import { inspectionPilotAccess } from './access';
import { emptyInspection, type InspectionRecord, type InspectionFile, type Property } from './model';
export const inspectionJson=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store, max-age=0',Vary:'Cookie'}});
export function inspectionBoundary(request:Request,write=false){
 if(!inspectionPilotAccess(request.headers.get('oai-authenticated-user-email'))||!request.headers.get('x-department-id'))return inspectionJson({error:'Fire Inspections is private to the designated pilot owner.'},403);
 const origin=request.headers.get('origin');if(write&&origin&&origin!==new URL(request.url).origin)return inspectionJson({error:'Open Fire Inspections in this portal before saving.'},403);return null;
}
export type InspectionDb=Awaited<ReturnType<typeof ensureDatabase>>;
export type StoredInspection={id:string;kind:InspectionRecord['kind'];payload:string;version:number;archived:number;createdAt:string;updatedAt:string;updatedBy:string};
export function decodeInspection(row:StoredInspection):InspectionRecord{return{id:row.id,kind:row.kind,data:{...emptyInspection(),...JSON.parse(row.payload)},version:row.version,archived:Boolean(row.archived),createdAt:row.createdAt,updatedAt:row.updatedAt,updatedBy:row.updatedBy};}
export const inspectionColumns='id,kind,payload,version,archived,created_at createdAt,updated_at updatedAt,updated_by updatedBy';
export async function inspectionSnapshot(db:InspectionDb,department:string){
 const [rows,properties,files]=await Promise.all([
  db.prepare(`SELECT ${inspectionColumns} FROM fire_inspection_pilot_records WHERE department_id=? ORDER BY updated_at DESC LIMIT 10001`).bind(department).all<StoredInspection>(),
  db.prepare('SELECT id,business_name name,address FROM field_preplans ORDER BY business_name LIMIT 10001').all<Property>(),
  db.prepare('SELECT id,record_id recordId,filename,size_bytes size,content_type contentType,created_at createdAt FROM fire_inspection_pilot_files WHERE department_id=? ORDER BY created_at DESC LIMIT 10001').bind(department).all<InspectionFile>(),
 ]);
 if([rows,properties,files].some(x=>x.results.length>10000))throw Error('Add paginated loading before expanding this pilot beyond 10,000 records.');
 return{records:rows.results.map(decodeInspection),properties:properties.results,attachments:files.results};
}
