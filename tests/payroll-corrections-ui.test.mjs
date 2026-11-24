import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const compiled = ts.transpileModule(fs.readFileSync('app/payroll-corrections.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(mode='member') {
  const hooks=[],effects=[],requests=[]; let cursor=0,tree,guard,canLeave=true;
  const server={failRead:false,failSave:false,holdSave:null,rows:[]};
  const react={
    useState(initial){const slot=cursor++;if(!hooks[slot])hooks[slot]={value:initial};return[hooks[slot].value,next=>{hooks[slot].value=typeof next==='function'?next(hooks[slot].value):next;}];},
    useRef(initial){const slot=cursor++;return hooks[slot]??={current:initial};},
    useCallback(fn,deps){const slot=cursor++;const old=hooks[slot];if(!old||deps.some((v,i)=>v!==old.deps[i]))hooks[slot]={value:fn,deps};return hooks[slot].value;},
    useEffect(fn,deps){const slot=cursor++;const old=hooks[slot];if(!old||deps.some((v,i)=>v!==old.deps[i]))effects.push(()=>{old?.cleanup?.();hooks[slot]={deps,cleanup:fn()};});},
  };
  const fetch=async(url,init)=>{
    requests.push({url,...init});
    if(init?.method==='POST'){
      if(server.holdSave)await server.holdSave;
      return server.failSave?Response.json({error:'Save unavailable; retry same request.'},{status:503}):Response.json({ok:true});
    }
    return server.failRead?Response.json({error:'Read unavailable'},{status:503}):Response.json({requests:server.rows,canManage:mode==='manager',canRequest:true});
  };
  const exported={};
  new Function('require','exports','fetch','crypto','AbortController',compiled)(name=>name==='react'?react:name==='react/jsx-runtime'?require(name):{useUnsavedWork:(dirty,saving)=>{guard={dirty,saving};},confirmLeavingWork:()=>canLeave},exported,fetch,crypto,AbortController);
  const render=()=>{cursor=0;tree=exported.default({period:'2026-11-11',end:'2026-11-25',mode});return tree;};
  const walk=(n,out=[])=>{if(Array.isArray(n))n.forEach(v=>walk(v,out));else if(n&&typeof n==='object'){out.push(n);walk(n.props?.children,out);}return out;};
  const text=n=>Array.isArray(n)?n.map(text).join(' '):n&&typeof n==='object'?text(n.props?.children):String(n??'');
  const button=label=>{const node=walk(tree).find(n=>n.type==='button'&&text(n)===label);assert.ok(node,label);return node;};
  const input=(name,value)=>{const node=walk(tree).find(n=>n.props?.name===name);assert.ok(node);node.props.onChange({target:{value}});render();};
  const flush=async()=>{effects.splice(0).forEach(fn=>fn());await tick();render();};
  render();
  return{server,requests,render,flush,button,input,text:()=>text(tree),guard:()=>guard,leave:value=>{canLeave=value;},submit:()=>walk(tree).find(n=>n.type==='form').props.onSubmit({preventDefault(){}}),unmount:()=>hooks.forEach(h=>h.cleanup?.())};
}

test('initial load has an honest loading state and failed reads expose retry',async()=>{
  const f=fixture();assert.match(f.text(),/Loading correction requests/);assert.doesNotMatch(f.text(),/Retry loading requests/);
  f.server.failRead=true;await f.flush();assert.match(f.text(),/Read unavailable/);assert.ok(f.button('Retry loading requests'));
  f.server.failRead=false;await f.button('Retry loading requests').props.onClick();await f.flush();assert.match(f.text(),/No correction requests/);
});
test('drafts guard navigation and cancellation can keep the form intact',async()=>{
  const f=fixture();await f.flush();f.button('Request correction').props.onClick();f.render();f.input('date','2026-11-12');f.input('note','Review this shift');assert.equal(f.guard().dirty,true);
  f.leave(false);f.button('Cancel correction request').props.onClick();f.render();assert.ok(f.button('Send correction request'));assert.equal(f.guard().dirty,true);
  f.leave(true);f.button('Cancel correction request').props.onClick();f.render();assert.equal(f.guard().dirty,false);
});
test('failed save retains draft and retry token; confirmed save survives refresh failure',async()=>{
  const f=fixture();await f.flush();f.button('Request correction').props.onClick();f.render();f.input('date','2026-11-12');f.input('note','Review this shift');
  f.server.failSave=true;f.submit();await f.flush();assert.equal(f.guard().dirty,true);assert.match(f.text(),/Save unavailable/);
  f.server.failSave=false;f.server.failRead=true;f.submit();await f.flush();
  const posts=f.requests.filter(r=>r.method==='POST').map(r=>JSON.parse(r.body));assert.equal(posts.length,2);assert.equal(posts[0].token,posts[1].token);
  assert.match(f.text(),/Correction request saved.*list could not refresh/);assert.doesNotMatch(f.text(),/No correction requests for this period/);assert.match(f.text(),/received before your saved change/);assert.equal(f.guard().dirty,false);assert.ok(f.button('Request correction'));
});
test('in-flight correction cannot submit twice and initial read aborts on unmount',async()=>{
  const f=fixture();await f.flush();f.button('Request correction').props.onClick();f.render();f.input('date','2026-11-12');f.input('note','Review this shift');let release;f.server.holdSave=new Promise(resolve=>{release=resolve;});f.submit();f.submit();f.render();assert.equal(f.guard().saving,true);assert.equal(f.requests.filter(r=>r.method==='POST').length,1);release();await f.flush();f.unmount();assert.equal(f.requests[0].signal.aborted,true);
});
