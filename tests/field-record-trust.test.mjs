import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as contacts from '../app/preplan-contacts.ts';
import * as location from '../app/preplan-map-location.ts';
import * as fireFlow from '../app/preplan-fire-flow.ts';
import * as hydrantFlow from '../app/hydrant-flow.ts';

const require=createRequire(import.meta.url);
const code=ts.transpileModule(readFileSync(new URL('../app/field-preplans.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const point={lat:41.8189,lng:-87.7734};
const plan={id:'preview-building',businessName:'Preview building',address:'1 Fictional Lane, Stickney, IL',...point,latitude:point.lat,longitude:point.lng,aSideLatitude:point.lat,aSideLongitude:point.lng,footprint:[],contactInfo:'',construction:'',accessInfo:'',alarmSystem:'',knoxBox:'',riser:'',fdc:'',sprinklerSystem:'',floorCount:1,constructionType:'V',occupancyFlowCategory:'other',sprinklerStandard:'none',status:'Quick Preplan',features:[],photos:[]};
const hydrant={id:'preview-hydrant',hydrantNumber:'Preview hydrant',address:'2 Fictional Lane',latitude:point.lat,longitude:point.lng,serviceStatus:'in_service',manufacturer:'',model:'',portCount:0,portSizes:[],notes:'',flushes:[],flowTests:[]};

function fixture(){
  const hooks=[],effects=[],listeners=new Map(),requests=[];
  const server={failPreplans:false,failHydrants:false,plans:[structuredClone(plan)],hydrants:[structuredClone(hydrant)]};
  let cursor=0,tree,guard={dirty:false,saving:false};
  const react={
    useState(initial){const slot=cursor++;if(!hooks[slot])hooks[slot]={value:typeof initial==='function'?initial():initial};return[hooks[slot].value,next=>{hooks[slot].value=typeof next==='function'?next(hooks[slot].value):next;}];},
    useRef(initial){const slot=cursor++;return hooks[slot]??=( {current:initial});},
    useCallback(fn,deps){const slot=cursor++,prior=hooks[slot];if(!prior||deps.some((value,index)=>!Object.is(value,prior.deps[index])))hooks[slot]={value:fn,deps};return hooks[slot].value;},
    useMemo(fn){cursor++;return fn();},
    useEffect(fn,deps){const slot=cursor++,prior=hooks[slot];if(!prior||!deps||deps.some((value,index)=>!Object.is(value,prior.deps?.[index])))effects.push(()=>{prior?.cleanup?.();const cleanup=fn();hooks[slot]={deps,cleanup};});},
  };
  const win={location:{href:'https://example.invalid/?display=portal&page=field-preplans'},navigator:{onLine:true},scrollY:0,scrollTo(){},history:{pushState(_state,_title,url){win.location.href=new URL(url,win.location.href).href;},replaceState(_state,_title,url){win.location.href=new URL(url,win.location.href).href;}},addEventListener(name,fn){listeners.set(name,fn);},removeEventListener(name,fn){if(listeners.get(name)===fn)listeners.delete(name);},confirm:()=>true};
  const mods={react,'react/jsx-runtime':require('react/jsx-runtime'),'./preplan-contacts':contacts,'./preplan-map-location':location,'./preplan-fire-flow':fireFlow,'./hydrant-flow':hydrantFlow,
    './workspace-view-state':{useWorkspaceViewState:(_key,initial)=>react.useState(initial),restoreWorkspaceScroll:()=>()=>{}},
    './workspace-task-navigation':{useWorkspaceTaskReturn:()=>false},
    './use-unsaved-work':{useUnsavedWork:(dirty,saving)=>{guard={dirty,saving};},confirmLeavingWork:()=>true},
  };
  const compiledModule={exports:{}};
  const fetch=async url=>{
    requests.push(url);
    if(url==='/api/maps-config')return Response.json({configured:false});
    if(url==='/api/field-preplans')return server.failPreplans?Response.json({error:'Preview preplan outage'},{status:503}):Response.json({preplans:server.plans,imports:[],canEdit:true});
    if(url==='/api/field-hydrants?includeArchived=1')return server.failHydrants?Response.json({error:'Preview hydrant outage'},{status:503}):Response.json({hydrants:server.hydrants,canEdit:true});
    throw Error(`Unexpected request ${url}`);
  };
  new Function('require','module','exports','window','navigator','fetch','AbortSignal','requestAnimationFrame',code)(name=>mods[name]??{},compiledModule,compiledModule.exports,win,win.navigator,fetch,AbortSignal,fn=>fn());
  const render=()=>{cursor=0;tree=compiledModule.exports.default({});return tree;};
  const walk=(node,out=[])=>{if(Array.isArray(node)){node.forEach(item=>walk(item,out));return out;}if(node&&typeof node==='object'){out.push(node);walk(node.props?.children,out);}return out;};
  const text=node=>Array.isArray(node)?node.map(text).join(' '):node&&typeof node==='object'?text(node.props?.children):String(node??'');
  const button=label=>{const found=walk(tree).find(node=>node.type==='button'&&text(node)===label);assert.ok(found,`Button ${label}`);return found;};
  const flush=async()=>{for(let pass=0;pass<5;pass++){const pending=effects.splice(0);pending.forEach(fn=>fn());await tick();render();if(!effects.length)break;}};
  render();
  return{server,win,requests,render,flush,button,emit:name=>listeners.get(name)?.(),nodes:()=>walk(tree),text:()=>text(tree),guard:()=>guard};
}

test('initial source failures never turn unavailable field records into a verified zero or empty directory',async()=>{
  const f=fixture();assert.match(f.text(),/Loading saved field records/);assert.doesNotMatch(f.text(),/0 preplans|0 active hydrants/);
  f.server.failPreplans=true;f.server.failHydrants=true;await f.flush();
  assert.match(f.text(),/Field records could not be verified/);assert.match(f.text(),/Unavailable · no records verified/);
  assert.match(f.text(),/Field records are unavailable or incomplete/);assert.doesNotMatch(f.text(),/0 preplans|0 active hydrants|No records are visible here/);
  assert.equal(f.button('Retry field records').props.disabled,false);
});

test('failed refresh retains successful records, retry replaces them, and offline state is explicit',async()=>{
  const f=fixture();await f.flush();assert.match(f.text(),/Preview building/);assert.match(f.text(),/Preview hydrant/);assert.match(f.text(),/Last received/);
  f.server.failPreplans=true;f.server.failHydrants=true;await f.button('Refresh field records').props.onClick();await f.flush();
  assert.match(f.text(),/Preview building/);assert.match(f.text(),/Preview hydrant/);assert.match(f.text(),/Update failed/);
  f.server.failPreplans=false;f.server.failHydrants=false;f.server.plans[0].businessName='Updated preview building';await f.button('Retry field records').props.onClick();await f.flush();
  assert.match(f.text(),/Updated preview building/);assert.doesNotMatch(f.text(),/could not be verified/);
  f.win.navigator.onLine=false;f.emit('offline');f.render();
  assert.match(f.text(),/Offline · field records may be out of date/);assert.equal(f.button('Refresh field records').props.disabled,true);
  assert.ok(f.requests.every(url=>url.startsWith('/api/')),'the fixture performs read-only loads');
});

test('building edits participate in portal navigation protection and map centering never changes their coordinates',async()=>{
  const f=fixture();await f.flush();f.button('+ New Preplan').props.onClick();f.render();await f.flush();
  for(const corner of [point,{lat:point.lat+.001,lng:point.lng},{lat:point.lat,lng:point.lng+.001}]){
    f.nodes().find(node=>node.props?.draft&&node.props?.onMapClick).props.onMapClick(corner);f.render();
  }
  f.button('✓ Accept Footprint').props.onClick();f.render();f.button('Next: Building information →').props.onClick();f.render();
  const input=f.nodes().find(node=>node.type==='input'&&node.props.value==='');assert.ok(input);input.props.onChange({target:{value:'Unsaved preview building'}});f.render();
  assert.equal(f.guard().dirty,true,'building draft must use the shared portal navigation guard');
  const map=()=>f.nodes().find(node=>node.props?.draft?.businessName==='Unsaved preview building'&&node.props?.onMapClick);
  const before=structuredClone(map().props.draft);
  f.win.navigator.geolocation={getCurrentPosition:success=>success({coords:{latitude:point.lat+.01,longitude:point.lng+.01}})};
  f.button('◎ Current location').props.onClick();f.render();
  assert.equal(map().props.draft.latitude,before.latitude);assert.equal(map().props.draft.longitude,before.longitude);
  await f.button('Refresh field records').props.onClick();await f.flush();
  assert.equal(map().props.draft.businessName,before.businessName,'manual reads preserve unsaved building inputs');
});
