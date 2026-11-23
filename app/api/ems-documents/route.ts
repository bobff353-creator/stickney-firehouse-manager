import {ensureDatabase} from '../../../db/bootstrap';
import {hasPermission} from '../../server-permissions';
import {getPortalDepartment} from '../../department-portal';
import {getPortalStorage} from '../../portal-storage';
import {getSupabaseServerClient} from '../../supabase-server';
import {emsDocument,emsFileName,validEmsFileName,validEmsPdf} from '../../ems-document-model';

const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store',Vary:'Cookie'}});
async function listNames(prefix:string){
  const client=await getSupabaseServerClient(),names:string[]=[];
  for(let offset=0;;offset+=100){
    const {data,error}=await client.storage.from('firehouse-portal').list(prefix,{offset,limit:100,sortBy:{column:'name',order:'asc'}});
    if(error)throw error;
    names.push(...(data||[]).map(row=>row.name));
    if(!data||data.length<100)return names;
  }
}
async function boundary(request:Request,write=false){
  const department=await getPortalDepartment();
  if(!request.headers.get('oai-authenticated-user-email')||request.headers.get('x-department-id')!==department.id)return {denied:json({error:'Verified department access required.'},401)};
  const db=await ensureDatabase();
  if(!await hasPermission(request,db,'documents.view'))return {denied:json({error:'Document access is not enabled.'},403)};
  const canAdd=await hasPermission(request,db,'policies.manage');
  if(write&&!canAdd)return {denied:json({error:'Document administrator permission is required.'},403)};
  return {department,canAdd};
}
export async function GET(request:Request){
  try{
    const access=await boundary(request);if(access.denied)return access.denied;
    const file=new URL(request.url).searchParams.get('file');
    if(file!==null){
      if(!validEmsFileName(file))return json({error:'Document not found.'},404);
      if(await getPortalStorage().get(`ems-document-trash/${file}.json`))return json({error:'This document was deleted from the library. Ask a document administrator to restore it.'},404);
      const stored=await getPortalStorage().get(`ems-documents/${file}`);
      if(!stored)return json({error:'Document not found.'},404);
      const download=new URL(request.url).searchParams.get('download')==='1';
      return new Response(stored.body,{headers:{'Content-Type':'application/pdf','Content-Disposition':`${download?'attachment':'inline'}; filename="${file.slice(38)}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; frame-ancestors 'self'",Vary:'Cookie'}});
    }
    const prefix=access.department.isolated?`departments/${access.department.id}/`:'';
    const [names,markers]=await Promise.all([listNames(`${prefix}ems-documents`),listNames(`${prefix}ems-document-trash`)]);
    const removed=new Set(markers.filter(name=>name.endsWith('.json')).map(name=>name.slice(0,-5)).filter(validEmsFileName));
    const all=names.filter(validEmsFileName).map(emsDocument).sort((a,b)=>a.title.localeCompare(b.title));
    return json({items:all.filter(item=>!removed.has(item.name)),deleted:access.canAdd?all.filter(item=>removed.has(item.name)):[],canAdd:access.canAdd});
  }catch{return json({error:'EMS documents could not load. Please retry.'},503);}
}
async function changeRemoval(request:Request,restore:boolean){
  try{
    const access=await boundary(request,true);if(access.denied)return access.denied;
    const body=await request.json(),name=typeof body.name==='string'?body.name:'';
    if(!validEmsFileName(name))return json({error:'Choose an uploaded EMS document.'},400);
    const storage=getPortalStorage();
    if(!await storage.get(`ems-documents/${name}`))return json({error:'Document not found. Refresh the list.'},404);
    const key=`ems-document-trash/${name}.json`;
    if(restore)await storage.delete(key);
    else await storage.put(key,new Blob([JSON.stringify({name,deletedAt:new Date().toISOString(),deletedBy:request.headers.get('oai-authenticated-user-email')})]).stream(),{httpMetadata:{contentType:'application/json'}});
    return json({item:emsDocument(name),deleted:!restore});
  }catch{return json({error:'The change could not be confirmed. Refresh the document list before retrying.'},503);}
}
export async function DELETE(request:Request){return changeRemoval(request,false);}
export async function PATCH(request:Request){return changeRemoval(request,true);}
export async function POST(request:Request){
  try{
    const access=await boundary(request,true);if(access.denied)return access.denied;
    const length=Number(request.headers.get('content-length')||0);if(length>4.4*1024*1024)return json({error:'Choose a PDF up to 4 MB.'},413);
    const form=await request.formData(),file=form.get('file'),title=String(form.get('title')||'');
    if(!(file instanceof File)||!await validEmsPdf(file))return json({error:'Choose a valid PDF up to 4 MB.'},400);
    let name:string;try{name=emsFileName(title,crypto.randomUUID());}catch{return json({error:'Enter a document title using letters or numbers.'},400);}
    await getPortalStorage().put(`ems-documents/${name}`,file.stream(),{httpMetadata:{contentType:'application/pdf'}});
    return json({item:emsDocument(name)},201);
  }catch{return json({error:'The upload could not be confirmed. Refresh the list before retrying; your selected file is kept.'},503);}
}
