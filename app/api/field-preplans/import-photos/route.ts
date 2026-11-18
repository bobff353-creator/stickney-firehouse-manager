import {createHash} from 'node:crypto';
import {ensureDatabase} from '../../../../db/bootstrap';
import {hasPermission} from '../../../server-permissions';
import {getPortalStorage} from '../../../portal-storage';
import {isSafePhoto} from '../../../upload-security';
type Spec={id:string;key:string;name:string;type:string;size:number;sha256:string;caption:string};
export async function POST(request:Request){
 let storedKey='';
 try{
  const db=await ensureDatabase();
  if(!await hasPermission(request,db,'field_preplans.manage_attachments')||request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Photo management permission is required.'},{status:403});
  const form=await request.formData(),file=form.get('photo');if(!(file instanceof File)||file.size>12*1024*1024)return Response.json({error:'Choose a source photo up to 12 MB.'},{status:400});
  const id=file.name;
  if(!/^flow-[a-f0-9-]{36}$/.test(id))return Response.json({error:'Choose a photo from the reviewed import package.'},{status:400});
  const sources=await db.prepare('SELECT preplan_id preplanId,payload FROM field_preplan_external_details').all();
  let match:{preplanId:string;spec:Spec}|null=null;
  for(const source of sources.results){const spec=(JSON.parse(String(source.payload)).integrationPhotos as Spec[]|undefined)?.find(f=>f.id===id);if(spec){match={preplanId:String(source.preplanId),spec};break;}}
  if(!match)return Response.json({error:'This photo is not in the reviewed missing-photo list.'},{status:400});
  const old=await db.prepare('SELECT preplan_id preplanId FROM field_preplan_photos WHERE id=?').bind(id).first();
  if(old)return old.preplanId===match.preplanId?Response.json({ok:true,id,existing:true}):Response.json({error:'Photo identity conflict.'},{status:409});
  const bytes=await file.arrayBuffer(),spec=match.spec;
  if(bytes.byteLength!==spec.size||createHash('sha256').update(Buffer.from(bytes)).digest('hex')!==spec.sha256||!await isSafePhoto(new Blob([bytes],{type:spec.type})))return Response.json({error:'Photo content does not match the reviewed source.'},{status:400});
  storedKey=`field-preplans/${match.preplanId}/${id}-${spec.sha256.slice(0,16)}`;
  await getPortalStorage().put(storedKey,new Blob([bytes],{type:spec.type}).stream(),{httpMetadata:{contentType:spec.type}});
  const caption=spec.caption.replace(/^FlowMSP source image\.\s*/,'').replace(/Original review \d{4}-\d{2}-\d{2}\.\s*/,'').slice(0,500);
  await db.prepare("INSERT INTO field_preplan_photos(id,preplan_id,side,object_key,filename,content_type,size_bytes,caption,created_by) VALUES(?,?,'OVERVIEW',?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(id,match.preplanId,storedKey,spec.name,spec.type,spec.size,caption,request.headers.get('oai-authenticated-user-email')||'').run();
  return Response.json({ok:true,id});
 }catch{return Response.json({error:'Photo import was not confirmed. Retry the same source file; existing photos will not duplicate.'},{status:503});}
}
