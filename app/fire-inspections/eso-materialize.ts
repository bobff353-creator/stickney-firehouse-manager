import {decodeInspection,inspectionColumns,type InspectionDb,type StoredInspection} from './server';
import {esoMedia,type EsoObject} from './eso-model';
import {nativeEsoFiles,nativeEsoInspection} from './eso-native';

type SavedFile={attachmentId:string;sha256:string;objectKey:string;filename:string;contentType:string;size:number};
export async function materializeEsoInspection(db:InspectionDb,department:string,b:EsoObject,sha256:string,time:string,actor:string,files:SavedFile[]){
 const record=nativeEsoInspection(b,sha256,time,actor);
 const existing=await db.prepare(`SELECT ${inspectionColumns} FROM fire_inspection_pilot_records WHERE department_id=? AND id=?`).bind(department,record.id).first<StoredInspection>();
 if(existing){const saved=decodeInspection(existing);if(saved.data.importedSource?.sha256!==sha256||saved.data.importedSource.inspectionId!==record.data.importedSource!.inspectionId)throw Error('This inspection ID already has different saved data. The existing record was kept.');return{record:saved,existing:true};}
 const originals=new Map(files.map(f=>[f.attachmentId,f]));
 for(const m of esoMedia(b)){const saved=originals.get(m.attachmentId);if(!saved||saved.sha256!==m.sha256||saved.size!==m.size||saved.contentType!==m.contentType||!saved.objectKey.startsWith(department+'/files/'))throw Error('An original attachment is missing or differs from its source. Finish reconciling the files before activating this inspection.');}
 const payload=JSON.stringify(record.data);
 if(payload.length>180000)throw Error('This source needs a larger report format. The original is still preserved.');
 const batch=[
  db.prepare('INSERT INTO fire_inspection_pilot_records(id,department_id,kind,payload,version,archived,created_at,updated_at,updated_by) VALUES(?,?,?,?,1,0,?,?,?)').bind(record.id,department,'inspection',payload,time,time,actor).expectChanges(1),
  db.prepare('INSERT INTO fire_inspection_pilot_audit(id,department_id,record_id,version,kind,payload,archived,actor,created_at) VALUES(?,?,?,1,?,?,0,?,?)').bind(crypto.randomUUID(),department,record.id,'inspection',payload,actor,time),
 ];
 for(const f of nativeEsoFiles(b)){
  const original=originals.get(f.attachmentId)!;
  // References reuse the verified private original; no bytes are copied, moved, or overwritten.
  batch.push(db.prepare('INSERT INTO fire_inspection_pilot_files(id,department_id,record_id,object_key,filename,content_type,size_bytes,created_at,created_by,check_id,caption,record_version) VALUES(?,?,?,?,?,?,?,?,?,?,?,1)').bind(f.id,department,record.id,'eso:'+original.objectKey,f.filename,f.contentType,f.size,f.sourceDate||time,actor,f.checkId,f.caption));
 }
 await db.batch(batch);
 const saved=await db.prepare(`SELECT ${inspectionColumns} FROM fire_inspection_pilot_records WHERE department_id=? AND id=?`).bind(department,record.id).first<StoredInspection>();
 if(!saved)throw Error('The inspection save was not confirmed. Retry the same source.');
 return{record:decodeInspection(saved),existing:false};
}
