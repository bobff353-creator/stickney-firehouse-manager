import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url);
function loader(overrides={}){const cache=new Map();function load(p){p=resolve(p);if(Object.hasOwn(overrides,p))return overrides[p];if(cache.has(p))return cache.get(p).exports;const target={exports:{}};cache.set(p,target);const js=ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('require','module','exports',js)(n=>n.startsWith('.')?load(resolve(dirname(p),extname(n)?n:n+'.ts')):require(n),target,target.exports);return target.exports;}return load;}

async function harness(){const pg=new PGlite();await pg.exec('CREATE SCHEMA firehouse;CREATE ROLE anon;CREATE ROLE authenticated;SET search_path=firehouse;CREATE TABLE field_preplans(id text primary key,business_name text,address text,updated_at text,latitude float,longitude float,access_info text,knox_box text,fdc text,alarm_system text,sprinkler_system text);');const ddl=fs.readFileSync('supabase/migrations/20260925032225_fire_inspections_private_pilot.sql','utf8').split('CREATE OR REPLACE FUNCTION')[0];await pg.exec(ddl);await pg.exec(fs.readFileSync('supabase/migrations/20260925104123_inspection_reports_codes_and_evidence.sql','utf8'));let failAt=-1;const base=loader({[resolve('app/supabase-server.ts')]:{},[resolve('app/department-portal.ts')]:{getPortalDepartment:async()=>({id:'fixture-department',isolated:false})}});const db=base('db/postgres-adapter.ts').createPostgresD1Adapter(async()=>({rpc:async(name,args)=>{try{const run=async(tx,s)=>{const r=await tx.query(s.sql);if(s.requiredChanges!=null&&r.affectedRows!==s.requiredChanges)throw Error('SAVE_CONFLICT');return s.mode==='first'?r.rows[0]??null:s.mode==='all'?r.rows:{success:true,meta:{changes:r.affectedRows}};};const result=name.endsWith('_batch')?await pg.transaction(async tx=>{const rows=[];for(const[i,s]of args.p_statements.entries()){if(i===failAt){failAt=-1;throw Error('Simulated transaction failure');}rows.push(await run(tx,s));}return rows;}):await run(pg,{sql:args.p_sql,mode:args.p_mode});return{data:result,error:null};}catch(e){return{data:null,error:{message:e.message}};}}}));const api=loader({[resolve('db/bootstrap.ts')]:{ensureDatabase:async()=>db}})('app/api/fire-inspections/route.ts');const request=(body,email='bobff353@gmail.com',department='fixture-department',origin='http://localhost')=>new Request('http://localhost/api/fire-inspections',{method:body?'POST':'GET',headers:{'content-type':'application/json','oai-authenticated-user-email':email,'x-department-id':department,origin},...(body?{body:JSON.stringify(body)}:{})});return{pg,db,api,request,fail(index){failAt=index;},close:()=>pg.close()};}
const load=loader(),native=load('app/fire-inspections/eso-native.ts'),model=load('app/fire-inspections/model.ts');
const sourceId='00000000-0000-4000-8000-000000000001',fileId='00000000-0000-4000-8000-000000000002',sha='a'.repeat(64);
function source(status='locked'){
 return{index:{inspectionId:sourceId,inspectionNumber:'TEST-ONLY-77',inspectionStatusId:status,inspectionType:'Test source inspection type',propertyName:'Fictional source property',address1:'TEST ADDRESS',leadInspectorName:'Test inspector'},metadata:{data:{inspectionId:sourceId,inspectionStatusId:status,propertyId:'test-source-property'}},details:{data:{scheduledDate:'03/08/2026 00:00:00',scheduledTime:'10:30:00',receivedDate:'03/01/2026 00:00:00',times:[{inspectionDate:'2026-03-08T00:00:00-06:00',startTime:'10:32:00',endTime:'10:50:00'}],otherInspectorIds:[]},lists:{}},contacts:{data:{selectedContactId:'test-contact',contacts:[{itemId:'test-contact',name:'Fictional contact',address1:null,emails:[{emailAddress:'test@example.invalid'}],phones:[{phoneNumber:'0000000000',phoneTypeId:null}],note:null}]}},inspectionCodes:{data:{checklistFireCodes:[{inspectionChecklistFireCodeId:'unanswered',fireCodeId:'test-code'}],compliances:[{complianceId:'test-failed',fireCodeId:'test-code',complianceState:'FAILED'},{complianceId:'test-resolved',fireCodeId:'test-code',complianceState:'FAILED'}],violations:[{violationId:'open',complianceId:'test-failed',location:'Fictional test location',comments:'Exact source wording.',isResolved:false,attachments:[{itemId:fileId,description:'Original photo caption'}]},{violationId:'resolved',complianceId:'test-resolved',isResolved:true,resolvedComments:'Fictional documented correction',resolvedDate:'2026-03-10T00:00:00-05:00'}]}},notes:{data:[{inspectionNoteId:'test-note',note:'Exact original note.',updatedBy:'Test inspector',updatedAt:'2026-03-08T10:40:00-06:00'}]},signatures:{data:{contactSignedAt:'2026-03-08T10:50:00-06:00',contactSignature:[[0,-1,1,0]],selectedContact:'Fictional contact',scheduleReinspectionId:'yes',reinspectionDate:'2026-03-20T00:00:00-05:00'}},history:{data:{}},permits:{data:null},sourceCodes:{fireCodes:[{fireCodeId:'test-code',code:'TEST-CODE',title:'Test requirement',description:'Exact test source requirement.'}],fireCodeSets:[]},importEvidence:{media:[{attachmentId:fileId,filename:'fictional.jpg',sha256:sha,size:3,contentType:'image/jpeg'}]}};
}
test('native conversion preserves exact facts, local calendar dates, missing answers, and resolution without a new signature',()=>{
 const b=source(),before=JSON.stringify(b),r=native.nativeEsoInspection(b,sha,'2026-10-28T12:00:00Z','test@example.invalid');
 assert.equal(r.id,'eso-'+sourceId);assert.equal(r.data.title,b.index.propertyName);assert.equal(r.data.type,b.index.inspectionType);assert.equal(r.data.status,'Completed');
 assert.equal(r.data.scheduledDate,'2026-03-08');assert.equal(r.data.actualDate,'2026-03-08');assert.equal(r.data.scheduledTime,'10:30');assert.equal(r.data.contact,'Fictional contact');assert.equal(r.data.email,'test@example.invalid');
 assert.deepEqual(r.data.checks.map(c=>c.result),['Not checked','Needs attention','Resolved']);assert.equal(r.data.checks[1].observation,'Exact source wording.');assert.equal(r.data.checks[2].correctedDate,'2026-03-10');assert.equal(r.data.checks[0].priority,'');
 assert.equal(r.data.outcome,'');assert.equal(r.data.inspectorAttested,false);assert.equal(r.data.representative.state,'Not requested');assert.equal(r.data.followUpDate,'2026-03-20');assert.equal(r.data.reinspectionDecision,'');assert.equal(r.data.propertyId,'');
 assert.match(r.data.notes,/Exact original note/);assert.deepEqual(model.normalizeInspection(r.data),r.data);assert.equal(JSON.stringify(b),before);
});
test('every source status maps explicitly; scheduled and in-progress inspections remain editable',()=>{
 for(const [from,to]of [['locked','Completed'],['scheduled','Scheduled'],['inprogress','In progress'],['cancelled','Canceled']]){const r=native.nativeEsoInspection(source(from),sha,'2026-10-28','test');assert.equal(r.data.status,to);if(from!=='locked')model.validateInspection('inspection',model.normalizeInspection(r.data),'2026-10-28');}
 assert.equal(native.esoDate('02/30/2026'),'');assert.equal(native.esoDate('2026-11-01T00:00:00+14:00'),'2026-11-01');assert.equal(native.esoDate('0001-01-01T00:00:00Z'),'');
});
test('contacts and supplemental information contain readable values without nulls, configuration, or unresolved IDs',()=>{
 const b=source();b.contacts.data.contacts[0].roleIds=['00000000-0000-4000-8000-000000000099'];assert.deepEqual(native.esoContactCards(b)[0].roles,[]);
 const facts=native.readableEsoFields(b,'contacts',{name:'Test contact',note:null,itemId:sourceId,phones:[{phoneNumber:'0000000000',phoneTypeId:null}],isEmergencyContact:false});
 assert.ok(facts.some(f=>f.value==='Test contact'));assert.ok(facts.some(f=>f.value==='No'));assert.ok(!JSON.stringify(facts).includes(sourceId));assert.ok(!JSON.stringify(facts).includes('null'));
});
test('original file links retain their finding and exact bytes instead of generating copies',()=>{
 const rows=native.nativeEsoFiles(source());assert.equal(rows.length,1);assert.equal(rows[0].checkId,'eso-check-open');assert.equal(rows[0].caption,'Original photo caption');assert.equal(rows[0].sha256,sha);
 const resolver=load('app/fire-inspections/file-storage.ts');assert.deepEqual(resolver.inspectionFileStorage('eso:test-department/files/original','test-department'),{bucket:'stickney-fire-inspections-eso',objectKey:'test-department/files/original'});assert.throws(()=>resolver.inspectionFileStorage('eso:another-department/files/original','test-department'));assert.throws(()=>resolver.inspectionFileStorage('test-department/../other','test-department'));
});
async function activateHarness(){const h=await harness(),materialize=load('app/fire-inspections/eso-materialize.ts').materializeEsoInspection;const files=[{attachmentId:fileId,sha256:sha,objectKey:'fixture-department/files/original',filename:'fictional.jpg',contentType:'image/jpeg',size:3}];return{...h,files,activate:(b=source(),hash=sha,f=files)=>materialize(h.db,'fixture-department',b,hash,'2026-10-28T12:00:00Z','test@example.invalid',f)};}
test('activation is atomic and idempotent, keeps one native inspection, one audit version and one original file reference',async()=>{
 const h=await activateHarness();try{let saved=await h.activate();assert.equal(saved.existing,false);assert.equal(saved.record.data.status,'Completed');saved=await h.activate();assert.equal(saved.existing,true);
  for(const table of ['fire_inspection_pilot_records','fire_inspection_pilot_audit','fire_inspection_pilot_files'])assert.equal((await h.pg.query('select count(*)::int n from '+table)).rows[0].n,1);
  const file=(await h.pg.query('select * from fire_inspection_pilot_files')).rows[0];assert.equal(file.object_key,'eso:fixture-department/files/original');assert.equal(file.check_id,'eso-check-open');
  const changed={...saved.record,data:{...saved.record.data,notes:'Saved native progress',status:'Draft',changeReason:'Fictional correction test only'}};const response=await h.api.POST(h.request(changed));assert.equal(response.status,200,await response.clone().text());
  const again=await h.activate();assert.equal(again.record.data.notes,'Saved native progress');assert.equal(again.record.version,2);
 }finally{await h.close();}
});
test('missing or conflicting originals and interrupted transactions do not create partial visits or files',async()=>{
 const h=await activateHarness();try{await assert.rejects(()=>h.activate(source(),sha,[]),/attachment/);h.fail(2);await assert.rejects(()=>h.activate(),/Simulated transaction failure/);assert.equal((await h.pg.query('select count(*)::int n from fire_inspection_pilot_records')).rows[0].n,0);await h.activate();await assert.rejects(()=>h.activate(source(),'b'.repeat(64)),/different saved data/);}finally{await h.close();}
});
test('ordinary saves cannot forge, remove or change provenance, or bypass completion/correction rules',async()=>{
 const h=await activateHarness();try{const {record:r}=await h.activate();
  for(const data of [{...r.data,importedSource:undefined},{...r.data,importedSource:{...r.data.importedSource,sha256:'b'.repeat(64)}}])assert.equal((await h.api.POST(h.request({...r,data}))).status,400);
  assert.equal((await h.api.POST(h.request({...r,id:'fictional-forged-new',version:0}))).status,400);
  assert.equal((await h.api.POST(h.request({...r,data:{...r.data,notes:'Unapproved historical change'}}))).status,400);
  assert.equal((await h.api.GET(h.request(undefined,'unrelated@example.invalid'))).status,403);
  assert.equal((await h.api.POST(h.request(r,'bobff353@gmail.com','another-department'))).status,400);
 }finally{await h.close();}
});
test('native PDFs include original contacts and signature drawings without creating a new attestation',async()=>{
 const pdf=loader({[resolve('app/supabase-server.ts')]:{}})('app/fire-inspections/report-pdf.ts'),b=source(),r=native.nativeEsoInspection(b,sha,'2026-10-28T12:00:00Z','test@example.invalid');
 const bytes=await pdf.buildInspectionPdf(r,[],b),doc=await require('pdf-lib').PDFDocument.load(bytes);assert.ok(doc.getPageCount()>=2);assert.ok(bytes.length>1000);assert.equal(r.data.inspectorAttested,false);assert.equal(r.data.representative.state,'Not requested');
});
