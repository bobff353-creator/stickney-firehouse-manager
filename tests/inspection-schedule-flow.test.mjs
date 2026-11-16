import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {trainingModules} from './helpers/training-modules.mjs';

const require=createRequire(import.meta.url),load=trainingModules(),model=load('app/fire-inspections/model.ts');
const noop=()=>null;
function componentModule(path,hooks){
 const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,target={exports:{}};
 new Function('require','module','exports',code)(name=>{
  if(name==='react')return hooks;
  if(name==='next/dynamic')return{default:()=>noop,__esModule:true};
  if(name.endsWith('.css'))return{};
  if(name==='../use-unsaved-work')return{useUnsavedWork(){}};
  if(name==='./code-library')return{CodePicker:noop,CodeCheckpointPicker:noop};
  if(name==='./alternative-review-editor'||name==='./guided-checklist')return{default:noop,__esModule:true};
  if(name==='./evidence')return{EvidencePhotos:noop};
  if(name==='./property-workflow')return{ObservationEditor:noop};
  if(name==='./team-editor')return{TeamEditor:noop};
  if(name.startsWith('.'))return load('app/fire-inspections/'+name.slice(2)+'.ts');
  return require(name);
 },target,target.exports);return target.exports;
}
function findElement(tree,predicate){
 if(Array.isArray(tree)){for(const child of tree){const found=findElement(child,predicate);if(found)return found;}return;}
 if(!React.isValidElement(tree))return;if(predicate(tree))return tree;return findElement(tree.props.children,predicate);
}
function eventHarness(path){
 const slots=[];let cursor=0;
 const hooks={useState(initial){const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return[slots[index],value=>{slots[index]=typeof value==='function'?value(slots[index]):value;}];},useRef(initial){const index=cursor++;if(!(index in slots))slots[index]={current:initial};return slots[index];},useEffect(){}};
 const loadedModule=componentModule(path,hooks);return{module:loadedModule,render(Component,props){cursor=0;return Component(props);}};
}
function inspection(patch={}){return{id:'fictional-schedule-qa',kind:'inspection',data:{...model.emptyInspection(),title:'Fictional schedule QA',...patch},version:0,archived:false,createdAt:'',updatedAt:'',updatedBy:''};}
function editor(initial,initialStep=1,extraSnapshot={}){
 const saved=[],harness=eventHarness('app/fire-inspections/editor.tsx');
 const props={initial,initialStep,snapshot:{records:[],properties:[],attachments:[],codes:[],...extraSnapshot},onSave:async(record,keepEditing)=>{saved.push({record,keepEditing});return{...record,version:record.version+1};},onUpload:async()=>{},onCancel(){}};
 return{saved,render:()=>harness.render(harness.module.default,props)};
}
const exitButton=tree=>findElement(findElement(tree,e=>e.props.className==='fi-editor-exit'),e=>e.type==='button');

test('Plan save and exit records a real appointment instead of leaving a dated draft',async()=>{
 const qa=editor(inspection({scheduledDate:'2026-11-18',scheduledTime:'09:30'})),button=exitButton(qa.render());
 assert.equal(button.props.children,'Save schedule & exit');await button.props.onClick();
 assert.equal(qa.saved.length,1);assert.equal(qa.saved[0].record.data.status,'Scheduled');assert.equal(qa.saved[0].record.data.scheduledDate,'2026-11-18');assert.equal(qa.saved[0].record.data.scheduledTime,'09:30');assert.equal(qa.saved[0].keepEditing,false);
});

test('Plan without a date saves to Needs scheduling while explicit Save draft stays a draft',async()=>{
 const undated=editor(inspection()),exit=exitButton(undated.render());assert.equal(exit.props.children,'Save for scheduling & exit');await exit.props.onClick();assert.equal(undated.saved[0].record.data.status,'Needs scheduling');
 const dated=editor(inspection({scheduledDate:'2026-11-18',scheduledTime:'09:30'})),draft=findElement(dated.render(),e=>e.type==='button'&&e.props.children==='Save draft');assert.ok(draft);await draft.props.onClick();assert.equal(dated.saved[0].record.data.status,'Draft');assert.equal(dated.saved[0].keepEditing,true);
});

test('returning from a walkthrough to Plan does not downgrade In progress to Scheduled',async()=>{
 const qa=editor(inspection({status:'In progress',actualDate:model.todayChicago(),scheduledDate:'2026-11-18',scheduledTime:'09:30'})),button=exitButton(qa.render());assert.equal(button.props.children,'Save & exit');await button.props.onClick();assert.equal(qa.saved[0].record.data.status,'In progress');
});

test('Plan checkpoint lookup receives the building primary and mixed occupancy groups',()=>{
 const qa=editor(inspection({occupancyGroup:'B',additionalOccupancyGroups:['M']})),picker=findElement(qa.render(),element=>Array.isArray(element.props.sources)&&typeof element.props.onAdd==='function');
 assert.ok(picker);assert.deepEqual(picker.props.occupancyGroups,['B','M']);
});

test('saved checklist replacement requires confirmation, keeps Cancel selection and preserves photographed findings',async()=>{
 const old=model.freshCheck({id:'old-finding',section:'Egress',label:'Original nonphoto finding',source:'QA'});Object.assign(old,{result:'Needs attention',observation:'Original condition',location:'East door'});
 const photographed={...old,id:'photo-finding',label:'Photographed finding',observation:'Preserved photographed condition'},replacement=model.freshCheck({id:'replacement-check',section:'Custom',label:'Replacement checklist checkpoint',source:'QA'}),photo={id:crypto.randomUUID(),checkId:photographed.id,caption:'QA',sha256:'a'.repeat(64),size:123,contentType:'image/jpeg',filename:'fictional.jpg'};
 const template={...inspection({title:'Saved replacement A',checks:[replacement],sections:['Custom']}),id:'saved-a',kind:'template'},other={...template,id:'saved-b',data:{...template.data,title:'Saved replacement B'}};
 const signature={...model.blankSignature(),state:'Signed',name:'Fictional representative',strokes:[[[.1,.2],[.3,.4]]]},qa=editor(inspection({checks:[old,photographed],sections:['Egress'],evidenceManifest:[photo],representative:signature}),0,{records:[template,other]}),priorWindow=globalThis.window;let confirmed=false,confirmations=0;
 globalThis.window={confirm(){confirmations++;return confirmed;}};
 const choose=value=>{const select=findElement(qa.render(),element=>element.type==='select'&&element.props['aria-label']==='Saved checklist'),currentTarget={value};select.props.onChange({currentTarget});return currentTarget.value;};
 try{
  assert.equal(choose('saved-a'),'');assert.equal(confirmations,1);await exitButton(qa.render()).props.onClick();assert.deepEqual(qa.saved[0].record.data.checks,[old,photographed]);assert.equal(qa.saved[0].record.data.representative.state,'Signed');
  confirmed=true;choose('saved-a');assert.equal(findElement(qa.render(),element=>element.type==='select'&&element.props['aria-label']==='Saved checklist').props.value,'saved-a');
  confirmed=false;assert.equal(choose('saved-b'),'saved-a');await exitButton(qa.render()).props.onClick();
  const saved=qa.saved.at(-1).record.data;assert.deepEqual(saved.checks.map(check=>check.id),['replacement-check','photo-finding']);assert.deepEqual(saved.checks.find(check=>check.id===photographed.id),photographed);assert.deepEqual(saved.evidenceManifest,[photo]);assert.equal(saved.representative.state,'Not requested');
 }finally{if(priorWindow===undefined)delete globalThis.window;else globalThis.window=priorWindow;}
});

test('operational calendar shows the routine child once and keeps completed history in Reports',()=>{
 const original={...inspection({status:'Completed',title:'Original completed visit',actualDate:'2026-11-16',scheduledDate:'',repeatMonths:12,nextDueDate:'2027-11-16'}),version:1};
 const child=model.followUpRecord(original,'routine',original.data.nextDueDate);child.data.title='Routine follow-up due';
 const cancelled=inspection({status:'Canceled',scheduledDate:'2027-11-16',title:'Cancelled visit'}),archived={...inspection({status:'Scheduled',scheduledDate:'2027-11-16',title:'Archived visit'}),archived:true};
 const harness=eventHarness('app/fire-inspections/desk-shell.tsx'),tree=harness.render(harness.module.DeskSchedule,{records:[original,child,cancelled,archived],month:'2027-11',onMonth(){},onOpen(){},onStart(){},onSchedule(){},onNew(){}}),html=renderToStaticMarkup(tree);
 assert.match(html,/November 16, 1 visits or due dates/);assert.match(html,/Routine follow-up due/);assert.doesNotMatch(html,/Original completed visit|Cancelled visit|Archived visit/);assert.match(html,/Completed visits remain in Reports/);
 assert.equal(original.data.status,'Completed');assert.equal(child.data.status,'Needs scheduling');assert.equal(original.data.nextDueDate,child.data.nextDueDate);
});

test('Visits today metric and list match the Due today queue, including unscheduled due dates and excluding deliberate drafts',()=>{
 const today=model.todayChicago(),draft=inspection({status:'Draft',title:'Deliberate dated draft',scheduledDate:today,scheduledTime:'08:00'}),scheduled={...inspection({status:'Scheduled',title:'Confirmed appointment',scheduledDate:today,scheduledTime:'09:30'}),id:'confirmed-appointment'},due={...inspection({status:'Needs scheduling',title:'Due today needs appointment',nextDueDate:today}),id:'unscheduled-due'};
 const records=[draft,scheduled,due],opened=[],harness=eventHarness('app/fire-inspections/desk-shell.tsx'),tree=harness.render(harness.module.DeskOverview,{snapshot:{records,properties:[],codes:[]},reminders:[],onTab:(...args)=>opened.push(args),onOpen(){},onStart(){},onSchedule(){},onNew(){}}),metric=findElement(tree,element=>element.type==='button'&&element.props.className?.startsWith('fd-metric')&&findElement(element,child=>child.type==='span'&&child.props.children==='Visits today'));
 assert.ok(metric);const count=findElement(metric,element=>element.type==='strong').props.children,queue=records.filter(record=>!record.archived&&!record.data.test&&model.queueLabel(record.data)==='Due today');assert.equal(count,2);assert.equal(count,queue.length);metric.props.onClick();assert.deepEqual(opened,[['Work queue','Due today']]);
 const html=renderToStaticMarkup(tree);assert.match(html,/Confirmed appointment/);assert.match(html,/Due today needs appointment/);assert.doesNotMatch(html,/Deliberate dated draft/);
});

test('completed report rows show actual visit time or an explicit missing time, never the planned appointment time',()=>{
 const harness=eventHarness('app/fire-inspections/desk-shell.tsx'),render=record=>renderToStaticMarkup(React.createElement(harness.module.DeskRecordRow,{record,onOpen(){}}));
 const completed=inspection({status:'Completed',actualDate:'2026-11-16',startTime:'09:30',scheduledDate:'2026-11-19',scheduledTime:'10:15'}),actual=render(completed);
 assert.match(actual,/Nov 16/);assert.match(actual,/9:30 AM/);assert.doesNotMatch(actual,/10:15 AM|Nov 19/);
 const missing=render({...completed,data:{...completed.data,startTime:'',scheduledDate:'2026-12-16',scheduledTime:'09:00'}});assert.match(missing,/Nov 16/);assert.match(missing,/Time not recorded/);assert.doesNotMatch(missing,/9:00 AM|Dec 16/);
 const planned=render({...completed,data:{...completed.data,status:'Scheduled',actualDate:'',startTime:''}});assert.match(planned,/Nov 19/);assert.match(planned,/10:15 AM/);assert.doesNotMatch(planned,/Time not recorded|9:30 AM/);
});

test('an unstarted linked routine visit has an explicit due-date edit that preserves the separate appointment',async()=>{
 const initial=inspection({status:'Scheduled',parentId:'original-report',followUpKind:'routine',nextDueDate:'2027-05-16',scheduledDate:'2027-05-18',scheduledTime:'10:15'}),qa=editor(initial),due=findElement(qa.render(),element=>element.type==='label'&&element.props.children[0]==='Target due date');
 assert.ok(due,'Plan needs an obvious way to reconcile a routine follow-up deadline');const input=findElement(due,element=>element.type==='input');assert.equal(input.props.value,'2027-05-16');input.props.onChange({target:{value:'2027-11-16'}});await exitButton(qa.render()).props.onClick();
 const saved=qa.saved[0].record.data;assert.equal(saved.nextDueDate,'2027-11-16');assert.equal(saved.scheduledDate,'2027-05-18');assert.equal(saved.scheduledTime,'10:15');assert.equal(saved.parentId,'original-report');assert.equal(initial.data.nextDueDate,'2027-05-16','Opening and editing never mutates the source snapshot');
 const started=editor({...initial,data:{...initial.data,actualDate:model.todayChicago(),status:'In progress'}});assert.equal(findElement(started.render(),element=>element.type==='label'&&element.props.children[0]==='Target due date'),undefined);
 const reinspection=editor({...initial,data:{...initial.data,followUpKind:'reinspection'}});assert.equal(findElement(reinspection.render(),element=>element.type==='label'&&element.props.children[0]==='Target due date'),undefined);
});
