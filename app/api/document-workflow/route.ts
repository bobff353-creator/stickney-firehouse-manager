import { ensureDatabase } from '../../../db/bootstrap';
import { hasPermission } from '../../server-permissions';
import { readDocumentWorkflow,saveDocumentDraft,publishDocument,archiveDocument,acknowledgeDocument,DocumentConflict } from '../../document-workflow-store';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie'}});
async function employeeFor(request:Request,db:Awaited<ReturnType<typeof ensureDatabase>>) {
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const rows=await db.prepare('SELECT e.id FROM employees e LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND e.id=employee_id_for_login(?) AND (ep.end_date IS NULL OR ep.end_date=? OR ep.end_date>=?) LIMIT 2').bind(request.headers.get('oai-authenticated-user-email')!.trim().toLowerCase(),'',today).all<{id:string}>();
  return rows.results.length===1?rows.results[0].id:'';
}
export async function GET(request:Request) {
  try {
    if(!request.headers.get('oai-authenticated-user-email')||!request.headers.get('x-department-id'))return json({error:'Verified department access is required.'},401);
    const db=await ensureDatabase();if(!await hasPermission(request,db,'documents.view'))return json({error:'Document access is not enabled for this account.'},403);
    const id=new URL(request.url).searchParams.get('id')??'',manager=await hasPermission(request,db,'policies.manage'),employee=await employeeFor(request,db);
    const result=await readDocumentWorkflow(db,id,employee,manager);
    return result?json({...result,canManage:manager}):json({error:'This document is unavailable.'},404);
  }catch{return json({error:'Document history could not load. Retry; current records were not changed.'},503);}
}
export async function POST(request:Request) {
  let writing=false;
  try {
    const actor=request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
    if(!actor||!request.headers.get('x-department-id'))return json({error:'Verified department access is required.'},401);
    const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Open the document in this portal before saving.'},403);
    const text=await request.text();if(text.length>75000)return json({error:'This draft is too large.'},413);
    const body=JSON.parse(text) as Record<string,unknown>,id=String(body.id??''),action=String(body.action??''),revision=body.revision;
    if(!/^[a-zA-Z0-9_-]{1,100}$/.test(id))return json({error:'Choose a saved document.'},400);
    const db=await ensureDatabase();
    if(action==='acknowledge') {
      if(!await hasPermission(request,db,'documents.view'))return json({error:'Document access is not enabled for this account.'},403);
      if(body.attested!==true||typeof body.version!=='string'||body.version.length>80)return json({error:'Read the current version and select the acknowledgement statement.'},400);
      const employee=await employeeFor(request,db);
      if(!employee)return json({error:'Your verified login must be linked to one active member before acknowledging.'},403);
      writing=true;return json({acknowledgement:await acknowledgeDocument(db,id,body.version,employee,actor),saved:true});
    }
    if(!await hasPermission(request,db,'policies.manage'))return json({error:'Document management is not enabled for this account.'},403);
    if(typeof revision!=='string'||revision.length>80)return json({error:'Reload the saved document before editing.'},400);
    writing=true;
    if(action==='saveDraft')return json({state:await saveDocumentDraft(db,id,body.content,revision,actor),id,saved:true});
    if(action==='publish') {
      if(typeof body.requiresAcknowledgement!=='boolean')return json({error:'Choose whether this version requires acknowledgement.'},400);
      return json({state:await publishDocument(db,id,revision,body.requiresAcknowledgement,actor),saved:true});
    }
    if(action==='archive'||action==='restore')return json({state:await archiveDocument(db,id,revision,action==='archive',actor),saved:true});
    return json({error:'Choose a listed document action.'},400);
  }catch(error){
    if(error instanceof DocumentConflict)return json({error:error.message,code:'SAVE_CONFLICT'},409);
    const message=error instanceof Error?error.message:'';
    if(message.startsWith('Portal database')||message.startsWith('Portal transaction')||writing&&!message)return json({error:'The save was not confirmed. Keep your draft and retry.'},503);
    return json({error:message||'Check the document details and retry.'},400);
  }
}
