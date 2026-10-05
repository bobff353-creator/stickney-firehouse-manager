import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { randomUUID } from 'node:crypto';
import * as index from '../app/inventory-index.ts';
import { airAssetInput,airSaveError } from '../app/inventory-air-input.ts';
import { serviceScheduleInput } from '../app/inventory-service-schedule.ts';
import { privatePacketResponse } from '../app/lib/private-packet-response.ts';
const compiled=ts.transpileModule(fs.readFileSync(new URL('../app/api/operations/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness(options={}){
 const state={rpc:[],permission:[]};
 const imports={'../../inventory-index':index,'../../inventory-air-input':{airAssetInput,airSaveError},'../../inventory-service-schedule':{serviceScheduleInput},'../../lib/private-packet-response':{privatePacketResponse},'../../lib/supabase-server':{createInventorySupabaseClient:async()=>({from(){throw Error('Atomic actions must not issue partial table writes');},rpc:async(name,args)=>{state.rpc.push({name,args});return options.error?{error:options.error}:{data:options.missing?{}:{requestId:args.p_request_id,quantityOnHand:4}};}})},'../../lib/inventory-session':{verifyInventoryRequest:async()=>options.anonymous?{ok:false,status:401}:{ok:true,context:{department:{id:'verified-department'},user:{id:'verified-actor',email:'preview-only@example.test'}}},sessionFailureResponse:r=>Response.json({}, {status:r.status}),sameOriginInventoryRequest:()=>!options.crossOrigin,canMutateInventory:(_context,permission)=>{state.permission.push(permission);return !options.denied;}}};
 const exports={};new Function('require','exports',compiled)(name=>{assert.ok(imports[name],name);return imports[name];},exports);
 return{state,post:body=>exports.POST(new Request('https://preview-only.test/api/operations',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}))};
}
test('actual API uses one caller RPC for each atomic action and forces verified department',async()=>{
 for(const action of ['adjust_stock','create_notice','create_work_order','close_work_order','update_work_order_status','create_stock_item','request_restock','approve_restock','fulfill_restock','create_stock_lot']){
  const h=harness();const id=randomUUID();const response=await h.post({action,operationId:id,departmentId:'forged-department',reason:'Preview only',assignedEmployeeIds:[],assignedEmployeeNames:[]});
  assert.equal(response.status,action.startsWith('create_')?201:200);assert.equal(h.state.rpc.length,1);
  assert.equal(h.state.rpc[0].name,'inventory_apply_operation');assert.equal(h.state.rpc[0].args.p_department_id,'verified-department');assert.equal(h.state.rpc[0].args.p_request_id,id);assert.equal(h.state.rpc[0].args.p_input.operationId,undefined);
  assert.deepEqual(h.state.permission,[['adjust_stock','request_restock'].includes(action)?'inventory.check':['create_stock_item','approve_restock','fulfill_restock','create_stock_lot'].includes(action)?'inventory.setup.manage':'inventory.repairs.manage']);
 }
});
test('actual API denies unauthorized, foreign-origin and missing-reference saves before database mutations',async()=>{
 for(const [options,status] of [[{anonymous:true},401],[{denied:true},403],[{crossOrigin:true},403]]){const h=harness(options);assert.equal((await h.post({action:'adjust_stock',operationId:randomUUID()})).status,status);assert.equal(h.state.rpc.length,0);}
 const h=harness();assert.equal((await h.post({action:'adjust_stock'})).status,400);assert.equal(h.state.rpc.length,0);
});
test('actual API distinguishes validation, stale, denied and unconfirmed saves and never confirms a missing receipt',async()=>{
 for(const [code,status] of [['22023',400],['22P02',400],['40001',409],['P0002',404],['42501',403],['XX000',503]]){const h=harness({error:{code,message:'Preview failure'}});const response=await h.post({action:'adjust_stock',operationId:randomUUID()});assert.equal(response.status,status);assert.match(response.headers.get('cache-control'),/private/);}
 const h=harness({missing:true});assert.equal((await h.post({action:'adjust_stock',operationId:randomUUID()})).status,503);
});
