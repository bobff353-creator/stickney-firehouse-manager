import { ensureDatabase } from '../../../../../db/bootstrap';
import { getSupabaseServerClient } from '../../../../supabase-server';
import { nerisBoundary,nerisJson } from '../../../../neris/server';
export async function GET(request:Request,context:{params:Promise<{id:string}>}) {
  const denied=nerisBoundary(request);if(denied)return denied;
  try {
    const {id}=await context.params,db=await ensureDatabase();
    const row=await db.prepare('SELECT object_key objectKey,filename,content_type contentType FROM neris_pilot_files WHERE department_id=? AND id=?').bind(request.headers.get('x-department-id')!,id).first<{objectKey:string;filename:string;contentType:string}>();
    if(!row)return nerisJson({error:'Attachment not found.'},404);
    const client=await getSupabaseServerClient(),{data,error}=await client.storage.from('stickney-neris-pilot').download(row.objectKey);
    if(error||!data)return nerisJson({error:'The file could not be opened. Retry.'},503);
    return new Response(data,{headers:{'Content-Type':row.contentType,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(row.filename)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }catch{return nerisJson({error:'The file could not be opened. Retry.'},503);}
}
