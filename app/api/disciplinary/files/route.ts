import {createHash} from 'node:crypto';
import {disciplinarySession,disciplinaryJson,disciplinaryUuid,disciplinaryBucket} from '../../../disciplinary/server';
import {disciplinaryFileTypes,disciplinaryFileLimit} from '../../../disciplinary/model';
export async function POST(request:Request){
 const access=await disciplinarySession(request,true);if(!access.ok)return access.response;
 const form=await request.formData();const file=form.get('file');const reportId=form.get('reportId');
 if(!(file instanceof File)||!disciplinaryUuid(reportId)||!disciplinaryFileTypes.has(file.type)||file.size<1||file.size>disciplinaryFileLimit)return disciplinaryJson({error:'Choose a PDF, Word document, text file, or photo up to 4 MB.'},400);
 const report=await access.db.from('disciplinary_reports').select('id').eq('id',reportId).eq('department_id',access.context.department.id).maybeSingle();
 if(report.error)return disciplinaryJson({error:'The saved report could not be checked. Retry.'},503);if(!report.data)return disciplinaryJson({error:'Save this report as a draft before attaching files.'},404);
 const id=crypto.randomUUID();const extensions:Record<string,string>={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/heic':'heic','image/heif':'heif','application/msword':'doc','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx','text/plain':'txt'};
 const objectKey=`${access.context.department.id}/${reportId}/${id}.${extensions[file.type]}`;const bytes=Buffer.from(await file.arrayBuffer());const sha256=createHash('sha256').update(bytes).digest('hex');
 const prior=await access.db.from('disciplinary_report_files').select('id,report_id,original_filename,mime_type,byte_size,uploaded_at,uploaded_by_name,sha256').eq('department_id',access.context.department.id).eq('report_id',reportId).eq('sha256',sha256).maybeSingle();
 if(prior.error)return disciplinaryJson({error:'Existing attachments could not be checked. Retry before uploading again.'},503);if(prior.data)return disciplinaryJson({file:prior.data,alreadyUploaded:true});
 const uploaded=await access.db.storage.from(disciplinaryBucket).upload(objectKey,bytes,{contentType:file.type,upsert:false});if(uploaded.error)return disciplinaryJson({error:'The attachment could not be uploaded. Your report is unchanged.'},503);
 const filename=file.name.replace(/[\x00-\x1f/\\]/g,'_').slice(0,240)||'Supporting document';
 const row={id,department_id:access.context.department.id,report_id:reportId,object_key:objectKey,original_filename:filename,mime_type:file.type,byte_size:bytes.length,sha256,uploaded_by:access.context.user.id,uploaded_by_name:access.context.user.email};
 const saved=await access.db.from('disciplinary_report_files').insert(row).select('id,report_id,original_filename,mime_type,byte_size,uploaded_at,uploaded_by_name,sha256').single();
 if(saved.error)return disciplinaryJson({error:'The attachment upload was not confirmed. Refresh the report before trying again.'},503);
 return disciplinaryJson({file:saved.data},201);
}
