import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const routeSource = readFileSync(new URL("../app/api/auth/pin/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(routeSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

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
  };
  const exports={};
  runInNewContext(compiled,{exports,require:(name)=>{assert.ok(name in modules, name);return modules[name];},Response,Buffer,console:{error:(...args)=>logs.push(args)}});
  return {patch:exports.PATCH,calls,logs,cookieWrites};
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
  const opener=source.slice(source.indexOf("async function openInventory()"),source.indexOf("function navigate(page:"));
  assert.doesNotMatch(opener,/setError\(/);assert.match(opener,/setInventoryError/);
  assert.match(source,/inventoryError &&[\s\S]*?onClick=\{\(\) => void openInventory\(\)\}/);
  assert.match(source,/function navigate\(page: NavItem\) \{\s*setInventoryError\(""\)/);
});
