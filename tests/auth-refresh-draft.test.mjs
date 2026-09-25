import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const code=ts.transpileModule(readFileSync(new URL('../app/auth-gateway.tsx',import.meta.url),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
}).outputText;
const user={id:'fictional-owner',email:'owner@example.invalid'};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture(){
  const hooks=[],effects=[],transitions=[],requests=[];
  let index=0,listener,signouts=0;
  const react={
    useState(initial){const slot=index++;hooks[slot]??={value:initial};return[hooks[slot].value,value=>{hooks[slot].value=value;if(slot===0)transitions.push(value);}];},
    useRef(initial){const slot=index++;return hooks[slot]??=( {current:initial});},
    useCallback(fn){index++;return fn;},
    useEffect(fn){index++;effects.push(fn);},
  };
  const auth={getUser:async()=>({data:{user},error:null}),
    onAuthStateChange(fn){listener=fn;return{data:{subscription:{unsubscribe(){}}}};},
    async signOut(){signouts++;listener('SIGNED_OUT',null);},
  };
  const exports={};
  runInNewContext(code,{exports,require(name){
    if(name==='react')return react;
    if(name==='react/jsx-runtime')return{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
    if(name==='./supabase-browser')return{getSupabaseBrowserClient:()=>({auth})};
    if(name==='./auth-failure-policy')return{boundedAuthRead:p=>p,definitiveAuthFailure:()=>false};
    if(name==='./preplans/offline-cache')return{clearCachedRespondPackets:async()=>{}};
    return{};
  },fetch:()=>new Promise(resolve=>requests.push(resolve)),AbortSignal,document:{cookie:''},window:{addEventListener(){},removeEventListener(){}}});
  exports.default({});
  for(const effect of effects)effect();
  await tick();
  const reply=async(status=200,payload={pinConfigured:true,pinUnlocked:true})=>{assert.ok(requests.length,'pending server verification');requests.shift()(Response.json(payload,{status}));await tick();};
  assert.equal(hooks[0].value,'checking');
  await reply();assert.equal(hooks[0].value,'authorized');
  transitions.length=0;
  return{emit(event='SIGNED_IN',nextUser=user){listener(event,{user:nextUser});},reply,requests,transitions,get mode(){return hooks[0].value;},get signouts(){return signouts;}};
}

test('repeat sign-in and refresh events preserve the verified tool while rechecking server access',async()=>{
  const f=await fixture();
  for(const event of ['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED']){
    f.emit(event);assert.equal(f.mode,'authorized');assert.equal(f.requests.length,1);
    f.emit(event);assert.equal(f.requests.length,1,'same-account verification is coalesced');
    await f.reply();assert.equal(f.mode,'authorized');
  }
  assert.ok(f.transitions.every(mode=>mode==='authorized'),'no transient unmount of the editor');
  f.emit();await f.reply(503,{error:'Temporary outage'});
  assert.equal(f.mode,'authorized');assert.equal(f.signouts,0);
});

test('server PIN, membership and expired-session denials still remove protected tools',async()=>{
  for(const [status,payload,expected] of [
    [200,{pinConfigured:true,pinUnlocked:false},'pin'],
    [200,{pinConfigured:false,pinUnlocked:false},'set-pin'],
    [403,{error:'Not approved'},'waiting'],
    [401,{error:'Expired'},'sign-in'],
  ]){
    const f=await fixture();f.emit();await f.reply(status,payload);assert.equal(f.mode,expected);
    f.emit();assert.equal(f.mode,'checking','denied identity must pass a blocking check again');
    await f.reply();assert.equal(f.mode,'authorized');
  }
});

test('a different account blocks immediately and cannot inherit an in-flight verification',async()=>{
  const f=await fixture();f.emit();
  f.emit('TOKEN_REFRESHED',{id:'other-fictional-user',email:'other@example.invalid'});
  assert.equal(f.mode,'checking');assert.equal(f.requests.length,2);
  await f.reply();assert.equal(f.mode,'checking','old account response must be ignored');
  await f.reply(403,{error:'No department membership'});assert.equal(f.mode,'waiting');
});

test('sign-out invalidates a pending successful access response',async()=>{
  const f=await fixture();f.emit();f.emit('SIGNED_OUT');
  assert.equal(f.mode,'sign-in');await f.reply();assert.equal(f.mode,'sign-in');
});
