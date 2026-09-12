import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function compile(file,deps){const module={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>{if(!(name in deps))throw Error('Missing dependency '+name);return deps[name];},module,module.exports);return module.exports;}
function proxyFixture({signedIn=true,member=true,configured=true,unlocked=true}={}){
 let forwarded;
 function cookieJar(){const map=new Map();return{getAll:()=>[...map.values()],set(name,value,options){if(typeof name==='object')map.set(name.name,name);else map.set(name,{name,value,...options});},get(name){return map.get(name);},toString:()=>[...map.values()].map(c=>c.name+'='+c.value).join('; ')};}
 const next={next(options){forwarded=options;return{headers:new Headers(),cookies:cookieJar()};},json:(body,init)=>Response.json(body,init)};
 const client=(_url,_key,options)=>({auth:{async getUser(){options.cookies.setAll([{name:'auth-refresh',value:'fixture-renewed',options:{httpOnly:true,path:'/'}}]);return{data:{user:signedIn?{id:'fixture',email:'member@example.invalid'}:null},error:null};}},from(){const chain={select:()=>chain,eq:()=>chain,maybeSingle:async()=>({data:member?{role:'user'}:null,error:null})};return chain;},async rpc(name){return{data:name==='is_platform_owner'?false:name==='portal_pin_status'?[{configured,unlocked}]:null,error:null};}});
 const proxy=compile('proxy.ts',{'@supabase/ssr':{createServerClient:client},'next/server':{NextResponse:next},'./app/supabase-config':{getPublicSupabaseConfig:()=>({url:'https://example.invalid',key:'publishable-fixture'})}}).proxy;
 const request=(method='GET',origin='https://portal.test')=>({method,nextUrl:new URL('https://portal.test/api/payroll'),headers:new Headers({'origin':origin,'oai-authenticated-user-email':'spoofed@example.invalid'}),cookies:cookieJar()});
 return{proxy,request,get forwarded(){return forwarded;}};
}
test('session refresh preserves auth cookies and replaces spoofed identity',async()=>{
 const before=process.env.PAYROLL_DEPARTMENT_ID;process.env.PAYROLL_DEPARTMENT_ID='fixture';
 try{const f=proxyFixture();const response=await f.proxy(f.request());assert.equal(response.cookies.get('auth-refresh').value,'fixture-renewed');assert.equal(f.forwarded.request.headers.get('oai-authenticated-user-email'),'member@example.invalid');assert.match(f.forwarded.request.headers.get('cookie'),/auth-refresh=fixture-renewed/);assert.match(response.headers.get('Cache-Control'),/no-store/);}finally{if(before===undefined)delete process.env.PAYROLL_DEPARTMENT_ID;else process.env.PAYROLL_DEPARTMENT_ID=before;}
});
test('expired, unapproved, PIN-locked and cross-origin sessions are denied',async()=>{
 const before=process.env.PAYROLL_DEPARTMENT_ID;process.env.PAYROLL_DEPARTMENT_ID='fixture';
 try{for(const[options,status]of [[{signedIn:false},401],[{member:false},403],[{configured:false},423],[{unlocked:false},423]]){const f=proxyFixture(options);assert.equal((await f.proxy(f.request())).status,status);}const f=proxyFixture();assert.equal((await f.proxy(f.request('POST','https://wrong.invalid'))).status,403);}finally{if(before===undefined)delete process.env.PAYROLL_DEPARTMENT_ID;else process.env.PAYROLL_DEPARTMENT_ID=before;}
});
test('permission subscriptions discard an old in-flight result after unmount/remount',async()=>{
 const originalFetch=globalThis.fetch;let subscribed;const effects=[];const replies=[];
 const hook=compile('app/use-permissions.ts',{react:{useEffect:fn=>effects.push(fn),useSyncExternalStore(subscribe,snapshot){subscribed=subscribe;return snapshot();}}});
 globalThis.fetch=()=>new Promise(resolve=>replies.push(resolve));
 try{hook.usePermissions();const off=subscribed(()=>{});const first=hook.refreshPermissions();assert.equal(hook.refreshPermissions(),first);off();const off2=subscribed(()=>{});const second=hook.refreshPermissions();assert.notEqual(first,second);replies[0](Response.json({viewerPermissions:['payroll.manage'],identity:'old'}));await first;replies[1](Response.json({viewerPermissions:['payroll.view_own'],identity:'new'}));await second;const current=hook.usePermissions();assert.equal(current.identity,'new');assert.deepEqual(current.permissions,['payroll.view_own']);off2();}finally{globalThis.fetch=originalFetch;}
});
test('failed permission verification clears previously confirmed grants',async()=>{
 const originalFetch=globalThis.fetch;let subscribe;
 const hook=compile('app/use-permissions.ts',{react:{useEffect(){},useSyncExternalStore(sub,snapshot){subscribe=sub;return snapshot();}}});
 try{hook.usePermissions();const off=subscribe(()=>{});globalThis.fetch=async()=>Response.json({viewerPermissions:['payroll.manage']});await hook.refreshPermissions();assert.equal(hook.usePermissions().verified,true);globalThis.fetch=async()=>Response.json({error:'Fixture unavailable'},{status:503});await hook.refreshPermissions();const result=hook.usePermissions();assert.equal(result.verified,false);assert.deepEqual(result.permissions,[]);off();}finally{globalThis.fetch=originalFetch;}
});

test('a transient timeout clears grants while retrying and recovers without parallel requests',async()=>{
 const originalFetch=globalThis.fetch;let subscribe;let resolveRetry;let calls=0;
 const hook=compile('app/use-permissions.ts',{react:{useEffect(){},useSyncExternalStore(sub,snapshot){subscribe=sub;return snapshot();}}});
 try{
  hook.usePermissions();const off=subscribe(()=>{});
  globalThis.fetch=async()=>Response.json({viewerPermissions:['inventory.view','inventory.check']});
  await hook.refreshPermissions();
  globalThis.fetch=()=>{calls++;if(calls===1)return Promise.reject(new DOMException('signal timed out','TimeoutError'));return new Promise(resolve=>resolveRetry=resolve);};
  const pending=hook.refreshPermissions();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(hook.refreshPermissions(),pending);assert.equal(calls,2);
  const during=hook.usePermissions();assert.equal(during.verified,false);assert.equal(during.checking,true);assert.deepEqual(during.permissions,[]);assert.match(during.error,/access check took too long/i);assert.doesNotMatch(during.error,/signal timed out/);
  resolveRetry(Response.json({viewerPermissions:['inventory.view'],identity:'current'}));await pending;
  assert.equal(hook.usePermissions().checking,false);assert.deepEqual(hook.usePermissions().permissions,['inventory.view']);off();
 }finally{globalThis.fetch=originalFetch;}
});

test('denied, locked and expired sessions are not retried; repeated timeouts are bounded',async()=>{
 const originalFetch=globalThis.fetch;
 try{for(const status of [401,403,423,503,'timeout']){
  let subscribe;let calls=0;
  const hook=compile('app/use-permissions.ts',{react:{useEffect(){},useSyncExternalStore(sub,snapshot){subscribe=sub;return snapshot();}}});
  hook.usePermissions();const off=subscribe(()=>{});
  globalThis.fetch=async()=>{calls++;if(status==='timeout')throw new DOMException('signal timed out','TimeoutError');return Response.json({error:'Access unavailable'},{status});};
  await hook.refreshPermissions();assert.equal(calls,status===503||status==='timeout'?2:1);
  assert.equal(hook.usePermissions().verified,false);assert.equal(hook.usePermissions().checking,false);off();
 }}finally{globalThis.fetch=originalFetch;}
});
