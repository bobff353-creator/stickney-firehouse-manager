import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {trainingModules} from './helpers/training-modules.mjs';
const load=trainingModules(),model=load('app/fire-inspections/model.ts'),navigation=load('app/fire-inspections/guided-navigation.ts');
const checkpoint=(id,result='Not checked',patch={})=>({...model.freshCheck({id,label:'QA '+id,section:'Egress',source:'QA observation prompt'}),result,...patch});
const checks=[checkpoint('east','Acceptable'),checkpoint('west'),checkpoint('west:2','Needs attention',{location:'Room 2'}),checkpoint('equipment','Not inspected',{section:'Systems',observation:'Locked room'})];
test('walkthrough opens exact occurrence IDs and preserves bounded next/back order',()=>{
 assert.equal(navigation.adjacentCheckpoint(checks,'west',1),'west:2');assert.equal(navigation.adjacentCheckpoint(checks,'west:2',-1),'west');assert.equal(navigation.adjacentCheckpoint(checks,'east',-1),'');assert.equal(navigation.adjacentCheckpoint(checks,'equipment',1),'');assert.equal(navigation.adjacentCheckpoint(checks,'deleted',1),'east');assert.equal(navigation.adjacentCheckpoint([],'deleted',1),'');
});
test('jump filters distinguish unanswered, findings and access limits without changing answers',()=>{
 const before=JSON.stringify(checks);assert.deepEqual(navigation.walkthroughChecks(checks,{filter:'Unanswered'}).map(c=>c.id),['west']);assert.deepEqual(navigation.walkthroughChecks(checks,{filter:'Findings'}).map(c=>c.id),['west:2']);assert.deepEqual(navigation.walkthroughChecks(checks,{filter:'Not inspected'}).map(c=>c.id),['equipment']);assert.deepEqual(navigation.walkthroughChecks(checks,{section:'Egress',query:'room 2'}).map(c=>c.id),['west:2']);assert.equal(JSON.stringify(checks),before);
});
test('progress counts explicit Not applicable / Not inspected as answered while retaining access gaps',()=>{
 assert.deepEqual(navigation.walkthroughProgress(checks),{total:4,answered:3,unanswered:1,open:1,notInspected:1,findings:1});assert.equal(navigation.walkthroughProgress([...checks,checkpoint('na','Not applicable')]).answered,4);assert.deepEqual(navigation.walkthroughProgress([]),{total:0,answered:0,unanswered:0,open:0,notInspected:0,findings:0});
});
test('guidance identifies missing actionable finding fields and corrected evidence dates',()=>{
 assert.deepEqual(navigation.checkpointGaps(checkpoint('fail','Needs attention')),['Exact location','Observed condition','Correction / action','Verified code reference','Correction due date']);assert.deepEqual(navigation.checkpointGaps(checkpoint('skip','Not inspected')),['Reason not inspected']);assert.deepEqual(navigation.checkpointGaps(checkpoint('resolved','Resolved',{location:'East',observation:'Observed clear',correction:'Cleared',code:'QA verified section'})),['Corrected date']);assert.deepEqual(navigation.checkpointGaps(checkpoint('pass','Acceptable')),[]);
});
test('guidance accepts an attached versioned reference without inventing a code citation',()=>{
 const finding=checkpoint('ready','Needs attention',{location:'East',observation:'Blocked',correction:'Clear',dueDate:'2026-11-30',citations:[{id:'qa-reference',version:1}]});assert.deepEqual(navigation.checkpointGaps(finding),[]);assert.equal(finding.code,'');
});
test('200 checkpoints remain selectable without replacing any source objects',()=>{
 const large=Array.from({length:200},(_,i)=>checkpoint('qa-'+i));assert.equal(navigation.walkthroughChecks(large).length,200);assert.strictEqual(navigation.walkthroughChecks(large)[199],large[199]);assert.equal(navigation.adjacentCheckpoint(large,'qa-198',1),'qa-199');assert.equal(navigation.adjacentCheckpoint(large,'qa-199',1),'');
});
test('changing occupancy or saved checklist retains photographed occurrence IDs and their original findings',()=>{const east=checkpoint('door','Needs attention',{observation:'Original photographed finding'}),west=checkpoint('door:2','Needs attention',{observation:'Separate photographed location'}),fresh=checkpoint('new-scope'),result=navigation.retainPhotographedChecks([east,west],[checkpoint('door'),fresh],[{checkId:'door:2'}]);assert.equal(result.find(c=>c.id==='door').result,'Not checked');assert.strictEqual(result.find(c=>c.id==='door:2'),west);assert.strictEqual(result[1],fresh);assert.equal(result.length,3);assert.equal(west.observation,'Separate photographed location');});
const require=createRequire(import.meta.url);
function guidedComponent(reactHooks=React){const source=ts.transpileModule(readFileSync('app/fire-inspections/guided-checklist.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,target={exports:{}};new Function('require','module','exports',source)(name=>name==='react'?reactHooks:name==='./model'?model:name==='./guided-navigation'?navigation:name==='./code-library'?{CodePicker:()=>React.createElement('details',null,'Saved code selector')}:name==='./evidence'?{EvidencePhotos:()=>React.createElement('section',null,'Private evidence uploader')}:name==='./nfpa-source-links'?{default:()=>null}:name.endsWith('.css')?{}:require(name),target,target.exports);return target.exports.default;}
const GuidedChecklist=guidedComponent(),props={checks,sections:['Egress','Systems'],codes:[],files:[],recordId:'qa-only',actualDate:'2026-11-15',onUpdate(){},onRemove(){},async onAddPhoto(){},onReview(){},onPlan(){}};
test('actual initial component renders only one question, jump selector and touch result controls',()=>{
 const html=renderToStaticMarkup(React.createElement(GuidedChecklist,props));assert.equal((html.match(/<h3/g)||[]).length,1);assert.match(html,/<h3[^>]*>QA west<\/h3>/);assert.match(html,/Checkpoint<select/);assert.match(html,/Answered checkpoints/);assert.match(html,/Previous checkpoint/);assert.match(html,/Next checkpoint/);assert.equal((html.match(/No concern observed|Record the finding below|Record what was corrected|Verify a prior finding|Does not apply here|Record access \/ scope limit/g)||[]).length,6);assert(!html.includes('onclick='));
});
test('empty checklist has a clear route to Plan and no fabricated answered result',()=>{
 const html=renderToStaticMarkup(React.createElement(GuidedChecklist,{...props,checks:[]}));assert.match(html,/No checkpoints selected/);assert.match(html,/Choose checks in Plan/);assert.match(html,/0 of 0 answered/);assert(!html.includes('fi-guided-results'));
});

function findElement(tree,predicate){
 if(Array.isArray(tree)){for(const child of tree){const found=findElement(child,predicate);if(found)return found;}return;}
 if(!React.isValidElement(tree))return;if(predicate(tree))return tree;return findElement(tree.props.children,predicate);
}
function eventHarness(inputProps){
 const slots=[];let cursor=0,focusCalls=0,scrollCalls=0;
 const hooks={useState(initial){const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return[slots[index],value=>{slots[index]=typeof value==='function'?value(slots[index]):value;}];},useRef(initial){const index=cursor++;if(!(index in slots))slots[index]={current:initial??{focus(){focusCalls++;},scrollIntoView(){scrollCalls++;}}};return slots[index];}};
 const Component=guidedComponent(hooks);
 return{render(){cursor=0;return Component(inputProps);},get focusCalls(){return focusCalls;},get scrollCalls(){return scrollCalls;}};
}
test('typing a checkpoint search preserves text-entry focus and scroll while explicit jumps still move focus',()=>{
 const harness=eventHarness({...props,checks:[checkpoint('extinguisher','Acceptable',{label:'Extinguisher location'}),checkpoint('door','Not checked',{label:'Exit door opening'})]});
 const priorFrame=globalThis.requestAnimationFrame;let frameCalls=0;globalThis.requestAnimationFrame=callback=>{frameCalls++;callback();return frameCalls;};
 try{
  for(const value of ['e','ex','exit','exit door','no such checkpoint','exit door opening']){
   const input=findElement(harness.render(),element=>element.type==='input'&&element.props.placeholder==='Exit door, extinguisher, FDC…');input.props.onChange({target:{value}});
   assert.equal(findElement(harness.render(),element=>element===input||element.type==='input'&&element.props.placeholder==='Exit door, extinguisher, FDC…').props.value,value);
  }
  assert.equal(frameCalls,0,'search must not schedule a focus or scroll away from the typing field');assert.equal(harness.focusCalls,0);assert.equal(harness.scrollCalls,0);
  const jumpLabel=findElement(harness.render(),element=>element.type==='label'&&element.props.className==='fi-field fi-guided-jump');findElement(jumpLabel,element=>element.type==='select').props.onChange({target:{value:'door'}});
  assert.equal(frameCalls,1);assert.equal(harness.focusCalls,1);assert.equal(harness.scrollCalls,1);
 }finally{if(priorFrame===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=priorFrame;}
});
test('a custom checkpoint can be removed only after confirmation and delegates the exact occurrence to the parent evidence guard',()=>{
 const removed=[],harness=eventHarness({...props,checks:[checkpoint('custom-occurrence','Not checked',{section:'Custom'})],onRemove:id=>removed.push(id)}),priorWindow=globalThis.window;let confirmed=false;
 globalThis.window={confirm:()=>confirmed};
 try{
  const remove=findElement(harness.render(),element=>element.type==='button'&&element.props.children==='Remove checkpoint');assert.ok(remove,'custom checkpoints need a removal route');remove.props.onClick();assert.deepEqual(removed,[]);
  confirmed=true;remove.props.onClick();assert.deepEqual(removed,['custom-occurrence']);
 }finally{if(priorWindow===undefined)delete globalThis.window;else globalThis.window=priorWindow;}
});
test('native date input events immediately commit due and corrected dates for each finding state',()=>{
 const cases=[
  ['Needs attention','Correction due date','dueDate'],
  ['Needs attention','Corrected date (if later verified)','correctedDate'],
  ['Corrected on site','Corrected date','correctedDate'],
  ['Corrected on site','Correction due date, if applicable','dueDate'],
  ['Resolved','Corrected date','correctedDate'],
  ['Resolved','Correction due date, if applicable','dueDate']
 ];
 for(const[result,label,key]of cases){
  const updates=[],harness=eventHarness({...props,checks:[checkpoint('date-occurrence',result)],onUpdate:(id,patch)=>updates.push({id,patch})});
  const field=findElement(harness.render(),element=>element.type==='label'&&React.Children.toArray(element.props.children)[0]===label),input=findElement(field,element=>element.type==='input'&&element.props.type==='date');assert.ok(input,label+' must be available');
  assert.equal(typeof input.props.onInput,'function',label+' must accept the native input event');input.props.onInput({currentTarget:{value:'2026-12-16'}});assert.deepEqual(updates.pop(),{id:'date-occurrence',patch:{[key]:'2026-12-16'}});
  input.props.onChange({target:{value:'2026-12-17'}});assert.deepEqual(updates.pop(),{id:'date-occurrence',patch:{[key]:'2026-12-17'}});
  input.props.onInput({currentTarget:{value:''}});assert.deepEqual(updates.pop(),{id:'date-occurrence',patch:{[key]:''}});
 }
});
