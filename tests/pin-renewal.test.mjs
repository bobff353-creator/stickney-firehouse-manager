import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const routeSource = readFileSync(new URL("../app/api/auth/pin/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(routeSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const rememberCode = ts.transpileModule(readFileSync(new URL('../app/remember-device.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const remember = await import(`data:text/javascript;base64,${Buffer.from(rememberCode).toString('base64')}`);

function harness({ token="test-unlock-token", user={id:"verified-user"}, authError=null, data=true, rpcError=null, networkThrows=false }={}) {
  const calls=[], logs=[], cookieWrites=[];
  const modules={
    "next/server": { NextResponse: { json(body,init) { const response=Response.json(body,init); response.cookies={set:(...args)=>cookieWrites.push(args)}; return response; } } },
    "next/headers": { cookies:async()=>({get:()=>token?{value:token}:undefined}) },
    "node:crypto": require("node:crypto"),
    "../../../../db/bootstrap": {},
    "../../../../db/postgres-adapter": {},
    "../../../lib/portal-pin-password": {},
    "../../../supabase-server": { getSupabaseServerClient:async()=>({auth:{getUser:async()=>({data:{user},error:authError})},rpc:async(name,args)=>{calls.push({name,args});if(networkThrows)throw new Error("network");return {data,error:rpcError};}}) },
    "../../../supabase-system": { getSupabaseSystemClient:()=>{throw new Error("Public client must not renew unlocks");} },
    "../../../remember-device": remember,
  };
  const exports={};
  runInNewContext(compiled,{exports,require:(name)=>{assert.ok(name in modules, name);return modules[name];},Response,Buffer,process:{env:{PAYROLL_DEPARTMENT_ID:'configured-department'}},console:{error:(...args)=>logs.push(args)}});
  return {patch:exports.PATCH,post:exports.POST,remove:exports.DELETE,calls,logs,cookieWrites};
}

const request=(body={})=>new Request("https://portal.test/api/auth/pin",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(body)});

test("renewal uses the verified member session and never sends caller-supplied identity",async()=>{
  const h=harness();const result=await h.patch(request({p_user_id:"someone-else"}));
  assert.equal(result.status,200);assert.equal(h.calls[0].name,"renew_own_portal_pin_unlock");
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0].args)),{p_unlock_token:"test-unlock-token",p_station_display:false});
  assert.equal(h.cookieWrites[0][2].maxAge,30*60);assert.equal(h.cookieWrites[0][2].httpOnly,true);
});
test("missing unlock cookie and expired sign-in cannot reach renewal",async()=>{
  const missing=harness({token:""});assert.equal((await missing.patch(request())).status,423);assert.equal(missing.calls.length,0);
  const expired=harness({user:null,authError:{message:"expired"}});assert.equal((await expired.patch(request())).status,401);assert.equal(expired.calls.length,0);
});
test("invalid or expired unlock remains locked and no cookie is issued",async()=>{
  const h=harness({data:false});assert.equal((await h.patch(request())).status,423);assert.equal(h.cookieWrites.length,0);
});
test("RPC and network failures fail closed without secret logging",async()=>{
  for(const options of [{rpcError:{code:"42501",message:"sensitive details"}},{networkThrows:true}]){
    const h=harness(options);assert.equal((await h.patch(request())).status,503);assert.equal(h.cookieWrites.length,0);
    assert.doesNotMatch(JSON.stringify(h.logs),/test-unlock-token|secret config details|sensitive details|verified-user/);
  }
});

test("renewal SQL is own-user-only, preserves expiry, and denies anonymous execution",()=>{
  const sql=readFileSync(new URL("../supabase/migrations/20260902143524_renew_own_portal_pin_unlock.sql",import.meta.url),"utf8");
  assert.match(sql,/current_user_id uuid := auth\.uid\(\)/);
  assert.doesNotMatch(sql,/p_user_id/);
  assert.match(sql,/WHERE user_id = current_user_id/);
  assert.match(sql,/unlock_expires_at > now\(\)/);
  assert.match(sql,/membership\.status = 'active'/);
  assert.match(sql,/SET search_path = ''/);
  assert.match(sql,/REVOKE ALL[^;]*FROM PUBLIC, anon/);
  assert.match(sql,/GRANT EXECUTE[^;]*TO authenticated/);
});
test("TV lease retains existing duration only after successful renewal",async()=>{
  const h=harness();assert.equal((await h.patch(request({display:"tv"}))).status,200);
  assert.equal(h.calls[0].args.p_station_display,true);assert.equal(h.cookieWrites[0][2].maxAge,30*24*60*60);
});
test("Inventory errors retry Inventory and cannot pollute the payroll error state",()=>{
  const source=readFileSync(new URL("../app/payroll-app.tsx",import.meta.url),"utf8");
  const opener=source.slice(source.indexOf("async function openInventory("),source.indexOf("function navigate(page:"));
  assert.doesNotMatch(opener,/setError\(/);assert.match(opener,/setInventoryError/);
  assert.match(source,/inventoryError &&[\s\S]*?onClick=\{\(\) => void openInventory\(\)\}/);
  const navigation=source.slice(source.indexOf("function navigate(page:"),source.indexOf("function navigateFromRespond"));
  assert.match(navigation,/setInventoryError\(""\)/);
  assert.match(navigation,/if \(!confirmLeavingWork\(\)\) return/);
});

const deviceToken='rd1_'+'b'.repeat(64);
test('remembered renewal is read-only, absolute, and cannot become a TV lease',async()=>{
  for(const display of ['portal','tv']) {
    const h=harness({token:deviceToken,data:{rememberedUntil:'2026-09-19T12:00:00Z',serverNow:'2026-09-19T11:55:00Z'}});
    const result=await h.patch(request({display})); assert.equal(result.status,200);
    assert.equal(h.calls[0].name,'portal_remembered_device_status'); assert.equal(h.calls.length,1);
    assert.equal(h.cookieWrites[0][2].maxAge,300);
    assert.equal((await result.json()).rememberedUntil,'2026-09-19T12:00:00Z');
  }
});
test('invalid, expired, missing, and failed remembered status never renew a cookie',async()=>{
  for(const data of [null,{}, {rememberedUntil:'bad',serverNow:'bad'},
    {rememberedUntil:'2026-09-12T12:00:00Z',serverNow:'2026-09-12T12:00:01Z'},
    {rememberedUntil:'2026-10-12T12:00:00Z',serverNow:'2026-09-12T12:00:00Z'}]) {
    const h=harness({token:deviceToken,data}); assert.equal((await h.patch(request())).status,423); assert.equal(h.cookieWrites.length,0);
  }
  for(const options of [{rpcError:{code:'error'}},{networkThrows:true}]) {
    const h=harness({token:deviceToken,...options}); assert.equal((await h.patch(request())).status,503); assert.equal(h.cookieWrites.length,0);
  }
});
test('only explicit opt-in and freshly verified PIN issue a remembered cookie',async()=>{
  const deadline=new Date(Date.now()+remember.rememberedDeviceSeconds*1000).toISOString();
  const user={id:'verified-user',user_metadata:{portal_pin_password_version:1}};
  for(const choice of [false,undefined,'true',true]) {
    const h=harness({user,data:[{ok:true,unlock_token:choice===true?deviceToken:'legacy-token',remembered_until:deadline}]});
    assert.equal((await h.post(request({action:'verify',pin:'1234',rememberDevice:choice,p_user_id:'attacker'}))).status,200);
    assert.equal(h.calls[0].name,choice===true?'verify_portal_pin_with_device':'verify_portal_pin');
    assert.equal(h.calls[0].args.p_user_id,undefined);
    if(choice===true) {assert.equal(h.calls[0].args.p_department_id,'configured-department');assert.ok(h.cookieWrites[0][2].maxAge>604790);}
    else assert.equal(h.cookieWrites[0][2].maxAge,1800);
  }
  for(const data of [[{ok:false}],[{ok:true,unlock_token:'legacy-token',remembered_until:deadline}]]) {
    const h=harness({user,data});assert.ok((await h.post(request({action:'verify',pin:'1234',rememberDevice:true}))).status>=400);assert.equal(h.cookieWrites.length,0);
  }
});
test('forget uses only the current cookie/session; even failure clears the browser cookie',async()=>{
  for(const options of [{},{rpcError:{code:'unavailable'}},{networkThrows:true}]) {
    const h=harness({token:deviceToken,...options}); const response=await h.remove();
    assert.equal(response.status,Object.keys(options).length?503:200);
    assert.equal(h.calls[0].name,'forget_own_portal_device');assert.deepEqual(Object.keys(h.calls[0].args),['p_unlock_token']);
    assert.equal(h.cookieWrites[0][1],'');assert.equal(h.cookieWrites[0][2].maxAge,0);
  }
});
