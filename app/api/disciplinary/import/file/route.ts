import {createHash} from 'node:crypto';
import {disciplinarySession,disciplinaryJson,disciplinaryUuid,disciplinaryBucket} from '../../../../disciplinary/server';
import {disciplinaryFileLimit} from '../../../../disciplinary/model';
export async function POST(request:Request){
 const access=await disciplinarySession(request,true);if(!access.ok)return access.response;
 if(!access.context.grants.includes('permissions.manage'))return disciplinaryJson({error:'Historical import administrator access is required.'},403);
 const form=await request.formData();const id=form.get('stageId'),file=form.get('file');
 if(!disciplinaryUuid(id)||!(file instanceof File)||file.type!=='application/pdf'||file.size>disciplinaryFileLimit)return disciplinaryJson({error:'Choose the captured source PDF for this import.'},400);
 const found=await access.db.from('disciplinary_import_staging').select('id,object_key,pdf_sha256,pdf_size,completed_at').eq('department_id',access.context.department.id).eq('id',id).eq('created_by',access.context.user.id).maybeSingle();
 if(found.error)return disciplinaryJson({error:'The import stage could not be verified.'},503);if(!found.data)return disciplinaryJson({error:'Import stage unavailable.'},404);const stage=found.data;
 const bytes=Buffer.from(await file.arrayBuffer());const digest=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
 if(bytes.subarray(0,5).toString()!=='%PDF-'||bytes.length!==Number(stage.pdf_size)||digest(bytes)!==stage.pdf_sha256)return disciplinaryJson({error:'The PDF does not match the captured source checksum and size. No report was changed.'},400);
 const bucket=access.db.storage.from(disciplinaryBucket);
 const previous=await bucket.download(stage.object_key);if(previous.data){const saved=Buffer.from(await previous.data.arrayBuffer());return digest(saved)===stage.pdf_sha256?disciplinaryJson({uploaded:true,alreadyUploaded:true}):disciplinaryJson({error:'A different file already exists at this import location. It was not replaced.'},409);}
 const uploaded=await bucket.upload(stage.object_key,bytes,{contentType:'application/pdf',upsert:false});
 if(uploaded.error){const retry=await bucket.download(stage.object_key);if(retry.data&&digest(Buffer.from(await retry.data.arrayBuffer()))===stage.pdf_sha256)return disciplinaryJson({uploaded:true,alreadyUploaded:true});return disciplinaryJson({error:'The source PDF upload was not confirmed. Reconcile before retrying.'},503);}
 const verified=await bucket.download(stage.object_key);if(!verified.data||digest(Buffer.from(await verified.data.arrayBuffer()))!==stage.pdf_sha256)return disciplinaryJson({error:'Source PDF persistence was not confirmed. No report has been imported yet.'},503);
 return disciplinaryJson({uploaded:true},201);
}
