import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url),cache=new Map();
function load(p){p=resolve(p);if(cache.has(p))return cache.get(p).exports;if(extname(p)==='.json')return JSON.parse(fs.readFileSync(p,'utf8'));const target={exports:{}};cache.set(p,target);const js=ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,resolveJsonModule:true}}).outputText;new Function('require','module','exports',js)(n=>n.startsWith('.')?load(resolve(dirname(p),extname(n)?n:n+'.ts')):require(n),target,target.exports);return target.exports;}
const model=load('app/training/model.ts');
const data=(changes={})=>({...model.emptyTrainingData(),title:'test/training',test:true,date:'2026-04-25',startTime:'08:00',endTime:'18:00',hours:10,instructor:'Test provider',employeeIds:['fixture-member'],status:'completed',...changes});
const members=[{id:'fixture-member',name:'Test member',rank:'Firefighter',active:1}];
test('exact session clocks, breaks and an explicit overnight date determine actual elapsed hours',()=>{
 assert.equal(model.sessionHours(data()),10);
 assert.equal(model.sessionHours(data({startTime:'09:00',endTime:'12:00',breakMinutes:30})),2.5);
 assert.equal(model.sessionHours(data({startTime:'22:00',endTime:'01:00',endDate:'2026-04-26'})),3);
 assert.throws(()=>model.sessionHours(data({startTime:'22:00',endTime:'01:00'})),/End must follow/);
 assert.equal(model.sessionHours(data({endTime:''})),null);
});
test('Chicago daylight saving is calculated without guessing repeated or nonexistent clock times',()=>{
 assert.equal(model.sessionHours(data({date:'2026-03-08',startTime:'00:30',endTime:'04:30'})),3);
 assert.equal(model.sessionHours(data({date:'2026-11-01',startTime:'00:30',endTime:'03:30'})),4);
 assert.throws(()=>model.sessionHours(data({date:'2026-11-01',startTime:'01:30',endTime:'03:30'})),/daylight-saving/);
 assert.throws(()=>model.sessionHours(data({date:'2026-03-08',startTime:'02:30',endTime:'04:30'})),/daylight-saving/);
});
test('the server rejects conflicting complete times but keeps legacy documented-hour records usable',()=>{
 model.validateTraining('completion',data(),[],members,'2026-10-12');
 assert.throws(()=>model.validateTraining('completion',data({hours:3}),[],members,'2026-10-12'),/Resolve the different duration/);
 model.validateTraining('completion',data({endTime:'',hours:3}),[],members,'2026-10-12');
 model.validateTraining('completion',data({status:'draft',hours:3}),[],members,'2026-10-12');
 assert.throws(()=>model.normalizeTrainingData(data({breakMinutes:0.5})),/Break minutes/);
});
test('pay reference does not alter training credit and a repeated drill cannot inherit people or prior credit',()=>{
 const original=model.normalizeTrainingData(data({test:false,title:'Recorded drill',attendance:{'fixture-member':3},paidHours:{'fixture-member':1},externalId:'old-transcript',assignmentId:'old-assignment'}));
 const record={id:'test-original',kind:'completion',data:original,archived:false};
 assert.equal(model.creditedHours(record),3);
 const repeated={...model.emptyTrainingData(),...model.repeatedCompletionData(original)};
 assert.deepEqual(repeated.employeeIds,[]);assert.deepEqual(repeated.attendance,{});assert.deepEqual(repeated.paidHours,{});
 assert.equal(repeated.date,'');assert.equal(repeated.endTime,'');assert.equal(repeated.externalId,'');assert.equal(repeated.assignmentId,'');
 assert.equal(model.creditedHours({...record,data:repeated}),0);
 assert.equal(original.paidHours['fixture-member'],1);
 assert.throws(()=>model.normalizeTrainingData(data({paidHours:{'fixture-member':25}})),/Individual hours/);
});
