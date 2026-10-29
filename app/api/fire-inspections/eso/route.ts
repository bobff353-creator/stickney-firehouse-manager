import {createHash} from 'node:crypto';
import {ensureDatabase} from '../../../../db/bootstrap';
import {getSupabaseServerClient} from '../../../supabase-server';
import {inspectionBoundary,inspectionJson} from '../../../fire-inspections/server';
import {esoGuid,esoMedia,esoMime,esoObject,esoSummary,esoText,validateEsoBundle} from '../../../fire-inspections/eso-model';
import {materializeEsoInspection} from '../../../fire-inspections/eso-materialize';
const bucket='stickney-fire-inspections-eso';
const hash=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
type SourceRow={inspectionId:string;sha256:string;objectKey:string;summary:string;importedAt:string};
type FileRow={attachmentId:string;sha256:string;objectKey:string;filename:string;contentType:string;size:number};
const sourceColumns='inspection_id inspectionId,sha256,object_key objectKey,summary,imported_at importedAt';
const fileColumns='attachment_id attachmentId,sha256,object_key objectKey,filename,content_type contentType,size_bytes size';
async function source(db:Awaited<ReturnType<typeof ensureDatabase>>,department:string,id:string){
 if(!esoGuid(id))throw Error('Choose an imported ESO inspection.');
 return db.prepare(`SELECT ${sourceColumns} FROM fire_inspection_eso_records WHERE department_id=? AND inspection_id=?`).bind(department,id).first<SourceRow>();
}
async function original(row:SourceRow,storage:Awaited<ReturnType<typeof getSupabaseServerClient>>['storage']){
 const {data,error}=await storage.from(bucket).download(row.objectKey);if(error||!data)throw Error('The preserved ESO source could not load. Retry.');
 const raw=await data.text();if(hash(raw)!==row.sha256)throw Error('The preserved ESO source failed its integrity check.');return esoObject(JSON.parse(raw));
}
export async function GET(request:Request){
 const denied=inspectionBoundary(request);if(denied)return denied;
 try{
 const db=await ensureDatabase(),department=request.headers.get('x-department-id')!,p=new URL(request.url).searchParams;
 if(p.has('file')){
  const id=p.get('file');if(!esoGuid(id))throw Error('Choose an original attachment.');
  const row=await db.prepare(`SELECT ${fileColumns} FROM fire_inspection_eso_files WHERE department_id=? AND attachment_id=?`).bind(department,id).first<FileRow>();
  if(!row)return inspectionJson({error:'This original attachment has not been copied yet.'},404);
  const {data,error}=await(await getSupabaseServerClient()).storage.from(bucket).createSignedUrl(row.objectKey,60,p.has('download')?{download:row.filename}:undefined);
  if(error||!data)throw Error('The original attachment could not open. Retry.');
  return new Response(null,{status:307,headers:{Location:data.signedUrl,'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
 }
 if(p.has('id')){
  const row=await source(db,department,p.get('id')||'');if(!row)return inspectionJson({error:'This ESO inspection is not imported.'},404);
  const b=await original(row,(await getSupabaseServerClient()).storage);
  const files=await db.prepare(`SELECT ${fileColumns} FROM fire_inspection_eso_files WHERE department_id=?`).bind(department).all<FileRow>();
  const ids=new Set(esoMedia(b).map(m=>m.attachmentId));
  return inspectionJson({summary:JSON.parse(row.summary),source:b,sha256:row.sha256,files:files.results.filter(f=>ids.has(f.attachmentId)).map(f=>({...f,objectKey:undefined}))});
 }
 const rows=await db.prepare(`SELECT ${sourceColumns} FROM fire_inspection_eso_records WHERE department_id=? ORDER BY inspection_id LIMIT 10001`).bind(department).all<SourceRow>();
 if(rows.results.length>10000)throw Error('Add pagination before importing more records.');
 return inspectionJson({departmentId:department,records:rows.results.map(r=>JSON.parse(r.summary))});
 }catch(e){return inspectionJson({error:e instanceof Error?e.message:'ESO copies could not load. Retry.'},503);}
}
export async function POST(request:Request){
 const denied=inspectionBoundary(request,true);if(denied)return denied;
 try{
 const raw=await request.text();if(raw.length>1500000)return inspectionJson({error:'Import one ESO inspection at a time.'},413);
 const body=esoObject(JSON.parse(raw)),department=request.headers.get('x-department-id')!;
 if(body.departmentId!==department)return inspectionJson({error:'The destination department changed. No data was copied.'},409);
 const db=await ensureDatabase(),client=await getSupabaseServerClient(),store=client.storage.from(bucket),time=new Date().toISOString();
 if(body.action==='record'){
  const b=validateEsoBundle(body.source),id=esoText(esoObject(b.index).inspectionId),payload=JSON.stringify(b),sha=hash(payload),current=await source(db,department,id);
  if(current){if(current.sha256!==sha)return inspectionJson({error:'This ESO inspection already has a different saved source. Both versions need review; the existing copy was kept.'},409);return inspectionJson({saved:true,existing:true,sha256:sha,summary:JSON.parse(current.summary)});}
  const key=`${department}/records/${id}/${sha}.json`,bytes=new TextEncoder().encode(payload);
  const uploaded=await store.upload(key,bytes,{contentType:'application/json',upsert:false});
  if(uploaded.error){const prior=await store.download(key);if(prior.error||!prior.data||hash(await prior.data.text())!==sha)throw Error('The original source upload was not confirmed. Retry the same inspection.');}
  const summary=esoSummary(b,time);
  await db.prepare('INSERT INTO fire_inspection_eso_records(department_id,inspection_id,sha256,object_key,summary,imported_at,imported_by) VALUES(?,?,?,?,?,?,?) ON CONFLICT(department_id,inspection_id) DO NOTHING').bind(department,id,sha,key,JSON.stringify(summary),time,request.headers.get('oai-authenticated-user-email')!).run();
  const saved=await source(db,department,id);if(saved?.sha256!==sha)return inspectionJson({error:'Another import saved different source evidence. The existing copy was kept.'},409);
  return inspectionJson({saved:true,sha256:sha,summary:JSON.parse(saved.summary)},201);
 }
 if(!['prepare-file','finish-file','activate'].includes(esoText(body.action)))throw Error('Choose a supported ESO import action.');
 const row=await source(db,department,esoText(body.inspectionId));if(!row)throw Error('Copy the original inspection before its files.');
 const b=await original(row,client.storage);
 if(body.action==='activate'){
  const files=await db.prepare(`SELECT ${fileColumns} FROM fire_inspection_eso_files WHERE department_id=?`).bind(department).all<FileRow>();
  const saved=await materializeEsoInspection(db,department,b,row.sha256,time,request.headers.get('oai-authenticated-user-email')!,files.results);
  return inspectionJson({saved:true,...saved},saved.existing?200:201);
 }
 const media=esoMedia(b).find(m=>m.attachmentId===body.attachmentId);if(!media)throw Error('This attachment is not in the preserved ESO inspection.');
 const existing=await db.prepare(`SELECT ${fileColumns} FROM fire_inspection_eso_files WHERE department_id=? AND attachment_id=?`).bind(department,media.attachmentId).first<FileRow>();
 if(existing){if(existing.sha256!==media.sha256||existing.size!==media.size)return inspectionJson({error:'This source attachment ID has conflicting bytes. The saved original was kept.'},409);return inspectionJson({saved:true,existing:true,attachmentId:media.attachmentId,sha256:media.sha256});}
 const extension=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'} as Record<string,string>)[media.contentType];
 const key=`${department}/files/${media.attachmentId}/${media.sha256}.${extension}`;
 if(body.action==='prepare-file'){
  const {data,error}=await store.createSignedUploadUrl(key,{upsert:false});if(error||!data)throw Error('An upload could not start. Retry the same original file.');
  return inspectionJson({uploadUrl:data.signedUrl,attachmentId:media.attachmentId});
 }
 const file=await store.download(key);if(file.error||!file.data)throw Error('The original file is not uploaded yet.');
 const bytes=new Uint8Array(await file.data.arrayBuffer());if(bytes.length!==media.size||hash(bytes)!==media.sha256||esoMime(bytes)!==media.contentType)throw Error('The uploaded file differs from the ESO original. It was not attached.');
 await db.prepare('INSERT INTO fire_inspection_eso_files(department_id,attachment_id,sha256,object_key,filename,content_type,size_bytes,imported_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(department_id,attachment_id) DO NOTHING').bind(department,media.attachmentId,media.sha256,key,media.filename,media.contentType,media.size,time).run();
 const saved=await db.prepare('SELECT sha256,size_bytes size FROM fire_inspection_eso_files WHERE department_id=? AND attachment_id=?').bind(department,media.attachmentId).first<{sha256:string;size:number}>();
 if(saved?.sha256!==media.sha256||saved.size!==media.size)return inspectionJson({error:'The attachment receipt conflicts with the original. No existing file was replaced.'},409);
 return inspectionJson({saved:true,attachmentId:media.attachmentId,sha256:media.sha256},201);
 }catch(e){return inspectionJson({error:e instanceof Error?e.message:'Copy was not confirmed. Reconcile saved copies before retrying.'},400);}
}
