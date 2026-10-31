import {disciplinarySession,disciplinaryJson,disciplinaryUuid,disciplinaryRoster} from '../../disciplinary/server';
import {disciplinaryErrors,type DisciplinaryContent} from '../../disciplinary/model';
export async function GET(request:Request){
 const access=await disciplinarySession(request);if(!access.ok)return access.response;
 const params=new URL(request.url).searchParams;const id=params.get('id');
 try{
  if(id){
   if(!disciplinaryUuid(id))return disciplinaryJson({error:'Choose a saved report.'},400);
   const [report,versions,files]=await Promise.all([
    access.db.from('disciplinary_reports').select('*').eq('department_id',access.context.department.id).eq('id',id).maybeSingle(),
    access.db.from('disciplinary_report_versions').select('report_id,version,status,change_reason,actor_name,saved_at').eq('department_id',access.context.department.id).eq('report_id',id).order('version',{ascending:false}),
    access.db.from('disciplinary_report_files').select('id,report_id,original_filename,mime_type,byte_size,uploaded_at,uploaded_by_name,sha256').eq('department_id',access.context.department.id).eq('report_id',id).order('uploaded_at')]);
   if(report.error||versions.error||files.error)throw Error('Read failed');
   if(!report.data)return disciplinaryJson({error:'This report is unavailable in your department.'},404);
   const version=params.get('version');let snapshot=null;
   if(version){if(!/^\d{1,7}$/.test(version)||Number(version)<1)return disciplinaryJson({error:'Choose a saved version.'},400);const result=await access.db.from('disciplinary_report_versions').select('*').eq('department_id',access.context.department.id).eq('report_id',id).eq('version',Number(version)).maybeSingle();if(result.error)throw result.error;if(!result.data)return disciplinaryJson({error:'This saved version was not found.'},404);snapshot=result.data;}
   return disciplinaryJson({report:report.data,versions:versions.data,files:files.data,snapshot});
  }
  const pageText=params.get('page')||'0';if(!/^\d{1,4}$/.test(pageText)||Number(pageText)>1000)return disciplinaryJson({error:'Choose a valid history page.'},400);const page=Number(pageText);
  const employee=params.get('employee')||'';const status=params.get('status')||'';
  if(employee.length>160||!['','draft','submitted'].includes(status))return disciplinaryJson({error:'Choose valid history filters.'},400);
  let query=access.db.from('disciplinary_reports').select('id,status,version,updated_at,created_at,submitted_at,created_by_name,updated_by_name,content->employeeName,content->incidentDate,content->disciplineStep',{count:'exact'}).eq('department_id',access.context.department.id);
  if(employee)query=query.eq('content->>employeeId',employee);if(status==='submitted')query=query.not('submitted_at','is',null);else if(status==='draft')query=query.eq('status','draft');
  const [reports,people]=await Promise.all([query.order('updated_at',{ascending:false}).order('id',{ascending:false}).range(page*25,page*25+24),disciplinaryRoster()]);
  if(reports.error)throw reports.error;
  return disciplinaryJson({reports:reports.data||[],total:reports.count||0,page,people,canManageAccess:access.context.grants.includes('permissions.manage')});
 }catch{return disciplinaryJson({error:'Disciplinary reports could not be loaded. Reconnect and retry.'},503);}
}
export async function POST(request:Request){
 const access=await disciplinarySession(request,true);if(!access.ok)return access.response;
 let body;try{body=await request.json();}catch{return disciplinaryJson({error:'Enter valid report details.'},400);}
 if(!body||!disciplinaryUuid(body.id)||!disciplinaryUuid(body.operation)||!Number.isInteger(body.version)||body.version<0||!['draft','submitted'].includes(body.status)||typeof body.reason!=='string'||body.reason.length>2000||!body.content||JSON.stringify(body.content).length>900000)return disciplinaryJson({error:'Choose a report, its saved version, and valid report details.'},400);
 try{
  const errors=disciplinaryErrors(body.content as DisciplinaryContent,body.status==='submitted');if(errors.length)return disciplinaryJson({error:errors.join(' ')},400);
 }catch{return disciplinaryJson({error:'Enter valid report fields.'},400);}
 try{
  const result=await access.db.rpc('disciplinary_save',{p_department:access.context.department.id,p_id:body.id,p_version:body.version,p_content:body.content,p_status:body.status,p_reason:body.reason,p_operation:body.operation});
  if(result.error)return disciplinaryJson({error:result.error.code==='40001'?result.error.message:result.error.code==='42501'?'This report is unavailable for your department access.':result.error.code==='P0001'?result.error.message:'Save was not confirmed. Refresh and review before retrying.'},result.error.code==='40001'?409:result.error.code==='42501'?403:400);
  if(result.data?.id!==body.id||result.data?.last_operation_id!==body.operation)return disciplinaryJson({error:'Save was not confirmed. Refresh and review before retrying.'},503);
  return disciplinaryJson({report:result.data});
 }catch{return disciplinaryJson({error:'Save confirmation was not received. Your entries are retained. Retry the same save to confirm it.'},503);}
}
