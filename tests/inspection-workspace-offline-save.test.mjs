import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import ts from 'typescript';
import {trainingModules} from './helpers/training-modules.mjs';

const require=createRequire(import.meta.url),load=trainingModules(),model=load('app/fire-inspections/model.ts');
const signature={...model.blankSignature(),state:'Signed',name:'QA fictional inspector',role:'Software test only',strokes:[[[.1,.2],[.3,.6],[.5,.2]]],signedAt:''};
function fixture(){return{id:'qa-offline-finish',kind:'inspection',version:2,archived:false,createdAt:'2026-11-16T12:00:00Z',updatedAt:'2026-11-16T12:00:00Z',updatedBy:'qa@example.invalid',data:{...model.emptyInspection(),title:'Fictional workspace QA',status:'Completed',actualDate:'2026-11-16',inspector:'QA fictional inspector',outcome:'No issues observed',inspectorAttested:true,inspectorSignature:structuredClone(signature),representative:{...structuredClone(signature),name:'QA fictional contact'},checks:[{...model.emptyInspection().checks[0],result:'Acceptable'}]}};}
function findElement(tree,predicate){if(Array.isArray(tree)){for(const child of tree){const found=findElement(child,predicate);if(found)return found;}return;}if(!React.isValidElement(tree))return;if(predicate(tree))return tree;return findElement(tree.props.children,predicate);}
function elementText(tree){return Array.isArray(tree)?tree.map(elementText).join(''):React.isValidElement(tree)?elementText(tree.props.children):typeof tree==='string'||typeof tree==='number'?String(tree):'';}

// Exercise the real workspace event callback. Only browser bootstrap/effects,
// React scheduling and child visual components are substituted; the queue and
// payload-preservation functions are the production implementations.
function workspaceHarness({online=false,writeError=null,initialRecords=null,startVisit=true}={}){
 const request=fixture(),priorRecord={...request,data:{...request.data,status:'In progress',inspectorAttested:false,representative:model.blankSignature(),inspectorSignature:model.blankSignature()}},snapshot={records:initialRecords??[priorRecord],properties:[],attachments:[],departmentId:'qa-department',viewerEmail:'qa@example.invalid'},states=[],refs=[],events=[],stored=new Map();let stateCursor=0,refCursor=0,fetches=0,locationHref='http://localhost/?display=portal&page=fire-inspections';
 const vault={async write(id,value){events.push({action:'write',id});if(writeError)throw writeError;stored.set(id,structuredClone(value));},async remove(id){events.push({action:'remove',id});stored.delete(id);},async list(prefix){return [...stored].filter(([id])=>id.startsWith(prefix)).map(([id,value])=>({id,value}));},close(){}};
 const hooks={useState(initial){const index=stateCursor++;if(!(index in states))states[index]=index===0?snapshot:index===1?true:typeof initial==='function'?initial():initial;return[states[index],value=>{states[index]=typeof value==='function'?value(states[index]):value;}];},useRef(initial){const index=refCursor++;if(!(index in refs))refs[index]={current:index===0?vault:initial};return refs[index];},useEffect(){},useCallback(callback){return callback;}};
 const InspectionEditor=()=>null,DeskHeader=()=>null,DeskNavigation=()=>null,DeskFieldStatus=()=>null,DeskOverview=()=>null,Visual=()=>null;
 const modules={react:hooks,'next/dynamic':()=>Visual,'../use-unsaved-work':{confirmLeavingWork:()=>true},'./editor':{__esModule:true,default:InspectionEditor,newInspection:(_kind,patch)=>({...priorRecord,data:{...priorRecord.data,...patch}})},'./model':model,'./catalog':load('app/fire-inspections/catalog.ts'),'./codes':load('app/fire-inspections/codes.ts'),'./alternative-review':load('app/fire-inspections/alternative-review.ts'),'./draft-backup':load('app/fire-inspections/draft-backup.ts'),'./field-workflow':load('app/fire-inspections/field-workflow.ts'),'./evidence-outbox':load('app/fire-inspections/evidence-outbox.ts'),'./follow-up-review':load('app/fire-inspections/follow-up-review.ts'),'./reminders':{inspectionReminders:()=>[]},'./case-status':{unresolvedInspectionReminders:()=>[],currentCaseStatus:()=>({})},'./occupancy':{groupChoices:[],groupLabel:()=>'',nativeGroupChecks:()=>[]},'./desk-shell':{DeskHeader,DeskNavigation,DeskFieldStatus,DeskOverview,DeskQueue:Visual,DeskSchedule:Visual,DeskPropertyDirectory:Visual,DeskSectionHeading:Visual,DeskIcon:Visual,deskTabs:['Overview','Work queue','Schedule','Properties','Checklists','Citation library','Reports','Reference tools','Data recovery']}};
 const source=ts.transpileModule(readFileSync('app/fire-inspections/workspace.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,target={exports:{}};
 new Function('require','module','exports',source)(name=>Object.hasOwn(modules,name)?modules[name]:name.endsWith('.css')?{}:name.startsWith('.')?Visual:require(name),target,target.exports);
 const descriptors=new Map(['navigator','window','location','fetch'].map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
 const location={get href(){return locationHref;},search:'?display=portal&page=fire-inspections'};
 for(const[name,value]of Object.entries({navigator:{onLine:online},location,window:{location,history:{state:null,replaceState(_state,_title,url){locationHref=String(url);events.push({action:'route',url:locationHref});}}},fetch:async(_url,init)=>{fetches++;if(!online)throw new TypeError('QA offline network unavailable');const submitted=JSON.parse(init.body);return Response.json({saved:true,record:{...submitted,version:submitted.version+1,updatedAt:'2026-11-16T16:00:00Z'},followUpRecords:[]});}}))Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});
 function render(){stateCursor=0;refCursor=0;return target.exports.default();}
 function editor(){return findElement(render(),element=>element.type===InspectionEditor);}
 const initialTree=render();if(startVisit){const header=findElement(initialTree,element=>element.type===DeskHeader);header.props.onStart();assert.ok(editor(),'the actual Start a visit event must open its editor');}
 return{request,events,stored,editor,render,openRecord(id){const overview=findElement(render(),element=>element.type===DeskOverview);assert.ok(overview,'open records through the actual Overview callback');overview.props.onOpen(id);},navigate(tab){findElement(render(),element=>element.type===DeskNavigation).props.onChange(tab);},get selectedId(){return new URL(locationHref).searchParams.get('inspectionRecord');},get fetches(){return fetches;},get savedRecords(){return states[0].records;},get route(){return findElement(render(),element=>element.type===DeskNavigation)?.props.tab;},get pending(){return findElement(render(),element=>element.type===DeskFieldStatus)?.props.pending;},close(){for(const[name,descriptor]of descriptors)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}};
}

test('actual workspace Finish without photos preserves exact offline signatures and routes to pending recovery without a cloud receipt',async()=>{
 const h=workspaceHarness();try{
  const before=JSON.stringify(h.request);await assert.rejects(h.editor().props.onSave(h.request),error=>error.code==='CLOUD_ISSUANCE_PENDING'&&/pending cloud issuance/.test(error.message));
  const queue=h.stored.get('queue');assert.equal(queue.length,1);assert.deepEqual(queue[0].record,h.request);assert.equal(queue[0].record.data.status,'Completed');assert.deepEqual(queue[0].record.data.inspectorSignature,signature);assert.equal(queue[0].record.data.evidenceManifest.length,0);
  assert.equal(h.fetches,0);assert.equal(h.route,'Data recovery');assert.equal(h.pending,1);assert.equal(h.editor(),undefined);assert.equal(h.savedRecords[0].version,2);assert.equal(h.savedRecords[0].data.status,'In progress');assert.equal(JSON.stringify(h.request),before);
  const queueWrite=h.events.findIndex(event=>event.action==='write'&&event.id==='queue'),draftCleanup=h.events.findIndex(event=>event.action==='remove'&&event.id==='draft:'+h.request.id);assert(queueWrite>=0&&draftCleanup>queueWrite,'persist the exact queued request before removing its separate draft');
 }finally{h.close();}
});

test('actual workspace online Finish adopts only the authoritative saved version and opens the saved report',async()=>{
 const h=workspaceHarness({online:true});try{
  const saved=await h.editor().props.onSave(h.request);assert.equal(h.fetches,1);assert.equal(saved.version,3);assert.equal(h.savedRecords[0].version,3);assert.equal(h.savedRecords[0].data.status,'Completed');assert.equal(h.route,'Work queue');assert.equal(h.pending,0);assert.deepEqual(h.stored.get('queue'),[]);assert.equal(h.editor(),undefined);
 }finally{h.close();}
});

test('actual workspace offline archive never enters the inspection issuance queue',async()=>{
 const h=workspaceHarness();try{
  await assert.rejects(h.editor().props.onSave({...h.request,archived:true}),/offline network unavailable/);assert.equal(h.fetches,1);assert.equal(h.stored.has('queue'),false);assert.equal(h.events.some(event=>event.action==='remove'),false);assert.ok(h.editor(),'an unconfirmed archive must keep the editor available');assert.equal(h.savedRecords[0].archived,false);
 }finally{h.close();}
});

test('actual workspace retains the editor and draft when offline queue persistence fails',async()=>{
 const h=workspaceHarness({writeError:Error('QA device storage full')});try{
  await assert.rejects(h.editor().props.onSave(h.request),/device storage full/);assert.equal(h.fetches,0);assert.equal(h.stored.has('queue'),false);assert.equal(h.events.some(event=>event.action==='remove'),false);assert.ok(h.editor());assert.equal(h.savedRecords[0].data.status,'In progress');
 }finally{h.close();}
});

test('actual saved report keeps its follow-up mismatch warning after navigation and opens the canonical routine child',()=>{
 const parent=fixture();parent.data.repeatMonths=6;parent.data.nextDueDate='2027-11-16';const child={...model.followUpRecord(parent,'routine','2027-05-16'),version:1};child.data.title='QA existing routine visit';
 const h=workspaceHarness({online:true,initialRecords:[parent,child],startVisit:false});try{
  const before=JSON.stringify(h.savedRecords),warning=()=>findElement(h.render(),element=>element.type==='strong'&&element.props.children==='Review the existing follow-up schedule');
  h.openRecord(parent.id);assert.ok(warning());assert.match(elementText(h.render()),/saved visit 2027-05-16/);assert.match(elementText(h.render()),/This report requests 2027-11-16/);
  h.navigate('Overview');h.openRecord(parent.id);assert.ok(warning(),'derive the warning again from saved records, not a temporary save notice');
  const review=findElement(h.render(),element=>element.type==='button'&&elementText(element)==='Review routine visit →');assert.ok(review);review.props.onClick();
  assert.equal(h.route,'Work queue');assert.equal(h.selectedId,child.id);assert.ok(findElement(h.render(),element=>element.type==='h2'&&elementText(element)==='QA existing routine visit'));assert.equal(warning(),undefined);
  assert.equal(h.fetches,0);assert.equal(JSON.stringify(h.savedRecords),before,'review navigation preserves both saved records and their history');
 }finally{h.close();}
});

test('actual saved report does not warn when the matching routine due date has a separately booked appointment',()=>{
 const parent=fixture();parent.data.repeatMonths=6;parent.data.nextDueDate='2027-05-16';const child={...model.followUpRecord(parent,'routine',parent.data.nextDueDate),version:1};Object.assign(child.data,{status:'Scheduled',scheduledDate:'2027-05-18',scheduledTime:'10:15'});
 const h=workspaceHarness({online:true,initialRecords:[parent,child],startVisit:false});try{
  const before=JSON.stringify(h.savedRecords);h.openRecord(parent.id);assert.equal(findElement(h.render(),element=>element.type==='strong'&&element.props.children==='Review the existing follow-up schedule'),undefined);assert.equal(findElement(h.render(),element=>element.type==='button'&&elementText(element)==='Review routine visit →'),undefined);
  assert.match(elementText(h.render()),/2027-05-18 10:15/);assert.equal(h.fetches,0);assert.equal(JSON.stringify(h.savedRecords),before);
 }finally{h.close();}
});
