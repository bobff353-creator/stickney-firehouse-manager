import {ensureDatabase} from '../../../../db/bootstrap';
import {inspectionBoundary,inspectionJson} from '../../../fire-inspections/server';
import {hasPermission} from '../../../server-permissions';
import {ownerIdentityId} from '../../../fire-inspections/team-workflow';
export async function GET(request:Request){
 const denied=inspectionBoundary(request);if(denied)return denied;
 try{const db=await ensureDatabase();if(!await hasPermission(request,db,'employees.manage'))return inspectionJson({error:'Employee management access is required to assign existing identities.'},403);
  const rows=await db.prepare("SELECT e.id,e.name,COALESCE(ep.email,'') email FROM employees e LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND (ep.end_date IS NULL OR ep.end_date='' OR ep.end_date>=?) ORDER BY e.name LIMIT 1001").bind(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago'}).format(new Date())).all();
  if(rows.results.length>1000)throw Error('Too many assignment identities.');
  return inspectionJson({identities:[{id:ownerIdentityId,name:'Pilot owner',email:request.headers.get('oai-authenticated-user-email')},...rows.results],accessRollout:false});
 }catch{return inspectionJson({error:'Assignment identities could not load. Existing assignments remain saved.'},503);}
}
