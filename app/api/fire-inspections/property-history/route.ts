import { ensureDatabase } from '../../../../db/bootstrap';
import { inspectionBoundary, inspectionJson } from '../../../fire-inspections/server';
import { canReadPreplanLifecycle, preplanReadAccess } from '../../../server-permissions';
import { historyCursor, parseHistoryCursor, propertyHistorySql, type PropertyHistoryEntry } from '../../../property-history-model';
export async function GET(request:Request){
  const denied=inspectionBoundary(request);if(denied)return denied;
  const params=new URL(request.url).searchParams,property=params.get('property')||'',department=request.headers.get('x-department-id')!;
  if(!property||property.length>100)return inspectionJson({error:'Choose a saved department property.'},400);
  let cursor;try{cursor=parseHistoryCursor(params.get('cursor'));}catch(e){return inspectionJson({error:(e as Error).message},400);}
  try{
    const db=await ensureDatabase(),access=await preplanReadAccess(request,db);
    // Historical working revisions can contain details beyond the current published preplan.
    if(!access.canViewWorking||!access.canViewPublished)return inspectionJson({error:'Preplan review access is required for connected history.'},403);
    const plan=await db.prepare('SELECT id,business_name name,address,publication_status publicationStatus,created_by createdBy,updated_by updatedBy,updated_at updatedAt,revision_number revisionNumber,next_review_date nextReviewDate FROM field_preplans WHERE id=?').bind(property).first<{id:string;name:string;address:string;publicationStatus:string;createdBy:string;updatedBy:string;updatedAt:string;revisionNumber:number;nextReviewDate:string}>();
    if(!plan||!canReadPreplanLifecycle(plan,access))return inspectionJson({error:'This property is unavailable in this department.'},404);
    const suffix=cursor ? ' WHERE (at<? OR (at=? AND key<?))' : '';
    const statement=db.prepare(propertyHistorySql+suffix+' ORDER BY at DESC,key DESC LIMIT 26');
    const rows=await (cursor?statement.bind(department,property,property,cursor.at,cursor.at,cursor.key):statement.bind(department,property,property)).all<PropertyHistoryEntry>();
    const current=await db.prepare("SELECT id,payload,version FROM fire_inspection_pilot_records WHERE department_id=? AND kind='inspection' AND archived=0 AND payload::jsonb->>'propertyId'=? AND COALESCE(payload::jsonb->>'test','false')<>'true' ORDER BY updated_at DESC LIMIT 1001").bind(department,property).all<{id:string;payload:string;version:number}>();if(current.results.length>1000)return inspectionJson({error:'Property summary needs paged loading.'},503);const inspections=current.results.map(r=>({...r,data:JSON.parse(r.payload)}));const summary={inspectionRecords:inspections.length,findings:inspections.reduce((n,r)=>n+(r.data.checks||[]).filter((c:{result:string})=>c.result==='Needs attention').length,0),proposedObservations:inspections.filter(r=>Object.values(r.data.preplanObservations||{}).some(v=>String(v||'').trim())).length,publishedState:plan.publicationStatus,revision:plan.revisionNumber,dueDate:plan.nextReviewDate||''};
    const entries=rows.results.slice(0,25),more=rows.results.length>25;
    return inspectionJson({property:{id:plan.id,name:plan.name,address:plan.address,updatedAt:plan.updatedAt},summary,entries,nextCursor:more?historyCursor(entries[entries.length-1]):null,incidentLinkState:'not_recorded'});
  }catch{return inspectionJson({error:'Connected history could not load. Retry; saved records have not changed.'},503);}
}
