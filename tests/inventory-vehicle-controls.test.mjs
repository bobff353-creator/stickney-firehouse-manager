import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

// Render and exercise the real checklist row without a production session or database.
const source=fs.readFileSync(new URL('../app/inventory-operations.tsx',import.meta.url),'utf8');
const helpers=source.slice(source.indexOf('function isNumericReadingItem'),source.indexOf('const repairStages'));
const renderer=source.slice(source.indexOf('  const renderActiveItem ='),source.indexOf('  const remainingForCheck ='));
const compiled=ts.transpileModule(helpers+renderer+'\nreturn renderActiveItem;', {compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(reading='',canCheck=true) {
 const state={saved:[],issue:null};
 const scope={value:(row,key)=>String(row[key]??''),canCheck,numericReadings:{item:reading},busy:'',openOrdersByEquipment:new Map(),activeAllowsRelocation:false,pendingLocationChangeByEquipmentId:new Map(),itemSaveError:null,
  setNumericReadings:()=>{},recordCheckItems:(_key,payload)=>state.saved.push(payload),setDeficiencyAssignees:()=>{},setDeficiencyItem:item=>{state.issue=item;}};
 const render=new Function('require','exports',...Object.keys(scope),compiled)(()=>jsx,{},...Object.values(scope));
 return {state,render:(name,extra={})=>render({id:'item',equipment_name:name,result:'pending',response_type:'pass_fail',...extra})};
}
function elements(node,type) {
 if (!node || typeof node!=='object') return [];
 if (Array.isArray(node)) return node.flatMap(child=>elements(child,type));
 return [...(node.type===type?[node]:[]),...elements(node.props?.children,type)];
}
test('daily and weekly mileage labels require a number before saving',()=>{
 for(const name of ['Record miles','Record mileage','Odometer']) {
  for(const reading of ['', '-1','not a number','12000.5']) {
   const f=fixture(reading);const row=f.render(name);const inputs=elements(row,'input');const buttons=elements(row,'button');
   assert.equal(inputs.length,1);assert.equal(inputs[0].props.type,'number');
   assert.equal(buttons.length,1);assert.equal(buttons[0].props.disabled,reading!=='12000.5');
   if(!buttons[0].props.disabled) {buttons[0].props.onClick();assert.equal(f.state.saved[0].numericReading,reading);}
   assert.match(renderToStaticMarkup(row),/Current mileage \/ odometer/);
  }
 }
});
test('all matching oil and transmission checks expose level choices and retain issue handling',()=>{
 for(const name of ['Engine oil','Engine oil in range','Transmission fluid (vehicle must be on and in neutral)']) {
  const f=fixture();const row=f.render(name);const buttons=elements(row,'button');
  assert.deepEqual(buttons.map(button=>button.props.children),['Low','In range','High']);
  buttons[1].props.onClick();assert.equal(f.state.saved[0].notes,'Fluid level: In range');
  for(const index of [0,2]) {buttons[index].props.onClick();assert.equal(f.state.issue.notes,`Fluid level: ${buttons[index].props.children}`);}
  const html=renderToStaticMarkup(f.render(name,{result:'failed',notes:'Fluid level: Low\nNeeds attention'}));
  assert.match(html,/Fluid level: Low/);
  assert.ok(elements(fixture('',false).render(name),'button').every(button=>button.props.disabled));
 }
});
test('ordinary checks keep Pass, Issue and N/A',()=>{
 assert.deepEqual(elements(fixture().render('Vehicle horn operational'),'button').map(button=>button.props.children),['Pass','Issue','N/A']);
});
