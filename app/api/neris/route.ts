import {ensureDatabase} from '../../../db/bootstrap';
import {nerisBoundary,nerisJson,columns,decode,type Stored} from '../../neris/server';
import {normalizeData,reviewPackage} from '../../neris/model';
import {validateReport} from '../../neris/validation';
import {savedReviewPackage} from '../../neris/saved-package';
import type {NerisFile} from '../../neris/model';
export async function GET(request:Request){const denied=nerisBoundary(request);if(denied)return denied;try{const db=await ensureDatabase(),department=request.headers.get('x-department-id')!,url=new URL(request.url);
 if(url.searchParams.has('history'))return nerisJson({history:(await db.prepare('SELECT version,payload,archived,actor,created_at createdAt FROM neris_pilot_audit WHERE department_id=? AND record_id=? ORDER BY version DESC LIMIT 200').bind(department,url.searchParams.get('history')).all()).results});
 if(url.searchParams.has('export')){
  const row=await db.prepare(`SELECT ${columns} FROM neris_pilot_records WHERE department_id=? AND id=?`).bind(department,url.searchParams.get('export')).first<Stored>();if(!row)return nerisJson({error:'Report not found.'},404);
  if(url.searchParams.get('exportMode')==='handoff'){
   const expected=url.searchParams.get('version');if(!expected||!/^\d+$/.test(expected)||Number(expected)!==row.version)return nerisJson({error:'The saved version changed. Reopen it before downloading a review packet.',code:'SAVE_CONFLICT'},409);if(row.kind!=='incident')return nerisJson({error:'Choose a saved incident report.'},400);
   const files=await db.prepare('SELECT id,record_id recordId,filename,size_bytes size,content_type contentType,created_at createdAt FROM neris_pilot_files WHERE department_id=? AND record_id=? ORDER BY created_at,id LIMIT 10001').bind(department,row.id).all<NerisFile>();if(files.results.length>10000)throw Error('File limit');
   const current=await db.prepare('SELECT version FROM neris_pilot_records WHERE department_id=? AND id=?').bind(department,row.id).first<{version:number}>();if(current?.version!==row.version)return nerisJson({error:'The saved version changed during export. Reopen it and retry.',code:'SAVE_CONFLICT'},409);
   return nerisJson(savedReviewPackage(decode(row),files.results,department));
  }return nerisJson(reviewPackage(decode(row)));
 }
 const [records,members,files]=await Promise.all([db.prepare(`SELECT ${columns} FROM neris_pilot_records WHERE department_id=? ORDER BY updated_at DESC LIMIT 2001`).bind(department).all<Stored>(),db.prepare('SELECT e.id,e.name,p.label rank FROM employees e LEFT JOIN pay_scales p ON p.id=e.pay_scale_id ORDER BY e.name').all(),db.prepare('SELECT id,record_id recordId,filename,size_bytes size,content_type contentType,created_at createdAt FROM neris_pilot_files WHERE department_id=? ORDER BY created_at DESC LIMIT 10001').bind(department).all()]);if(records.results.length>2000||files.results.length>10000)throw Error('Limit');return nerisJson({departmentId:department,records:records.results.map(decode),members:members.results,attachments:files.results});
 }catch{return nerisJson({error:'Reports could not load. Retry; saved records have not changed.'},503);}}
export async function POST(request:Request){const denied=nerisBoundary(request,true);if(denied)return denied;let writing=false;try{
 const raw=await request.text();if(raw.length>600000)return nerisJson({error:'The report is too large. Use attachments for supporting documents.'},413);const body=JSON.parse(raw),data=normalizeData(body.data);
 if(body.action==='validate')return nerisJson({issues:validateReport(data),officialValidation:false});
 const {id,version,kind}=body;if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{8,120}$/.test(id)||!Number.isInteger(version)||version<0||!['incident','settings'].includes(kind))throw Error('Invalid report identity or version.');
 const department=request.headers.get('x-department-id')!,actor=request.headers.get('oai-authenticated-user-email')!.trim().toLowerCase(),db=await ensureDatabase(),time=new Date().toISOString(),archived=body.archived===true?1:0,payload=JSON.stringify(data);
 const row=await db.prepare(`SELECT ${columns} FROM neris_pilot_records WHERE department_id=? AND id=?`).bind(department,id).first<Stored>(),current=row?decode(row):null;
 if(current&&current.kind!==kind)throw Error('The record type cannot change.');
 if(row&&row.version===version+1&&row.payload===payload&&row.archived===archived)return nerisJson({saved:true,record:current});
 if((current?.version??0)!==version)return nerisJson({error:'Another save changed this report. Your draft is kept. Download it before opening the current saved version.',code:'SAVE_CONFLICT'},409);
 if(current&&current.data.local.test!==data.local.test)throw Error('A report cannot change between test and operational use.');
 if(current?.data.local.status==='Reviewed'&&row?.payload!==payload&&(data.local.status!=='Draft'||!data.local.changeReason.trim()))throw Error('Reopen with a correction reason before changing a reviewed report.');
 if(kind==='incident'&&data.local.status==='Reviewed'){const issues=validateReport(data);if(issues.length)return nerisJson({error:'Resolve the review items before marking this report reviewed.',issues},400);}
 const write=version?db.prepare('UPDATE neris_pilot_records SET payload=?,version=version+1,archived=?,updated_at=?,updated_by=? WHERE department_id=? AND id=? AND version=?').bind(payload,archived,time,actor,department,id,version).expectChanges(1):db.prepare('INSERT INTO neris_pilot_records(id,department_id,kind,payload,version,archived,created_at,updated_at,updated_by) VALUES(?,?,?,?,1,?,?,?,?)').bind(id,department,kind,payload,archived,time,time,actor).expectChanges(1);
 writing=true;await db.batch([write,db.prepare('INSERT INTO neris_pilot_audit(id,department_id,record_id,version,kind,payload,archived,actor,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),department,id,version+1,kind,payload,archived,actor,time)]);
 const saved=await db.prepare(`SELECT ${columns} FROM neris_pilot_records WHERE department_id=? AND id=?`).bind(department,id).first<Stored>();return nerisJson({saved:true,record:saved?decode(saved):null},current?200:201);
 }catch(e){const message=e instanceof Error?e.message:'';if(/SAVE_CONFLICT|duplicate key/.test(message))return nerisJson({error:'A newer save exists. Keep this draft and reload the saved report.',code:'SAVE_CONFLICT'},409);if(writing||/database|bootstrap|fetch/i.test(message))return nerisJson({error:'Save was not confirmed. Keep this draft and retry; the same save will not duplicate a report.'},503);return nerisJson({error:message||'The report could not be saved.'},400);}}
