import {inspectionBoundary,inspectionJson} from '../../../fire-inspections/server';
import {requireNativeInspectionAccess} from '../../../fire-inspections/access-context';
import {ownerIdentityId} from '../../../fire-inspections/team-workflow';
export async function GET(request:Request){
 const denied=await inspectionBoundary(request);if(denied)return denied;
 try{const context=await requireNativeInspectionAccess(request),db=context.db;
  const rows=await db.prepare("SELECT e.id,e.name,COALESCE(ep.email,'') email FROM employees e LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND (ep.end_date IS NULL OR ep.end_date='' OR ep.end_date>=?) ORDER BY e.name LIMIT 1001").bind(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago'}).format(new Date())).all();
  if(rows.results.length>1000)throw Error('Too many assignment identities.');
  return inspectionJson({identities:[{id:ownerIdentityId,name:'Pilot owner',email:request.headers.get('oai-authenticated-user-email')},...rows.results],accessRollout:context.rolloutEnabled});
 }catch{return inspectionJson({error:'Assignment identities could not load. Existing assignments remain saved.'},503);}
}
