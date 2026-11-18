import {createHash} from 'node:crypto';
import {ensureDatabase} from '../../../../db/bootstrap';
import {hasPermission,canReadPreplanLifecycle,preplanReadAccess} from '../../../server-permissions';
import {getPortalStorage} from '../../../portal-storage';
import {isSafePhoto} from '../../../upload-security';
const txt=(v:unknown,n=2000)=>String(v??'').trim().slice(0,n);
export async function GET(request:Request){
 const db=await ensureDatabase();
 if(!await hasPermission(request,db,'field_preplans.view'))return Response.json({error:'Preplan access is required.'},{status:403});
 const access=await preplanReadAccess(request,db);
 const rows=await db.prepare("SELECT o.id,o.preplan_id preplanId,o.address,o.note,o.priority,o.status,o.actor,o.created_at createdAt,o.photo_key photoKey,p.publication_status publicationStatus,p.created_by createdBy,p.updated_by updatedBy FROM field_preplan_observations o LEFT JOIN field_preplans p ON p.id=o.preplan_id ORDER BY o.created_at DESC LIMIT 200").all();
 return Response.json({observations:rows.results.filter(r=>!r.preplanId||canReadPreplanLifecycle(r,access)).map(r=>({...r,photoKey:undefined,photoUrl:r.photoKey?'/api/field-preplans/observations/photo?id='+encodeURIComponent(String(r.id)):null}))},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
 let key='';
 try{
  const db=await ensureDatabase();
  if(!await hasPermission(request,db,'field_preplans.edit')||request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Preplan edit permission is required.'},{status:403});
  const form=await request.formData(),id=txt(form.get('id'),80),preplanId=txt(form.get('preplanId'),80),address=txt(form.get('address'),240),note=txt(form.get('note'),3000),priority=form.get('priority')==='urgent'?'urgent':'routine',photo=form.get('photo');
  if(!/^[\w-]{8,80}$/.test(id)||!address||!note)return Response.json({error:'Choose a building or enter an address, then add what you noticed.'},{status:400});
  if(preplanId&&!await db.prepare('SELECT id FROM field_preplans WHERE id=?').bind(preplanId).first())return Response.json({error:'Building not found.'},{status:404});
  const actor=request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase()??'';
  let photoType:string|null=null,photoName:string|null=null;
  if(photo instanceof File&&photo.size){
   if(!await hasPermission(request,db,'field_preplans.manage_attachments'))return Response.json({error:'Photo permission is required. Save the note without the photo or contact your administrator.'},{status:403});
   if(photo.size>12*1024*1024||!await isSafePhoto(photo))return Response.json({error:'Choose a supported photo up to 12 MB.'},{status:400});
   photoName=photo.name.replace(/[^\w.-]/g,'_').slice(0,100);photoType=photo.type;key=`field-observations/${id}/${createHash('sha256').update(Buffer.from(await photo.arrayBuffer())).digest('hex')}-${photoName}`;
  }
  const read=()=>db.prepare('SELECT id,actor,note,address,preplan_id preplanId,priority,photo_key photoKey FROM field_preplan_observations WHERE id=?').bind(id).first();
  const same=(row:Record<string,unknown>)=>row.actor===actor&&row.note===note&&row.address===address&&row.preplanId===(preplanId||null)&&row.priority===priority&&row.photoKey===(key||null);
  const old=await read();
  if(old)return same(old)?Response.json({ok:true,id}):Response.json({error:'This save ID already contains different information. Start another observation.'},{status:409});
  if(key&&photo instanceof File)await getPortalStorage().put(key,photo.stream(),{httpMetadata:{contentType:photoType!}});
  const result=await db.prepare('INSERT INTO field_preplan_observations(id,preplan_id,address,note,priority,photo_key,photo_type,photo_name,actor,created_at) VALUES(?,NULLIF(?,\'\'),?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,preplanId,address,note,priority,key||null,photoType,photoName,actor,new Date().toISOString()).run();
  if(!result.meta?.changes){const saved=await read();if(key&&saved?.photoKey!==key)await getPortalStorage().delete(key);if(!saved||!same(saved))return Response.json({error:'This save ID already contains different information. Start another observation.'},{status:409});}
  return Response.json({ok:true,id});
 // An interrupted database response may follow a committed save. Keep the
 // private, deterministic photo key so a retry cannot erase a saved photo.
 }catch{return Response.json({error:'Observation was not confirmed. Keep your note and photo and retry.'},{status:503});}
}
