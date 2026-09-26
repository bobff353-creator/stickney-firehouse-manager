import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
const require=createRequire(import.meta.url);
function loader(overrides={}){const cache=new Map();function load(p){p=resolve(p);if(Object.hasOwn(overrides,p))return overrides[p];if(cache.has(p))return cache.get(p).exports;if(extname(p)==='.json')return JSON.parse(fs.readFileSync(p,'utf8'));const target={exports:{}};cache.set(p,target);const js=ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText;new Function('require','module','exports',js)(n=>n.startsWith('.')?load(resolve(dirname(p),extname(n)?n:n+'.ts')):require(n),target,target.exports);return target.exports;}return load;}
const core=loader(),model=core('app/training/model.ts'),access=core('app/training/access.ts'),osfm=core('app/training/osfm.ts');
const member={id:'fictional-person',name:'Preview, Member',rank:'Firefighter',active:1};
const data=(v={})=>({...model.emptyTrainingData(),title:'Fictional drill',date:'2026-09-23',hours:2,instructor:'Fictional instructor',employeeIds:[member.id],status:'completed',...v});
const record=(kind='completion',d=data(),id='fixture-record')=>({id,kind,data:d,version:1,archived:false,createdAt:'2026-09-23',updatedAt:'2026-09-23',updatedBy:'fixture@example.invalid'});

test('only the named pilot owner passes the server gate',()=>{assert.equal(access.trainingPilotAccess('BOBFF353@gmail.com '),true);for(const email of ['',null,'admin@stickneyfire.com','bobff353@gmail.com.evil','staff@example.invalid'])assert.equal(access.trainingPilotAccess(email),false);});
test('navigation does not grant Training to ordinary administrators',()=>{const nav=core('app/portal-menu-items.ts');const perms=core('app/permissions.ts');assert.equal(nav.portalNavigationForPermissions(perms.defaultPermissionsForRank('Firefighter',true)).includes('Training'),false);assert.equal(nav.portalNavigationForPermissions(['training.pilot']).includes('Training'),true);assert.equal(perms.permissionCatalog.some(p=>p.key==='training.pilot'),false);});
test('calendar validation and four-year calculation handle invalid dates and leap years',()=>{assert.equal(model.validDate('2026-02-29'),false);assert.equal(model.validDate('2026-13-01'),false);assert.equal(model.validDate('2024-02-29'),true);assert.equal(model.addYears('2024-02-29',1),'2025-02-28');assert.equal(model.addYears('2026-09-24',4),'2030-09-24');assert.equal(model.shiftDate('2026-12-31',1),'2027-01-01');});
test('credit uses actual member attendance and excludes drafts, tests, archives',()=>{const r=record('completion',data({employeeIds:['one','two','absent'],attendance:{two:1.25,absent:0}}));assert.equal(model.creditedHours(r),3.25);assert.equal(model.creditedHours(r,'two'),1.25);for(const changed of [{...r,archived:true},{...r,data:{...r.data,test:true}},{...r,data:{...r.data,status:'draft'}}])assert.equal(model.creditedHours(changed),0);});
test('completion validation rejects invented attendance, future dates and unknown people',()=>{for(const d of [data({date:'2099-01-01'}),data({hours:0}),data({hours:25}),data({instructor:''}),data({employeeIds:['missing']}),data({attendance:{[member.id]:3}})])assert.throws(()=>model.validateTraining('completion',d,[],[member],'2026-09-24'));model.validateTraining('completion',data(),[],[member],'2026-09-24');});
test('draft saves allow incomplete detail, but require a name and valid supplied data',()=>{model.validateTraining('completion',data({status:'draft',date:'',hours:null,employeeIds:[],instructor:''}),[],[]);assert.throws(()=>model.validateTraining('activity',data({status:'draft',title:''}),[],[]));assert.throws(()=>model.normalizeTrainingData({title:'x',hours:'NaN'}));assert.throws(()=>model.normalizeTrainingData({title:'x',sourceUrl:'javascript:alert(1)'}));});
test('required activity selection values are checked on the server',()=>{const a=record('activity',data({status:'saved',fields:[{id:'f1',label:'Result',type:'choice',options:['Pass','Needs practice'],required:true}]}),'activity-1');assert.throws(()=>model.validateTraining('completion',data({activityId:a.id}),[a],[member]));assert.throws(()=>model.validateTraining('completion',data({activityId:a.id,answers:{f1:'made up'}}),[a],[member]));model.validateTraining('completion',data({activityId:a.id,answers:{f1:'Pass'}}),[a],[member]);});
test('assignment counts unique completed members and does not count absent or test entries',()=>{const a=record('assignment',data({employeeIds:['one','two'],dueDate:'2026-10-01',status:'saved'}),'assignment-1');const c=record('completion',data({assignmentId:a.id,employeeIds:['one','two'],attendance:{two:0}}));assert.deepEqual(model.assignmentProgress(a,[c,c,{...c,data:{...c.data,test:true,attendance:{}}}]),{completed:1,total:2});});
test('task evidence must match member and cycle; reviewed proficiency needs evaluator',()=>{const c=record('credential',data({status:'saved',certificationId:'il-353',cycleStart:'2026-01-01',dueDate:'2030-01-01'}),'credential-1');const p=data({status:'saved',credentialId:c.id,certificationId:'il-353',jpr:'7.3.1',sourceUrl:'https://sfm.illinois.gov/book.pdf',sourceEdition:'NFPA 1006 (2021)',sourcePage:'4',result:'Proficient',verified:true,evaluator:'Fictional evaluator'});model.validateTraining('proficiency',p,[c],[member]);for(const changed of [{...p,date:'2025-12-31'},{...p,evaluator:''},{...p,verified:false},{...p,employeeIds:['other']}])assert.throws(()=>model.validateTraining('proficiency',changed,[c],[member]));assert.throws(()=>model.validateTraining('proficiency',p,[c,record('proficiency',{...p,credentialId:'old-cycle'})],[member]));});
test('mixed editions and practice-only entries cannot satisfy a credential task',()=>{const c=record('credential',data({status:'saved',requiredJprs:['7.3.1'],cycleStart:'2026-01-01',dueDate:'2030-01-01',sourceUrl:'https://sfm.illinois.gov/book.pdf',sourceEdition:'2021'}),'credential-1');const p=record('proficiency',data({status:'saved',credentialId:c.id,jpr:'7.3.1',result:'Proficient',verified:true,evaluator:'Evaluator',sourceUrl:c.data.sourceUrl,sourceEdition:'2017'}));assert.equal(osfm.credentialEvidence(c,[p]).documented.length,0);p.data.sourceEdition='2021';assert.equal(osfm.credentialEvidence(c,[p]).documented.length,1);p.data.result='Practiced';assert.equal(osfm.credentialEvidence(c,[p]).documented.length,0);});
test('OSFM export stays not connected and cannot export test credentials',()=>{const c=record('credential',data({status:'saved',certificationId:'il-353',cycleStart:'2026-01-01'}));const s={records:[c],members:[member],attachments:[]};const packet=osfm.osfmHandoff(c,s);assert.equal(packet.delivery.submitted,false);assert.equal(packet.delivery.state,'not_connected');assert.ok(packet.warnings.length>=3);assert.throws(()=>osfm.osfmHandoff({...c,data:{...c.data,test:true}},s));});
test('CSV preserves exact hours, protects formula cells and omits non-credit records',()=>{const csv=model.trainingCsv([record(),record('completion',data({test:true,title:'test/training'}),'test-id')],[{...member,name:'=HYPERLINK("bad")'}]);assert.ok(csv.includes("'=HYPERLINK"));assert.ok(csv.includes('"2"'));assert.ok(!csv.includes('test/training'));assert.equal(csv.split('\r\n').length,2);});
test('published Illinois references preserve distinct current and proposed rules',()=>{const {certificationCatalog}=core('app/training/osfm-catalog.ts');assert.equal(certificationCatalog.length,37);assert.equal(certificationCatalog.filter(c=>c.recertification!=='not-listed').length,28);assert.equal(certificationCatalog.find(c=>c.id==='il-301').recertification,'not-listed');const books=JSON.parse(fs.readFileSync('app/training/osfm-books.json','utf8'));assert.equal(books.find(b=>b.certificationId==='il-301').jprs.length,142);assert.equal(books.find(b=>b.certificationId==='il-353').edition,'NFPA 1006 (2021)');assert.ok(books.every(b=>b.sha256.length===64&&b.jprs.every(j=>j.page<=b.pageCount)));});

async function harness(){const pg=new PGlite();await pg.exec('CREATE SCHEMA firehouse;CREATE ROLE anon;CREATE ROLE authenticated;SET search_path=firehouse;CREATE TABLE employees(id text primary key,name text,active integer,pay_scale_id text);CREATE TABLE pay_scales(id text primary key,label text);');const ddl=fs.readFileSync('supabase/migrations/20260925014536_training_private_pilot.sql','utf8').split('CREATE OR REPLACE FUNCTION')[0];await pg.exec(ddl);await pg.query('insert into employees values($1,$2,1,null)',[member.id,member.name]);let failAt=-1;const base=loader({[resolve('app/supabase-server.ts')]:{}});const db=base('db/postgres-adapter.ts').createPostgresD1Adapter(async()=>({rpc:async(name,args)=>{try{const run=async(tx,s)=>{const r=await tx.query(s.sql);if(s.requiredChanges!=null&&r.affectedRows!==s.requiredChanges)throw Error('SAVE_CONFLICT');return s.mode==='first'?r.rows[0]??null:s.mode==='all'?r.rows:{success:true,meta:{changes:r.affectedRows}};};const result=name.endsWith('_batch')?await pg.transaction(async tx=>{const rows=[];for(const[i,s]of args.p_statements.entries()){if(i===failAt){failAt=-1;throw Error('Simulated transaction failure');}rows.push(await run(tx,s));}return rows;}):await run(pg,{sql:args.p_sql,mode:args.p_mode});return{data:result,error:null};}catch(e){return{data:null,error:{message:e.message}};}}}));const api=loader({[resolve('db/bootstrap.ts')]:{ensureDatabase:async()=>db}})('app/api/training/route.ts');const request=(body,email='bobff353@gmail.com',origin='http://localhost')=>new Request('http://localhost/api/training',{method:body?'POST':'GET',headers:{'content-type':'application/json','oai-authenticated-user-email':email,'x-department-id':'fixture-department',origin},...(body?{body:JSON.stringify(body)}:{})});return{pg,api,request,fail(index){failAt=index;},close:()=>pg.close()};}
test('API denies another admin and cross-origin writes before touching records',async()=>{const h=await harness();try{assert.equal((await h.api.GET(h.request(null,'admin@stickneyfire.com'))).status,403);assert.equal((await h.api.POST(h.request(record(),'bobff353@gmail.com','https://evil.invalid'))).status,403);}finally{await h.close();}});
test('atomic save, lost-response retry, stale edit rejection, archive and audit persistence',async()=>{const h=await harness();try{const r={...record(),version:0};let response=await h.api.POST(h.request(r));assert.equal(response.status,201,await response.clone().text());let j=await response.json();assert.equal(j.record.version,1);response=await h.api.POST(h.request(r));assert.equal(response.status,200);assert.equal((await response.json()).record.version,1);response=await h.api.POST(h.request({...r,data:{...r.data,title:'Conflicting change'}}));assert.equal(response.status,409);response=await h.api.POST(h.request({...j.record,archived:true}));assert.equal(response.status,200);const read=await(await h.api.GET(h.request())).json();assert.equal(read.records.length,1);assert.equal(read.records[0].archived,true);assert.equal(model.creditedHours(read.records[0]),0);assert.equal((await h.pg.query('select * from training_pilot_audit')).rows.length,2);}finally{await h.close();}});
test('failed audit write rolls back the record and retry saves exactly once',async()=>{const h=await harness();try{h.fail(1);const r={...record(),version:0};assert.equal((await h.api.POST(h.request(r))).status,503);assert.equal((await h.pg.query('select * from training_pilot_records')).rows.length,0);assert.equal((await h.api.POST(h.request(r))).status,201);assert.equal((await h.pg.query('select * from training_pilot_audit')).rows.length,1);}finally{await h.close();}});


test('initial and custom credentials never receive the OSFM recertification grace timeline',()=>{const c=record('credential',data({certificationId:'il-353',cycleStart:'2026-01-01',dueDate:'2030-01-01',method:'Recertification'}));assert.equal(osfm.credentialTimeline(c,'2029-09-01').status,'Application window open');assert.equal(osfm.credentialTimeline({...c,data:{...c.data,method:'Initial certification'}}),null);assert.equal(osfm.credentialTimeline({...c,data:{...c.data,certificationId:'custom'}}),null);assert.equal(model.normalizeTrainingData({...c.data,certificationId:'custom'}).certificationId,'custom');assert.throws(()=>osfm.osfmHandoff({...c,data:{...c.data,certificationId:'custom'}},{records:[c],members:[member],attachments:[]}));});
test('test relationships and a wrong certification cannot create real task credit',()=>{const a=record('activity',data({test:true,title:'test/training',status:'saved'}),'test-activity');assert.throws(()=>model.validateTraining('completion',data({activityId:a.id}),[a],[member]));const c=record('credential',data({status:'saved',certificationId:'il-353',cycleStart:'2026-01-01'}),'credential');assert.throws(()=>model.validateTraining('proficiency',data({status:'saved',credentialId:c.id,certificationId:'il-352',jpr:'7.3.1',sourceUrl:'https://sfm.illinois.gov/book.pdf',sourcePage:'4',sourceEdition:'2021'}),[c],[member]));});

test('attachment upload and download deny other accounts before database or storage use',async()=>{const never=async()=>{throw Error('must not reach backend');};const load=loader({[resolve('db/bootstrap.ts')]:{ensureDatabase:never},[resolve('app/supabase-server.ts')]:{getSupabaseServerClient:never}});const upload=load('app/api/training/files/route.ts'),download=load('app/api/training/files/[id]/route.ts');const headers={'oai-authenticated-user-email':'another-admin@example.invalid','x-department-id':'fixture-department'};assert.equal((await upload.POST(new Request('http://localhost/api/training/files',{method:'POST',headers}))).status,403);assert.equal((await download.GET(new Request('http://localhost/api/training/files/private-file',{headers}),{params:Promise.resolve({id:'private-file'})})).status,403);});

function attachmentHarness(){
  const files=new Map(),metadata=[],operations=[];
  let failMetadata=false,recordExists=true;
  const db={prepare(sql){return{bind(...args){return{
    async first(){operations.push('read');if(sql.includes('training_pilot_records'))return recordExists?{id:'fixture-record'}:null;const row=metadata.find(r=>r.id===args[1]&&r.department===args[0]);return row?{objectKey:row.key,filename:row.filename,contentType:row.type}:null;},
    async run(){if(failMetadata)throw Error('Simulated metadata failure');const[id,department,recordId,key,filename,type,size]=args;metadata.push({id,department,recordId,key,filename,type,size});return{success:true};},
  };}};}};
  const storage={from(bucket){assert.equal(bucket,'stickney-training-pilot');return{
    async upload(key,bytes,options){operations.push('upload');assert.equal(options.upsert,false);files.set(key,bytes);return{error:null};},
    async remove(keys){operations.push('remove');for(const key of keys)files.delete(key);return{error:null};},
    async download(key){operations.push('download');return files.has(key)?{data:new Blob([files.get(key)]),error:null}:{data:null,error:{message:'missing'}};},
  };}};
  const load=loader({[resolve('db/bootstrap.ts')]:{ensureDatabase:async()=>db},[resolve('app/supabase-server.ts')]:{getSupabaseServerClient:async()=>({storage})}});
  const headers={'oai-authenticated-user-email':'bobff353@gmail.com','x-department-id':'fixture-department',origin:'http://localhost'};
  return{upload:load('app/api/training/files/route.ts'),download:load('app/api/training/files/[id]/route.ts'),files,metadata,operations,
    request(content='%PDF-1.7\nPublic fictional PDF',type='application/pdf'){const body=new FormData();body.set('recordId','fixture-record');body.set('file',new File([content],'reference.pdf',{type}));return new Request('http://localhost/api/training/files',{method:'POST',headers,body});},
    readRequest(department='fixture-department'){return new Request('http://localhost/api/training/files/private-file',{headers:{...headers,'x-department-id':department}});},
    failMetadata(){failMetadata=true;},missingRecord(){recordExists=false;},
  };
}

test('private attachment round-trip preserves bytes and department isolation',async()=>{
  const h=attachmentHarness(),response=await h.upload.POST(h.request());
  assert.equal(response.status,201,await response.clone().text());
  const {attachment}=await response.json();assert.equal(h.metadata.length,1);assert.equal(h.files.size,1);
  assert.ok(h.metadata[0].key.startsWith('fixture-department/fixture-record/'));
  const downloaded=await h.download.GET(h.readRequest(),{params:Promise.resolve({id:attachment.id})});
  assert.equal(downloaded.status,200);assert.equal(await downloaded.text(),'%PDF-1.7\nPublic fictional PDF');
  assert.equal(downloaded.headers.get('cache-control'),'private, no-store');assert.equal(downloaded.headers.get('x-content-type-options'),'nosniff');
  assert.match(downloaded.headers.get('content-disposition'),/attachment/);
  assert.equal((await h.download.GET(h.readRequest('other-department'),{params:Promise.resolve({id:attachment.id})})).status,404);
});

test('attachments reject spoofed file content and missing records before storage upload',async()=>{
  const h=attachmentHarness();assert.equal((await h.upload.POST(h.request('<html>Not PDF</html>'))).status,400);assert.equal(h.operations.length,0);
  h.missingRecord();assert.equal((await h.upload.POST(h.request())).status,404);assert.equal(h.files.size,0);
});

test('failed attachment metadata removes the uploaded object and reports no success',async()=>{
  const h=attachmentHarness();h.failMetadata();assert.equal((await h.upload.POST(h.request())).status,503);
  assert.equal(h.files.size,0);assert.equal(h.metadata.length,0);assert.ok(h.operations.includes('remove'));
});

test('OSFM picker searches certification names, rule numbers, standards and JPR numbers',()=>{
  const selection=core('app/training/osfm-selection.ts');
  assert.equal(selection.searchCertifications('').length,37);
  for(const query of ['141.353','Confined Space Technician','NFPA 1006 7.3.1'])assert.ok(selection.searchCertifications(query).some(c=>c.id==='il-353'),query);
  assert.ok(selection.searchCertifications('ladders').some(c=>c.id==='il-301'));
  assert.equal(selection.searchCertifications('nonexistent topic xyz').length,0);
});

test('selected JPRs remain tied to the correct book and edition without awarding proficiency',()=>{
  const selection=core('app/training/osfm-selection.ts');
  const book=selection.osfmBooks.find(b=>b.certificationId==='il-353'&&b.kind==='recertificationBook');
  const id=selection.taskKey(book,'7.3.1');
  const normalized=model.normalizeTrainingData(data({osfmTaskIds:[id,id]}));
  assert.deepEqual(normalized.osfmTaskIds,[id]);assert.equal(normalized.osfmBookHashes[selection.bookKey(book)],book.sha256);
  assert.equal(selection.taskReference(id).book.edition,'NFPA 1006 (2021)');
  assert.equal(selection.taskReference(id).page,5);
  assert.throws(()=>model.normalizeTrainingData(data({osfmTaskIds:['il-353:recertificationBook:99.9.9']})));
  assert.throws(()=>model.normalizeTrainingData(data({osfmTaskIds:[id],osfmBookHashes:{[selection.bookKey(book)]:'wrong edition hash'}})));
  const c=record('credential',data({requiredJprs:['7.3.1'],cycleStart:'2026-01-01',sourceUrl:book.url,sourceEdition:book.edition}),'credential');
  assert.equal(osfm.credentialEvidence(c,[record('completion',normalized)]).documented.length,0);
  assert.ok(model.trainingCsv([record('completion',normalized)],[member]).includes('JPR 7.3.1'));
});

test('engineer summaries make specific tasks searchable without mixing books or editions',()=>{
  const selection=core('app/training/osfm-selection.ts');
  const engineer=selection.osfmBooks.find(b=>b.certificationId==='il-306'&&b.kind==='recertificationBook');
  for(const task of engineer.jprs){
    const ref=selection.taskReference(selection.taskKey(engineer,task.id));
    assert.ok(ref.summary?.title&&ref.summary?.description,task.id);
    assert.equal(ref.page,task.taskPage);
  }
  for(const [query,id] of [['dispatch','12.2.1'],['radio messages','12.2.2'],['deficiencies','12.3.1'],['seat belts','12.4.1'],['traffic controls','12.4.2'],['hydrant','12.4.3'],['nozzle flow','12.4.4'],['relay pumping','12.4.5'],['foam','12.4.6'],['standpipe','12.4.7']]){
    assert.deepEqual(selection.searchBookTasks(engineer,query).map(j=>j.id),[id]);
    assert.ok(selection.searchCertifications(query).some(c=>c.id===engineer.certificationId));
  }
  assert.equal(selection.searchBookTasks(engineer,'unlisted imaginary task').length,0);
  const trench=selection.osfmBooks.find(b=>b.certificationId==='il-354'&&b.kind==='recertificationBook');
  assert.equal(selection.taskDescription(trench,'12.2.1'),null);
  assert.equal(selection.taskDescription({...engineer,sha256:'changed-source'},'12.2.1'),null);
  assert.equal(selection.taskDescription(engineer,'12.4.3-1'),null);
});

test('activity draft keeps selected tasks on reload and an edit removes only the unchecked task',async()=>{
  const selection=core('app/training/osfm-selection.ts');
  const ids=['il-306:recertificationBook:12.4.3','il-306:recertificationBook:12.4.6','il-353:recertificationBook:7.3.1'];
  const h=await harness();try{
    const draft={...record('activity',model.normalizeTrainingData(data({title:'test/training',status:'draft',test:true,osfmTaskIds:ids}))),version:0};
    const created=await h.api.POST(h.request(draft));assert.equal(created.status,201,await created.clone().text());
    const saved=(await(await h.api.GET(h.request())).json()).records[0];
    assert.deepEqual(saved.data.osfmTaskIds,ids);
    assert.equal(selection.taskReference(saved.data.osfmTaskIds[0]).summary.title,'Establish water supply');
    const revised={...saved,data:{...saved.data,osfmTaskIds:ids.slice(1)}};
    const edited=await h.api.POST(h.request(revised));assert.equal(edited.status,200,await edited.clone().text());
    const reloaded=(await(await h.api.GET(h.request())).json()).records[0];
    assert.deepEqual(reloaded.data.osfmTaskIds,ids.slice(1));
    assert.equal(reloaded.data.status,'draft');assert.equal(model.creditedHours(reloaded),0);
  }finally{await h.close();}
});

test('the full indexed selection fits the saved payload and a selection persists through the API',async()=>{
  const selection=core('app/training/osfm-selection.ts'),ids=selection.osfmBooks.flatMap(b=>b.jprs.map(j=>selection.taskKey(b,j.id)));
  assert.equal(ids.length,818);
  const normalized=model.normalizeTrainingData(data({osfmTaskIds:ids}));assert.ok(JSON.stringify(normalized).length<90000);
  const h=await harness();try{
    const r={...record('completion',normalized),version:0};const response=await h.api.POST(h.request(r));assert.equal(response.status,201,await response.clone().text());
    const saved=await(await h.api.GET(h.request())).json();assert.deepEqual(saved.records[0].data.osfmTaskIds,ids);assert.deepEqual(saved.records[0].data.osfmBookHashes,normalized.osfmBookHashes);
  }finally{await h.close();}
});
