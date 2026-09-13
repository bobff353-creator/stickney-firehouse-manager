import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import test from 'node:test';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const helper=ts.transpileModule(read('../app/remember-device.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const remember=await import(`data:text/javascript;base64,${Buffer.from(helper).toString('base64')}`);
const compiled=ts.transpileModule(read('../app/api/auth/login/route.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness({verified=true,rpcError=null,loginAllowed=true}={}) {
  const calls=[],cookies=[];
  const modules={
    '@supabase/ssr':{createServerClient:(_url,_key,options)=>({auth:{signInWithPassword:async()=>{
      options.cookies.setAll([{name:'auth-session',value:'fixture-session',options:{secure:true}}]);return {data:{user:{id:'fixture-user'}},error:null};
    }},rpc:async(name,args)=>{calls.push({name,args});return {data:[{ok:verified,unlock_token:name==='verify_portal_pin_with_device'?'rd1_'+'c'.repeat(64):'legacy-token',remembered_until:new Date(Date.now()+604800000).toISOString()}],error:rpcError};}})},
    'next/headers':{cookies:async()=>({getAll:()=>[]})},
    'next/server':{NextResponse:{json:(body,init)=>{const response=Response.json(body,init);response.cookies={set:(...args)=>cookies.push(args)};return response;}}},
    '../../../../db/postgres-adapter':{createPostgresD1Adapter:()=>({prepare:()=>({bind:()=>({first:async()=>({ok:loginAllowed,email:'member@example.test'}),run:async()=>{}})})})},
    '../../../lib/portal-pin-password':{derivePortalPassword:()=> 'fixture-only'},
    '../../../supabase-config':{getPublicSupabaseConfig:()=>({url:'https://example.test',key:'fixture-only'})},
    '../../../supabase-system':{getSupabaseSystemClient:()=>{}},
    '../../../remember-device':remember,
  };
  const exports={};vm.runInNewContext(compiled,{exports,Response,process:{env:{PAYROLL_DEPARTMENT_ID:'verified-department',FIREHOUSE_DATABASE_SECRET:'fixture-only',PORTAL_PIN_PASSWORD_PEPPER:'fixture-only'}},require:n=>{assert.ok(n in modules,n);return modules[n];}});
  return {post:exports.POST,calls,cookies};
}
const req=rememberDevice=>new Request('https://portal.test/api/auth/login',{method:'POST',body:JSON.stringify({email:'member@example.test',pin:'1234',rememberDevice})});
test('login requires explicit true and returns only secure cookies after successful verification',async()=>{
  for(const choice of [undefined,false,'true',true]) {
    const h=harness(),response=await h.post(req(choice));assert.equal(response.status,200);
    const cookie=h.cookies.find(x=>x[0]==='__Secure-firehouse-pin');
    assert.equal(cookie[2].httpOnly,true);assert.equal(cookie[2].secure,true);assert.equal(cookie[2].sameSite,'lax');assert.equal(cookie[2].path,'/');
    assert.equal(h.calls[0].name,choice===true?'verify_portal_pin_with_device':'verify_portal_pin');
    if(choice===true) assert.ok(cookie[2].maxAge>604790 && cookie[2].maxAge<=604800);else assert.equal(cookie[2].maxAge,1800);
    assert.doesNotMatch(JSON.stringify(await response.json()),/unlock_token|rd1_|fixture-only/);
  }
});
test('failed login, failed PIN verification, and unavailable issuer never send authorized cookies',async()=>{
  for(const options of [{loginAllowed:false},{verified:false},{rpcError:{code:'unavailable'}}]) {
    const h=harness(options);assert.ok((await h.post(req(true))).status>=400);assert.equal(h.cookies.length,0);
  }
});
