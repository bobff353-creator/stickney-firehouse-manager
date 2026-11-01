import assert from 'node:assert/strict';
import test from 'node:test';
import {resolve} from 'node:path';
import {trainingModules} from './helpers/training-modules.mjs';
const root=resolve(import.meta.dirname,'..'),id='00000000-0000-4000-8000-000000000001';
function api(options={}){
 const calls=[];
 const route=trainingModules({[resolve(root,'app/lib/supabase-server.ts')]:{createInventorySupabaseClient:async()=>({rpc:async(name,args)=>{calls.push({name,args});return options.code?{error:{code:options.code,message:'Fixture conflict'}}:{data:options.missing?{}:{saved:true,checkItems:[{id}]}};}})},[resolve(root,'app/lib/inventory-session.ts')]:{verifyInventoryRequest:async()=>options.anonymous?{ok:false,status:401}:{ok:true,context:{department:{id:'verified-department'},user:{id:'verified-user'}}},sessionFailureResponse:()=>Response.json({}, {status:401}),sameOriginInventoryRequest:()=>!options.crossOrigin,canMutateInventory:(_context,p)=>{assert.equal(p,'inventory.check');return !options.denied;}}})('app/api/operations/drugs/route.ts');
 return{calls,post:body=>route.POST(new Request('https://fixture.test/api/operations/drugs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}))};
}
const body=()=>({id,version:0,complete:false,response:{condition:'',count:'',expirations:[],locations:[],value:'',notes:''},departmentId:'forged',schema:{mode:'forged'}});
test('drug API forces the verified department and sends the original response through a versioned atomic save',async()=>{
 const h=api();const input=body();input.response.extra='must reach database validation';assert.equal((await h.post(input)).status,200);assert.equal(h.calls[0].name,'inventory_save_drug_atomic');assert.equal(h.calls[0].args.p_department_id,'verified-department');assert.equal(JSON.parse(h.calls[0].args.p_response).extra,input.response.extra);assert.equal(h.calls[0].args.p_schema,undefined);
});
test('unauthorized, cross-origin, malformed and stale drug saves do not become successful receipts',async()=>{
 for(const [options,status] of [[{anonymous:true},401],[{denied:true},403],[{crossOrigin:true},403]]){const h=api(options);assert.equal((await h.post(body())).status,status);assert.equal(h.calls.length,0);}
 for(const patch of [{id:'bad'},{version:-1},{complete:'yes'},{response:[]},{photoId:'foreign-invalid'}]){const h=api();assert.equal((await h.post({...body(),...patch})).status,400);assert.equal(h.calls.length,0);}
 for(const [options,status] of [[{code:'40001'},409],[{code:'42501'},403],[{code:'P0001'},400],[{missing:true},503]])assert.equal((await api(options).post(body())).status,status);
});
