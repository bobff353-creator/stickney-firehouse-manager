import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../app/today-dashboard.tsx',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const walk=(node,result=[])=>{if(Array.isArray(node))node.forEach(child=>walk(child,result));else if(node&&typeof node==='object'){result.push(node);walk(node.props?.children,result);}return result;};
const text=node=>node==null?'':Array.isArray(node)?node.map(text).join(''):typeof node==='object'?text(node.props?.children):String(node);

function fixture(){
  let cursor=0,tree,load;
  const hooks=[],effects=[],reads=[],events=new Map(),timeouts=[];
  const navigator={onLine:true};
  const react={
    useState(initial){const i=cursor++;hooks[i]??={value:initial};return[hooks[i].value,next=>{hooks[i].value=typeof next==='function'?next(hooks[i].value):next;}];},
    useRef(initial){const i=cursor++;hooks[i]??={value:{current:initial}};return hooks[i].value;},
    useCallback(fn){const i=cursor++;hooks[i]??={value:fn};return hooks[i].value;},
    useEffect(fn){const i=cursor++;if(!hooks[i]){hooks[i]={};effects.push(fn);}},
  };
  const window={
    setTimeout(fn){timeouts.push(fn);return timeouts.length;},clearTimeout(){},setInterval(){return 1;},clearInterval(){},
    addEventListener(name,fn){events.set(name,fn);},removeEventListener(name){events.delete(name);},
  };
  const mods={react,'react/jsx-runtime':require('react/jsx-runtime'),'./today-dashboard.css':{},
    './portal-status':{readPortalJson:()=>new Promise(resolve=>reads.push(resolve))},
    './visible-poller':{startVisiblePolling(fn){load=fn;return{stop(){}};}},
    './employee-names':{formatEmployeeName:name=>name},'./workflow-status':{savedTimeLabel:()=> 'Preview receipt'},
    './shift-overview':{shiftPacketStale:(_packet,_clock,error)=>Boolean(error),shiftOverview:()=>({state:'ready',parts:[{id:'checks',label:'Checks',state:'ready',detail:'Saved'}],items:[]})},
  };
  const target={exports:{}};
  new Function('require','module','exports','window','navigator',code)(name=>mods[name],target,target.exports,window,navigator);
  const render=()=>{cursor=0;tree=target.exports.default({departmentName:'Fictional test department',allowedPages:['Dashboard','Inventory','Daily Log'],onNavigate(){},showPersonalShift:false});};
  render();effects.forEach(fn=>fn());timeouts.forEach(fn=>fn());
  const packet={asOf:'2026-10-23T13:00:00Z',date:'2026-10-23',currentShift:'morning',onDuty:[],officerInCharge:null,fleet:[],activeCalls:[]};
  return{
    render,
    startRead:()=>load(new AbortController().signal),
    receive:()=>reads.shift()(structuredClone(packet)),
    connection(online){navigator.onLine=online;events.get(online?'online':'offline')();render();},
    status:()=>text(walk(tree).find(node=>node.props?.className==='today-received').props.children[0]),
    readyCount:()=>walk(tree).filter(node=>node.props?.className==='today-status ready').length,
  };
}

test('Today removes current readiness immediately offline and requires a new receipt after reconnect',async()=>{
  const f=fixture();const first=f.startRead();f.receive();await first;f.render();
  assert.equal(f.status(),'Latest shift briefing');assert.equal(f.readyCount(),1);
  f.connection(false);assert.equal(f.status(),'Offline · last received records');assert.equal(f.readyCount(),0);
  f.connection(true);assert.equal(f.status(),'Update unavailable');assert.equal(f.readyCount(),0);
  const fresh=f.startRead();f.receive();await fresh;f.render();assert.equal(f.status(),'Latest shift briefing');assert.equal(f.readyCount(),1);
});

test('a manual read begun before an outage cannot clear the stale warning after reconnect',async()=>{
  const f=fixture();const first=f.startRead();f.receive();await first;f.render();
  const interrupted=f.startRead();f.connection(false);f.connection(true);f.receive();await interrupted;f.render();
  assert.equal(f.status(),'Update unavailable');assert.equal(f.readyCount(),0);
  const fresh=f.startRead();f.receive();await fresh;f.render();assert.equal(f.status(),'Latest shift briefing');
});
