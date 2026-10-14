import test from 'node:test';import assert from 'node:assert/strict';import {resolve} from 'node:path';import {readFileSync} from 'node:fs';
import {trainingModules} from './helpers/training-modules.mjs';import {trainingHarness} from './helpers/training-harness.mjs';
const load=trainingModules(),model=load('app/training/model.ts'),review=load('app/training/source-review.ts');
const member={id:'fixture-person',name:'Preview-only Member',active:0,rank:'Firefighter'};
const data=patch=>({...model.emptyTrainingData(),title:'Preview-only paper drill',date:'2023-04-19',startTime:'19:00',endTime:'22:00',hours:3,instructor:'Preview-only provider',description:'Preview-only evidence-supported narrative',paperSource:true,sourceLabel:'Preview-only original.pdf',sourcePage:'1–2',sourceHeaderDate:'2023-04-19',sourceRoster:[{id:'row-one',name:'Source-written name',writtenId:'external-123',employeeId:member.id,resolution:'matched',note:'Verified against the original identity evidence; external numbering differs.'},{id:'row-two',name:'Crossed-out name',writtenId:'',employeeId:'',resolution:'excluded',note:'Crossed out on this source sheet.'}],employeeIds:[member.id],status:'completed',sourceReviewVerified:true,...patch});
const record=(id,d=data())=>({id,kind:'completion',data:d,version:1,archived:false,createdAt:'',updatedAt:'',updatedBy:'preview@example.invalid'});
const snap=(recordId='fixture-record')=>({records:[],members:[member],attachments:[{id:'file-one',recordId,contentType:'application/pdf',filename:'Preview-only original.pdf',size:100,createdAt:''}]});
test('original-paper completion requires source metadata, actual duration, resolved matches, narrative and real attachment metadata',()=>{
  const d=data(),snapshot=snap();model.validateTraining('completion',d,[],[member]);review.validateSourceReview('completion',d,snapshot,'fixture-record');
  for(const patch of [{sourceLabel:''},{sourcePage:''},{description:''},{sourceReviewVerified:false},{sourceRoster:[{...d.sourceRoster[0],resolution:'unresolved'}]},{sourceRoster:[{...d.sourceRoster[0],employeeId:'invented'}]},{sourceRoster:[{...d.sourceRoster[0],note:''}]},{sourceRoster:[d.sourceRoster[0],{...d.sourceRoster[1],note:''}]},{employeeIds:[]},{startTime:'',endTime:'',timeNote:''}])assert.throws(()=>review.validateSourceReview('completion',data(patch),snapshot,'fixture-record'));
  assert.throws(()=>review.validateSourceReview('completion',d,{...snapshot,attachments:[]},'fixture-record'),/original PDF/);
  review.validateSourceReview('completion',data({status:'draft',sourceReviewVerified:false,sourceRoster:[{...d.sourceRoster[0],resolution:'unresolved'}]}),{...snapshot,attachments:[]},'fixture-record');
});
test('separate paper sessions retain an original evidence link but clear dates, clocks, credit, answers and all matches',()=>{
  const source=record('source-record',data({attendance:{[member.id]:3},paidHours:{[member.id]:3},answers:{objective:'Yes'}})),next=review.separateSourceSession(source);
  for(const key of ['date','startTime','endTime','endDate'])assert.equal(next[key],'');assert.equal(next.hours,null);assert.equal(next.evidenceRecordId,source.id);assert.equal(next.sourceHeaderDate,'2023-04-19');assert.deepEqual(next.employeeIds,[]);assert.deepEqual(next.sourceRoster,[]);assert.deepEqual(next.attendance,{});assert.deepEqual(next.paidHours,{});assert.deepEqual(next.answers,{});assert.equal(next.sourceReviewVerified,false);
  const second=data({...next,date:'2023-04-20',startTime:'09:00',endTime:'12:00',hours:3,status:'completed',employeeIds:[member.id],sourceRoster:data().sourceRoster,sourceReviewVerified:true});assert.equal(model.sessionHours(second),3);review.validateSourceReview('completion',second,{...snap('source-record'),records:[source]},'second-record');
  assert.equal(review.paperEvidence(second,{...snap('source-record'),records:[]},'second-record').length,0);
});
test('possible duplicates are review signals and require an explicit explanation rather than guessing the events are identical',()=>{
  const d=data({paperSource:false}),prior=record('prior-record',d);assert.equal(review.possibleTrainingDuplicates(d,[prior],'new-record').length,1);assert.throws(()=>review.validateSourceReview('completion',d,{...snap(),records:[prior]},'new-record'),/duplicate/);
  review.validateSourceReview('completion',{...d,duplicateReviewNote:'Verified distinct session against source notes.'},{...snap(),records:[prior]},'new-record');
  for(const changes of [{date:'2023-04-20'},{startTime:'09:00',endTime:'12:00'},{attendance:{[member.id]:0}},{test:true}])assert.equal(review.possibleTrainingDuplicates({...d,...changes},[prior],'new-record').length,0);
  assert.equal(review.possibleTrainingDuplicates(d,[{...prior,archived:true}],'new-record').length,0);assert.equal(review.possibleTrainingDuplicates(d,[prior],prior.id).length,0);
});
test('source roster normalization preserves written identifiers without name-based mapping and CSV retains provenance',()=>{
  const normalized=model.normalizeTrainingData(data());assert.equal(normalized.sourceRoster[0].writtenId,'external-123');assert.equal(normalized.sourceRoster[0].employeeId,'fixture-person');assert.equal(model.normalizeTrainingData({title:'Legacy'}).paperSource,false);
  assert.throws(()=>model.normalizeTrainingData(data({sourceRoster:[data().sourceRoster[0],data().sourceRoster[0]]})),/distinct/);
  const csv=model.trainingCsv([record('fixture-record',normalized)],[member]);assert.ok(csv.includes('Original sheet'));assert.ok(csv.includes('Preview-only original.pdf'));assert.ok(csv.includes('2023-04-19'));assert.ok(csv.includes('fixture-record'));
});
test('actual Training API blocks unverified paper credit, preserves draft evidence, retries once and keeps private access',async()=>{
  const h=await trainingHarness();try{await h.pg.exec(readFileSync('supabase/migrations/20260925014536_training_private_pilot.sql','utf8').split('ALTER TABLE')[0]+"CREATE TABLE pay_scales(id text,label text);CREATE TABLE employees(id text,name text,active int,pay_scale_id text);INSERT INTO employees VALUES('fixture-person','Preview-only Member',0,null);");
    const modules=trainingModules({[resolve('db/bootstrap.ts')]:{ensureDatabase:async()=>h.db}}),api=modules('app/api/training/route.ts');
    const post=(body,actor='bobff353@gmail.com',department='fixture-department')=>api.POST(new Request('http://localhost/api/training',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json','oai-authenticated-user-email':actor,'x-department-id':department},body:JSON.stringify(body)}));const body={id:'fixture-record',kind:'completion',version:0,archived:false,data:data()};
    assert.equal((await post(body,'other@example.invalid')).status,403);assert.equal((await post(body)).status,400);assert.equal((await h.pg.query('SELECT count(*) n FROM training_pilot_records')).rows[0].n,0);
    const draft={...body,data:data({status:'draft',sourceReviewVerified:false})};assert.equal((await post(draft)).status,201);assert.equal((await post(draft)).status,200);
    await h.pg.query("INSERT INTO training_pilot_files VALUES('file-one','fixture-department','fixture-record','preview/object.pdf','Preview-only original.pdf','application/pdf',100,'2026-10-14','preview')");
    const completed={...body,version:1};assert.equal((await post(completed)).status,200);assert.equal((await post(completed)).status,200);assert.equal((await h.pg.query('SELECT count(*) n FROM training_pilot_audit')).rows[0].n,2);
    assert.equal((await post({...body,id:'second-record',version:0,data:data({evidenceRecordId:'fixture-record'})})).status,400);
    assert.equal((await post({...body,id:'second-record',version:0,data:data({date:'2023-04-20',startTime:'09:00',endTime:'12:00',evidenceRecordId:'fixture-record'})})).status,201);
    assert.equal((await post({...body,id:'other-department-record',data:data({evidenceRecordId:'fixture-record'})},'bobff353@gmail.com','another-department')).status,400);
    const archived=await post({...completed,version:2,archived:true});assert.equal(archived.status,200);assert.equal((await h.pg.query('SELECT count(*) n FROM training_pilot_files')).rows[0].n,1);
  }finally{await h.close();}
});
