import { randomBytes,createHash } from 'node:crypto';
import { getDb } from '../../../db';
import { permissionsForEmail } from '../../server-permissions';
import { locationDatabase,readLocationSnapshot } from '../../lib/apparatus-location-store';
const noStore={'Cache-Control':'private, no-store'};
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
async function access(request: Request) {
 const department=request.headers.get('x-department-id')||'',user=request.headers.get('x-authenticated-user-id')||'',email=request.headers.get('oai-authenticated-user-email')||'';
 if(!uuid.test(department)||!uuid.test(user)||department!==process.env.PAYROLL_DEPARTMENT_ID?.trim()||!email) return null;
 const permissions=await permissionsForEmail(email,getDb());
 if(!permissions.has('field_preplans.view')) return null;
 return {department,user,email,canManage:permissions.has('settings.manage')||permissions.has('inventory.setup.manage')};
}
export async function GET(request: Request) {
 try {
  const actor=await access(request);if(!actor)return Response.json({error:'Apparatus location access is required.'},{status:403,headers:noStore});
  return Response.json({...await readLocationSnapshot(actor.department,actor.user),departmentId:actor.department,userId:actor.user,canManage:actor.canManage},{headers:noStore});
 }catch{return Response.json({error:'Vehicle locations are unavailable. Call updates are separate.'},{status:503,headers:noStore});}
}
export async function POST(request: Request) {
 try {
  if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Open setup from Respond.'},{status:403,headers:noStore});
  const actor=await access(request);if(!actor?.canManage)return Response.json({error:'Apparatus setup permission is required.'},{status:403,headers:noStore});
  const raw=await request.text();if(raw.length>2048)return Response.json({error:'Setup request is too large.'},{status:413,headers:noStore});
  const body=JSON.parse(raw) as Record<string,unknown>,db=locationDatabase();
  const apparatusId=typeof body.apparatusId==='string'?body.apparatusId.slice(0,80):'';
  const apparatus=await db.prepare("SELECT id,unit_number unit FROM fleet_apparatus WHERE id=? AND (retired_at IS NULL OR retired_at='')").bind(apparatusId).first<{id:string;unit:string}>();
  if(!apparatus)return Response.json({error:'Select an active fleet apparatus.'},{status:400,headers:noStore});
  if(body.action==='revoke'){
   await db.prepare('UPDATE apparatus_trackers SET enabled=false,token_hash=NULL,sequence=sequence+1 WHERE department_id=?::uuid AND apparatus_id=? AND enabled=true').bind(actor.department,apparatusId).run();
   return Response.json({ok:true},{headers:noStore});
  }
  if(body.action!=='pair'||!['browser','windows'].includes(String(body.senderKind)))return Response.json({error:'Choose browser or Windows tracking.'},{status:400,headers:noStore});
  const name=typeof body.deviceName==='string'?body.deviceName.trim().slice(0,60):'';
  if(!name)return Response.json({error:'Enter a device name, such as Engine mounted Surface.'},{status:400,headers:noStore});
  const token=randomBytes(32).toString('base64url'),hash=createHash('sha256').update(token).digest('hex');
  const device=Buffer.from(JSON.stringify({name,kind:body.senderKind,actor:actor.email})).toString('base64');
  const result=await db.prepare('SELECT * FROM pair_apparatus_tracker(?::uuid,?,?,?)').bind(actor.department,apparatusId,hash,device).first<{deviceId:string;expiresAt:string}>();
  if(!result)throw Error('Pairing was not confirmed.');
  const headers=new Headers(noStore);
  if(body.senderKind==='browser')headers.set('Set-Cookie',`__Secure-firehouse-tracker=${token}; Path=/api/apparatus-locations/ingest; Max-Age=7776000; HttpOnly; Secure; SameSite=Strict`);
  return Response.json({ok:true,...result,apparatusId,unit:apparatus.unit,senderKind:body.senderKind,...(body.senderKind==='windows'?{setup:{endpoint:new URL('/api/apparatus-locations/ingest',request.url).toString(),token,unit:apparatus.unit}}:{})},{headers});
 }catch{return Response.json({error:'Device setup could not be saved. No success is assumed; refresh the device list before retrying.'},{status:503,headers:noStore});}
}
