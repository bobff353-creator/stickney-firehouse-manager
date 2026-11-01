import {disciplinarySession,disciplinaryJson,disciplinaryUuid,disciplinaryRoster} from '../../../disciplinary/server';
import {prepareAladtecSource} from '../../../disciplinary/import-model';
export async function POST(request:Request){
 const access=await disciplinarySession(request,true);if(!access.ok)return access.response;
 if(!access.context.grants.includes('permissions.manage'))return disciplinaryJson({error:'A disciplinary permissions administrator must perform historical imports.'},403);
 let body;try{body=await request.json();}catch{return disciplinaryJson({error:'Provide the captured source record.'},400);}
 try{
  let result;
  if(body?.operation==='prepare'){
   if(JSON.stringify(body.source).length>1500000)return disciplinaryJson({error:'The captured source record is too large.'},400);
   const source=prepareAladtecSource(body.source,await disciplinaryRoster());
   result=await access.db.rpc('disciplinary_import_prepare',{p_department:access.context.department.id,p_source:source});
  }else if(body?.operation==='finish'&&disciplinaryUuid(body.stageId)){
   result=await access.db.rpc('disciplinary_import_finish',{p_department:access.context.department.id,p_stage:body.stageId});
  }else return disciplinaryJson({error:'Choose a verified import operation.'},400);
  if(result.error)return disciplinaryJson({error:result.error.code==='40001'?result.error.message:result.error.code==='42501'?'Historical import access is required.':result.error.code==='P0001'?result.error.message:'The import was not confirmed. No existing report was replaced.'},result.error.code==='40001'?409:result.error.code==='42501'?403:400);
  if(!result.data?.reportId)return disciplinaryJson({error:'Import confirmation was not received. Reconcile before retrying.'},503);
  return disciplinaryJson(result.data);
 }catch(error){return disciplinaryJson({error:error instanceof Error?error.message:'The captured source record could not be verified.'},400);}
}
