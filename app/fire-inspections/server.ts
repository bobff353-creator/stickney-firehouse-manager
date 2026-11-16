import {profileKey,type PropertyProfile} from './property-profiles';
import { ensureDatabase } from '../../db/bootstrap';
import {requireNativeInspectionAccess,NativeInspectionAccessError} from './access-context';
import { emptyInspection, freshCheck, type InspectionRecord, type InspectionFile, type Property } from './model';
export const inspectionJson=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store, max-age=0',Vary:'Cookie'}});
export async function inspectionBoundary(request:Request,write=false,override?:string){
 try{const path=new URL(request.url).pathname,permission=override??(!write?'records.read':path.includes('/codes')?'citations.write':path.includes('/eso')?'settings.write':path.includes('/email')?'messages.send':path.includes('/property-profile')||path.includes('/preplan')?'properties.write':path.includes('/backups')?'backup.restore':'inspections.write');await requireNativeInspectionAccess(request,permission);return null;}
 catch(error){if(error instanceof NativeInspectionAccessError)return inspectionJson({error:error.message,code:error.code},error.status);return inspectionJson({error:'Verified inspection access is temporarily unavailable. Your saved records are unchanged.',code:'INSPECTION_ACCESS_UNAVAILABLE'},503);}
}
export type InspectionDb=Awaited<ReturnType<typeof ensureDatabase>>;
export type StoredInspection={id:string;kind:InspectionRecord['kind'];payload:string;version:number;archived:number;createdAt:string;updatedAt:string;updatedBy:string};
export function decodeInspection(row:StoredInspection):InspectionRecord{return{id:row.id,kind:row.kind,data:{...emptyInspection(),...JSON.parse(row.payload),checks:(JSON.parse(row.payload).checks||[]).map((c:import('./model').InspectionCheck)=>({...freshCheck(c),...c,citations:c.citations||[]}))},version:row.version,archived:Boolean(row.archived),createdAt:row.createdAt,updatedAt:row.updatedAt,updatedBy:row.updatedBy};}
export const inspectionColumns='id,kind,payload,version,archived,created_at createdAt,updated_at updatedAt,updated_by updatedBy';
export async function inspectionSnapshot(db:InspectionDb,department:string){
 const [rows,properties,files,codes,profiles]=await Promise.all([
  db.prepare(`SELECT ${inspectionColumns} FROM fire_inspection_pilot_records WHERE department_id=? ORDER BY updated_at DESC LIMIT 10001`).bind(department).all<StoredInspection>(),
  db.prepare('SELECT id,business_name name,address,updated_at updatedAt,latitude,longitude,access_info accessInfo,knox_box knoxBox,fdc,alarm_system alarmSystem,sprinkler_system sprinklerSystem FROM field_preplans ORDER BY business_name LIMIT 10001').all<Property>(),
  db.prepare('SELECT id,record_id recordId,code_id codeId,check_id checkId,caption,record_version recordVersion,filename,size_bytes size,content_type contentType,created_at createdAt FROM fire_inspection_pilot_files WHERE department_id=? ORDER BY created_at DESC LIMIT 10001').bind(department).all<InspectionFile>(),
  db.prepare('SELECT id,payload,version,archived,updated_at updatedAt,updated_by updatedBy FROM fire_inspection_code_entries WHERE department_id=? ORDER BY updated_at DESC LIMIT 10001').bind(department).all<{id:string;payload:string;version:number;archived:number;updatedAt:string;updatedBy:string}>(),
  db.prepare('SELECT value FROM system_meta WHERE key LIKE ?').bind(profileKey(department,'')+'%').all<{value:string}>(),
 ]);
 const profileMap=new Map(profiles.results.map(row=>{const profile=JSON.parse(row.value) as PropertyProfile;return [profile.id,profile];}));
 if([rows,properties,files,codes].some(x=>x.results.length>10000))throw Error('Add paginated loading before expanding this pilot beyond 10,000 records.');
 return{departmentId:department,records:rows.results.map(decodeInspection),properties:properties.results.map(property=>{const profile=profileMap.get(property.id);return {...property,inspectionProfile:profile,...(profile?{occupancyGroup:profile.data.occupancyGroup,additionalOccupancyGroups:profile.data.additionalOccupancyGroups,systems:profile.data.systems}:{})};}),attachments:files.results,codes:codes.results.map(c=>({...c,archived:Boolean(c.archived),data:JSON.parse(c.payload),payload:undefined}))};
}
