import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as indices from '../app/inventory-index.ts';
import * as workflow from '../app/inventory-check-flow.ts';
import * as statuses from '../app/workflow-status.ts';
import * as services from '../app/inventory-service-schedule.ts';
import * as filters from '../app/inventory-workspace-filters.ts';
import * as attention from '../app/inventory-asset-attention.ts';
import * as air from '../app/inventory-air-checks.ts';

const require=createRequire(import.meta.url);
const jsx=require('react/jsx-runtime');
const now=Date.parse('2026-10-23T15:00:00Z');
class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
const compile=path=>ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8')+'\nexport {emptyData};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function walk(node,parents=[],out=[]){if(Array.isArray(node)){node.forEach(item=>walk(item,parents,out));return out;}if(node&&typeof node==='object'){out.push({node,parents});walk(node.props?.children,[...parents,node],out);}return out;}
const text=node=>Array.isArray(node)?node.map(text).join(''):node&&typeof node==='object'?text(node.props?.children):typeof node==='boolean'?'':String(node??'');

function fixture({critical=true,loading=false,unavailable=false}={}){
  let state=0,data;
  const navigations=[],opened=[];
  const react={useState(initial){const slot=state++;return[slot===0?data:slot===1?loading:slot===14&&unavailable?'Preview source unavailable':typeof initial==='function'?initial():initial,()=>{}];},useRef:initial=>({current:initial}),useEffect(){},useCallback:fn=>fn,useMemo:fn=>fn(),useDeferredValue:value=>value};
  const mods={react,'react/jsx-runtime':jsx,'./inventory-index':indices,'./inventory-check-flow':workflow,'./workflow-status':statuses,'./inventory-service-schedule':services,'./inventory-workspace-filters':filters,'./inventory-asset-attention':attention,'./inventory-air-checks':air,
    './workspace-view-state':{useWorkspaceViewState:(_key,initial)=>[initial,()=>{}]},'./use-unsaved-work':{useUnsavedWork(){},confirmLeavingWork:()=>true},'./inventory-save-reference':{createInventorySaveReferences:()=>({})},'./conditional-json-reader':{createConditionalJsonReader:()=>({})},
  };
  const target={exports:{}};
  new Function('require','module','exports','Date',compile('../app/inventory-operations.tsx'))(name=>mods[name]??{},target,target.exports,Clock);
  const rig={id:'preview-engine',name:'Preview Engine',status:'in_service'};
  data={...structuredClone(target.exports.emptyData),configured:!unavailable,apparatus:[rig],equipment:[{id:'preview-radio',apparatus_id:rig.id,name:'Preview radio',check_types:['daily','inventory'],service_status:critical?'out_of_service':'in_service'}],
    checks:[{id:'preview-daily',apparatus_id:rig.id,check_type:'daily',status:'in_progress',started_at:'2026-10-22T12:00:00Z'},{id:'preview-inventory',apparatus_id:rig.id,check_type:'inventory',status:'in_progress'}],
    checkItems:[{id:'preview-result',check_id:'preview-daily',equipment_id:'preview-radio',result:'pending'}],inspectionSchedules:[{id:'preview-schedule',apparatus_id:rig.id,check_type:'daily',day_of_week:5,active:true}],
    workOrders:critical?[{id:'preview-urgent',status:'open',priority:'high'},{id:'preview-closed',status:'closed',priority:'critical'}]:[],
    stock:critical?[{id:'preview-supply',name:'Preview supply',lot_id:'preview-expired',expires_at:'2020-01-01',quantity_on_hand:2},{id:'preview-zero',name:'Preview empty lot',lot_id:'preview-empty',expires_at:'2020-01-01',quantity_on_hand:0}]:[],
  };
  const tree=target.exports.default({view:'due',afterDueChecks:jsx.jsx('nav',{'aria-label':'Preview secondary tools'}),onSetup(){},canCheck:true,onNavigate:view=>navigations.push(view),onOpenUnit:(id,type)=>opened.push([id,type])});
  return{tree,items:walk(tree),navigations,opened};
}

test('Due Now presents required checks before closed status/help and retains the exact resume action',()=>{
  const f=fixture();
  const card=f.items.find(({node})=>node.props?.className==='ops-card due-now-card');
  const summary=f.items.find(({node})=>node.props?.className==='inventory-operating-summary');
  assert.ok(card);assert.ok(summary);assert.ok(f.items.indexOf(card)<f.items.indexOf(summary));
  assert.ok(!summary.node.props.open,'noncritical overview starts closed');
  assert.match(text(card.node),/1 required check/);assert.match(text(card.node),/1 in progress · all dates/);
  const resume=f.items.find(({node})=>node.type==='button'&&text(node)==='Resume check');assert.ok(resume);assert.equal(resume.node.props.disabled,false);
  resume.node.props.onClick();assert.deepEqual(f.opened,[['preview-engine','daily']]);
  assert.ok(!card.parents.some(parent=>parent.type==='details'),'due work stays outside disclosures');
  const secondary=f.items.find(({node})=>node.props?.['aria-label']==='Preview secondary tools');assert.ok(f.items.indexOf(card)<f.items.indexOf(secondary),'shell totals and other tools follow required check cards');
  const finder=f.items.find(({node})=>node.props?.className==='inventory-apparatus-finder');assert.ok(finder);assert.equal(finder.node.props.open,false,'apparatus search is optional until needed');
});

test('critical issues remain outside collapsed summaries and use department-wide, deduplicated source counts',()=>{
  const f=fixture();
  const warning=f.items.find(({node})=>node.props?.className==='inventory-priority-notice inventory-critical-work');
  assert.ok(warning);assert.ok(!warning.parents.some(parent=>parent.type==='details'));
  assert.match(text(warning.node),/1 asset with critical issues/);assert.match(text(warning.node),/1 high \/ critical repair/);assert.match(text(warning.node),/1 supply with expired stock/);assert.match(text(warning.node),/Department-wide saved records/);
  const actions=walk(warning.node).filter(({node})=>node.type==='button');actions.forEach(({node})=>node.props.onClick());
  assert.deepEqual(f.navigations,['equipment','service','stock']);
  const clear=fixture({critical:false});assert.ok(!clear.items.some(({node})=>node.props?.className==='inventory-priority-notice inventory-critical-work'),'absence of saved critical issues does not manufacture a warning');
  assert.ok(clear.items.some(({node})=>node.props?.className==='ops-card due-now-card'));
});

test('loading and initial source failure retain the secondary inventory navigation',()=>{
  for(const state of [{loading:true},{unavailable:true}]){
    const f=fixture(state);assert.ok(f.items.some(({node})=>node.props?.['aria-label']==='Preview secondary tools'));
    assert.ok(!f.items.some(({node})=>node.props?.className==='ops-card due-now-card'),'no empty or ready due list is shown before source verification');
    assert.match(text(f.tree),state.loading?/Loading saved Inventory records/:/Preview source unavailable/);
  }
});

test('Due Now shell keeps out-of-service apparatus and source uncertainty visible outside its closed totals',()=>{
  const source=readFileSync(new URL('../app/inventory-live.tsx',import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const render=sourceState=>{
    let state=0;
    const suite={configured:true,department:{id:'preview-department',name:'Preview department'},apparatus:[{id:'preview-oos',call_sign:'TEST 1',unit_name:'Preview Engine',status:'out_of_service'}],events:[]};
    const react={useState(initial){const slot=state++;return[slot===4?sourceState:slot===5?suite:typeof initial==='function'?initial():initial,()=>{}];},useRef:initial=>({current:initial}),useEffect(){},useCallback:fn=>fn,useMemo:fn=>fn()};
    const mods={react,'react/jsx-runtime':jsx,'./use-permissions':{usePermissions:()=>({verified:true,permissions:['inventory.view','inventory.check'],confirmation:{required:false}})},'./use-unsaved-work':{confirmLeavingWork:()=>true}};
    const target={exports:{}};new Function('require','module','exports',code)(name=>mods[name]??{},target,target.exports);
    return walk(target.exports.default({departmentId:'preview-department',departmentName:'Preview department',permissions:[]}));
  };
  const ready=render('ready'),dueChild=ready.find(({node})=>node.props?.view==='due'&&node.props?.afterDueChecks);assert.ok(dueChild,'secondary tools are passed to the position after required check cards');
  const totals=walk(dueChild.node.props.afterDueChecks).find(({node})=>node.props?.className==='inventory-status-details');assert.ok(totals);assert.equal(totals.node.props.open,false);
  const header=ready.find(({node})=>node.props?.className==='inventory-command-header');assert.ok(header);assert.ok(!walk(header.node).some(({node})=>node.props?.className==='inventory-status-details'),'totals do not push checks below the fold');
  const mobile=ready.find(({node})=>node.props?.className==='mobile-nav');assert.equal(walk(mobile.node).find(({node})=>node.props?.['aria-current']==='page').node.props.children[1],'Due','mobile selection has an accessible current-page state');
  assert.equal(walk(totals.node).filter(({node})=>node.type==='button').length,4,'all original summary actions remain available');
  const priority=ready.find(({node})=>node.props?.className==='inventory-priority-notice');assert.ok(priority);assert.match(text(priority.node),/1 apparatus out of service or impaired/);assert.match(text(priority.node),/TEST 1/);assert.ok(!priority.parents.some(parent=>parent.type==='details'));
  const failed=render('unavailable');assert.ok(failed.some(({node,parents})=>node.props?.className==='inventory-priority-notice'&&text(node).includes('could not be refreshed')&&!parents.some(parent=>parent.type==='details')));
});
