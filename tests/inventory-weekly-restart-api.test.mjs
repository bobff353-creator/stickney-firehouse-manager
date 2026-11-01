import assert from 'node:assert/strict';
import test from 'node:test';
import {resolve} from 'node:path';
import {trainingModules} from './helpers/training-modules.mjs';
const root=resolve(import.meta.dirname,'..'),id='00000000-0000-4000-8000-000000000001',replacement='00000000-0000-4000-8000-000000000002';
function api(options={}){
 const calls=[];
 const route=trainingModules({[resolve(root,'app/lib/supabase-server.ts')]:{createInventorySupabaseClient:async()=>({rpc:async(name,args)=>{calls.push({name,args});return options.code?{error:{code:options.code,message:'Fixture archive conflict'}}:{data:options.missing?{}:{saved:true,archivedCheckId:id,checkId:replacement}};}})},[resolve(root,'app/lib/inventory-session.ts')]:{verifyInventoryRequest:async()=>options.anonymous?{ok:false,status:401}:{ok:true,context:{department:{id:'verified-department'}}},sessionFailureResponse:()=>Response.json({}, {status:401}),sameOriginInventoryRequest:()=>!options.crossOrigin,canMutateInventory:(_context,p)=>{assert.ok(['inventory.setup.manage','inventory.check'].includes(p));return !(p==='inventory.setup.manage'?options.deniedSetup:options.deniedCheck);}}})('app/api/operations/restart-weekly/route.ts');
 return{calls,post:body=>route.POST(new Request('https://fixture.test/api/operations/restart-weekly',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}))};
}
const body=()=>({id,reason:' Preserve the original and use the mechanical template. ',departmentId:'forged',startedBy:'forged'});
test('restart API requires both permissions, scopes the atomic replacement to the verified department and confirms both record IDs',async()=>{
 const h=api();assert.equal((await h.post(body())).status,200);assert.deepEqual(h.calls,[{name:'inventory_restart_weekly_check',args:{p_department:'verified-department',p_check:id,p_reason:body().reason.trim()}}]);
 for(const [options,status] of [[{anonymous:true},401],[{crossOrigin:true},403],[{deniedSetup:true},403],[{deniedCheck:true},403]]){const denied=api(options);assert.equal((await denied.post(body())).status,status);assert.equal(denied.calls.length,0);}
 for(const change of [{id:'bad'},{reason:''},{reason:'x'.repeat(2001)}]){const h=api();assert.equal((await h.post({...body(),...change})).status,400);assert.equal(h.calls.length,0);}
 for(const [options,status] of [[{code:'42501'},403],[{code:'P0001'},409],[{missing:true},503]])assert.equal((await api(options).post(body())).status,status);
});
