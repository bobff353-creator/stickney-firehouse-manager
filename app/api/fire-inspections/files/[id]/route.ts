import { ensureDatabase } from '../../../../../db/bootstrap';
import { getSupabaseServerClient } from '../../../../supabase-server';
import { inspectionBoundary,inspectionJson } from '../../../../fire-inspections/server';
export async function GET(request:Request,context:{params:Promise<{id:string}>}) {
  const denied=inspectionBoundary(request);if(denied)return denied;
  try {
    const {id}=await context.params,db=await ensureDatabase();
    const row=await db.prepare('SELECT object_key objectKey,filename,content_type contentType FROM fire_inspection_pilot_files WHERE department_id=? AND id=?').bind(request.headers.get('x-department-id')!,id).first<{objectKey:string;filename:string;contentType:string}>();
    if(!row)return inspectionJson({error:'Attachment not found.'},404);
    const client=await getSupabaseServerClient(),{data,error}=await client.storage.from('stickney-fire-inspections-pilot').download(row.objectKey);
    if(error||!data)return inspectionJson({error:'The file could not be opened. Retry.'},503);
    return new Response(data,{headers:{'Content-Type':row.contentType,'Content-Disposition':`${new URL(request.url).searchParams.get('inline')==='1'&&row.contentType.startsWith('image/')?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(row.filename)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }catch{return inspectionJson({error:'The file could not be opened. Retry.'},503);}
}
