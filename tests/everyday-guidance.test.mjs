import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
function load(file,dependencies={}) {
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const target={exports:{}};
 new Function('require','module','exports',code)(name=>{if(name.endsWith('.css'))return{};if(name in dependencies)return dependencies[name];if(name==='react/jsx-runtime')return require(name);throw Error('Unexpected dependency '+name);},target,target.exports);
 return target.exports;
}
const guide=load('app/everyday-guide.tsx');
const status=load('app/save-status.tsx',{'./workflow-status':{savedTimeLabel:()=> 'test receipt'}});
const render=(Component,props)=>renderToStaticMarkup(React.createElement(Component,props));
const walk=(node,out=[])=>{if(Array.isArray(node))node.forEach(n=>walk(n,out));else if(node&&typeof node==='object'){out.push(node);walk(node.props?.children,out);}return out;};

test('everyday guidance gives three visible steps without inventing saves or adding mutation controls',()=>{
 for(const [page,steps] of Object.entries(guide.everydaySteps)){
  assert.deepEqual(Object.keys(steps),['start','save','next']);
  const html=render(guide.default,{page});assert.match(html,/Start here/);assert.match(html,/How to save/);assert.match(html,/What&#x27;s next/);
  assert.doesNotMatch(html,/<button|<form|<input|<a /);assert.equal((html.match(/<li>/g)||[]).length,3);
 }
 assert.equal(render(guide.default,{page:'Command Board'}),'');assert.equal(render(guide.default,{page:'Respond'}),'');assert.equal(render(guide.default,{page:'Operations Board'}),'');
});
test('record-specific forms retain their own guidance and inventory guide follows the current workspace',()=>{
 assert.match(fs.readFileSync('app/portal-wayfinding.tsx','utf8'),/!taskReturn && <EverydayGuide page=\{page\}/);
 const active=render(guide.default,{inventoryView:'check'});assert.match(active,/bag or tool box/);assert.match(active,/saving an item alone does not submit/i);
 assert.match(render(guide.default,{inventoryView:'service'}),/does not mark it repaired/);
 assert.match(render(guide.default,{inventoryView:'reports'}),/Approval or a request for changes is a separate action/);
 assert.equal(render(guide.default,{inventoryView:'setup'}),'');
});
test('guidance preserves read-only, approval and external delivery boundaries',()=>{
 assert.match(guide.everydaySteps['My Timesheet'].save,/cannot change hours/);
 assert.match(guide.everydaySteps.Timesheets.save,/leave a field/);
 assert.match(guide.everydaySteps['Field Preplans'].save,/device draft is not a department save/);
 assert.match(guide.everydaySteps['NERIS Reporting'].next,/does not submit/);
 assert.match(guide.everydaySteps.EMS.save,/PDF app/);
 assert.match(guide.everydaySteps['Safety Inspections'].next,/does not send an email/);
});
test('save feedback never treats an unconfirmed save as saved and preserves the real retry handler',()=>{
 for(const state of ['unsaved','saving','failed','loading']){const html=render(status.SaveStatus,{state,savedAt:'2026-11-23T12:00:00Z'});assert.doesNotMatch(html,/Confirmed test receipt/);}
 const failed=render(status.SaveStatus,{state:'failed'});assert.match(failed,/Save not confirmed/);assert.match(failed,/Keep your edits/);assert.doesNotMatch(failed,/<button/);
 let calls=0;const tree=status.SaveStatus({state:'failed',onRetry:()=>calls++});walk(tree).find(n=>n.type==='button').props.onClick();assert.equal(calls,1);
 assert.match(render(status.SaveStatus,{state:'saved',savedAt:'2026-11-23T12:00:00Z'}),/Confirmed test receipt/);
 assert.match(render(status.SaveStatus,{state:'saved',detail:'Officer approval still needed.'}),/Officer approval still needed/);
});
test('Today task buttons only navigate to granted tools and never write records',()=>{
 const react={useState:initial=>[initial,()=>{}],useRef:initial=>({current:initial}),useCallback:fn=>fn,useEffect:()=>{}};
 const today=load('app/today-dashboard.tsx',{react,'./portal-status':{readPortalJson:()=>{throw Error('No reads during navigation render');}},'./visible-poller':{},'./employee-names':{},'./workflow-status':{},'./shift-overview':{shiftPacketStale:()=>true}}).default;
 const actions=[];const tree=today({departmentName:'Fictional department',allowedPages:['Inventory','My Timesheet','Scheduling'],onNavigate:page=>actions.push(page)});
 const nav=walk(tree).find(n=>n.props?.className==='today-actions');const buttons=walk(nav).filter(n=>n.type==='button');assert.equal(buttons.length,3);buttons.forEach(b=>b.props.onClick());assert.deepEqual(actions,['Inventory','Scheduling','My Timesheet']);
 assert.doesNotMatch(renderToStaticMarkup(tree),/Open shift log|Open a call|See station duties/);
});
