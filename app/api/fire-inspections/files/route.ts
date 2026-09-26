import { ensureDatabase } from '../../../../db/bootstrap';
import { getSupabaseServerClient } from '../../../supabase-server';
import { inspectionBoundary,inspectionJson } from '../../../fire-inspections/server';
export async function POST(request:Request) {
  const denied=inspectionBoundary(request,true);if(denied)return denied;
  try {
    const form=await request.formData(),file=form.get('file'),recordId=String(form.get('recordId')??''),codeId=String(form.get('codeId')??''),checkId=String(form.get('checkId')??''),caption=String(form.get('caption')??'').trim().slice(0,1000);
    if(!(file instanceof File)||Boolean(recordId)===Boolean(codeId)||file.size<=0||file.size>4194304)return inspectionJson({error:'Choose a saved record and a PDF or photo up to 4 MB.'},400);
    const extensions:Record<string,string>={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
    if(!extensions[file.type])return inspectionJson({error:'Use a PDF, JPG, PNG, or WebP file.'},400);
    const bytes=new Uint8Array(await file.arrayBuffer()),head=Array.from(bytes.slice(0,12));
    const valid=file.type==='application/pdf'?new TextDecoder().decode(bytes.slice(0,5))==='%PDF-':file.type==='image/jpeg'?head[0]===255&&head[1]===216&&head[2]===255:file.type==='image/png'?head.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
    if(!valid)return inspectionJson({error:'The file contents do not match the selected file type.'},400);
    const db=await ensureDatabase(),department=request.headers.get('x-department-id')!;
    let recordVersion:number|null=null;
    if(recordId){const record=await db.prepare('SELECT id,payload,version FROM fire_inspection_pilot_records WHERE department_id=? AND id=? AND archived=0').bind(department,recordId).first<{id:string;payload:string;version:number}>();if(!record)return inspectionJson({error:'Save the record before attaching a file.'},404);const data=JSON.parse(record.payload);if(data.alternativeReview?.enabled&&data.alternativeReview.status!=='Draft')return inspectionJson({error:'Open Plan → Advanced review → Evidence to add supporting files. This returns the review to Draft so the new evidence can be reviewed.'},409);if(data.inspectorAttested||data.representative?.state==='Signed'||data.inspectorSignature?.state==='Signed')return inspectionJson({error:'Edit the inspection and clear its signatures before adding new evidence.'},409);if(data.status==='Completed')return inspectionJson({error:'Reopen this completed report before adding evidence.'},409);if(checkId&&!data.checks.some((c:{id:string})=>c.id===checkId))return inspectionJson({error:'This deficiency is not in the saved inspection. Save your progress first.'},400);recordVersion=record.version;}
    else if(!await db.prepare('SELECT id FROM fire_inspection_code_entries WHERE department_id=? AND id=? AND archived=0').bind(department,codeId).first())return inspectionJson({error:'Save the code entry before attaching a document.'},404);
    if(checkId&&(!recordId||!file.type.startsWith('image/')))return inspectionJson({error:'Use a photo for a deficiency. Attach PDFs to the full inspection.'},400);
    const id=crypto.randomUUID(),key=`${department}/${recordId||codeId}/${id}.${extensions[file.type]}`,supabase=await getSupabaseServerClient(),createdAt=new Date().toISOString();
    const {error}=await supabase.storage.from('stickney-fire-inspections-pilot').upload(key,bytes,{contentType:file.type,upsert:false});
    if(error)return inspectionJson({error:'The file could not upload. Retry after checking your connection.'},503);
    const filename=file.name.replace(/[\r\n\x00-\x1f]/g,'').slice(0,240)||`document.${extensions[file.type]}`;
    try {const columns='INSERT INTO fire_inspection_pilot_files(id,department_id,record_id,code_id,check_id,caption,record_version,object_key,filename,content_type,size_bytes,created_at,created_by) ';const values=[id,department,recordId||null,codeId||null,checkId,caption,recordVersion,key,filename,file.type,file.size,createdAt,request.headers.get('oai-authenticated-user-email')!];const statement=recordId?db.prepare(columns+'SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? FROM fire_inspection_pilot_records WHERE id=? AND department_id=? AND version=? AND archived=0').bind(...values,recordId,department,recordVersion):db.prepare(columns+'SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? FROM fire_inspection_code_entries WHERE id=? AND department_id=? AND archived=0').bind(...values,codeId,department);await statement.expectChanges(1).run();}
    catch {await supabase.storage.from('stickney-fire-inspections-pilot').remove([key]);return inspectionJson({error:'The attachment record did not save. Please retry.'},503);}
    return inspectionJson({attachment:{id,recordId,codeId,checkId,caption,recordVersion,filename,size:file.size,contentType:file.type,createdAt}},201);
  }catch {return inspectionJson({error:'The file was not saved. Retry with a PDF or photo up to 4 MB.'},503);}
}
