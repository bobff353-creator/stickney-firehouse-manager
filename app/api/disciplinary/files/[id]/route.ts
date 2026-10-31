import {disciplinarySession,disciplinaryJson,disciplinaryUuid,disciplinaryBucket} from '../../../../disciplinary/server';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const access=await disciplinarySession(request);if(!access.ok)return access.response;const {id}=await params;
 if(!disciplinaryUuid(id))return disciplinaryJson({error:'Choose a saved attachment.'},400);
 const file=await access.db.from('disciplinary_report_files').select('object_key,original_filename,mime_type').eq('id',id).eq('department_id',access.context.department.id).maybeSingle();
 if(file.error)return disciplinaryJson({error:'The attachment could not be checked. Retry.'},503);if(!file.data)return disciplinaryJson({error:'This attachment is unavailable.'},404);
 const downloaded=await access.db.storage.from(disciplinaryBucket).download(file.data.object_key);if(downloaded.error||!downloaded.data)return disciplinaryJson({error:'The original attachment is temporarily unavailable. Retry.'},503);
 return new Response(downloaded.data,{headers:{'Content-Type':file.data.mime_type,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.data.original_filename)}`,'Cache-Control':'private, no-store',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff'}});
}
