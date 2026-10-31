import {disciplinarySession,disciplinaryJson,disciplinaryUuid} from '../../../disciplinary/server';
import {disciplinaryPdf} from '../../../disciplinary/report-pdf';
import type {DisciplinaryVersion,DisciplinaryFile} from '../../../disciplinary/model';
export async function GET(request:Request){
 const access=await disciplinarySession(request);if(!access.ok)return access.response;
 const params=new URL(request.url).searchParams,id=params.get('id'),version=params.get('version');
 if(!disciplinaryUuid(id)||!version||!/^\d{1,7}$/.test(version)||Number(version)<1)return disciplinaryJson({error:'Choose a saved report version.'},400);
 try{const [saved,files]=await Promise.all([access.db.from('disciplinary_report_versions').select('*').eq('department_id',access.context.department.id).eq('report_id',id).eq('version',Number(version)).maybeSingle(),access.db.from('disciplinary_report_files').select('id,report_id,original_filename,mime_type,byte_size,uploaded_at,uploaded_by_name,sha256').eq('department_id',access.context.department.id).eq('report_id',id)]);
  if(saved.error||files.error)throw Error('Report unavailable');if(!saved.data)return disciplinaryJson({error:'This saved version is unavailable.'},404);
  const bytes=await disciplinaryPdf(id,saved.data as DisciplinaryVersion,(files.data||[]) as DisciplinaryFile[]);
  return new Response(new Uint8Array(bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':`inline; filename="Disciplinary-${id}-v${version}.pdf"`,'Cache-Control':'private, no-store',Pragma:'no-cache',Vary:'Cookie','X-Content-Type-Options':'nosniff'}});
 }catch{return disciplinaryJson({error:'This PDF could not be created. Your saved report is unchanged. Reconnect and retry.'},503);}
}
