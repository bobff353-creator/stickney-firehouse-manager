// Exercise the actual route handler, replacing only authentication and the database transport.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { serviceScheduleInput } from '../app/inventory-service-schedule.ts';
import { airAssetInput, airSaveError } from '../app/inventory-air-input.ts';
const compiled=ts.transpileModule(fs.readFileSync(new URL('../app/api/operations/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness(options={}){
 const state={row:{id:'item',department_id:'dept',apparatus_id:'rig',compartment_id:'place',name:'Spreaders',updated_at:'2026-01-01T00:00:00Z'},queries:[],rpc:[],updates:0};
 const db={from(table){
  const query={table,filters:[],changes:null};state.queries.push(query);
  const builder={select(columns){query.columns=columns;return builder;},eq(key,val){query.filters.push([key,val]);return builder;},is(key,val){return builder.eq(key,val);},update(changes){query.changes=changes;return builder;},async maybeSingle(){
   assert.ok(query.filters.some(([key,value])=>key==='department_id'&&value==='dept'),'department filter is mandatory');
   if(query.changes){state.updates++;if(options.fail)return{error:new Error('database unavailable')};if(options.race||options.denied)return{data:null};Object.assign(state.row,query.changes);return{data:{id:'item'}};}
   return{data:table==='inventory_equipment'?structuredClone(state.row):{id:'place',apparatus_id:'rig'}};
  }};return builder;
 },async rpc(name,args){state.rpc.push({name,args});return {data:{id:args.p_id,changed:true}};}};
 const session={ok:true,context:{department:{id:'dept'},user:{id:'user',email:'fixture@example.test'}}};
 const imports={
  '../../lib/supabase-server':{createInventorySupabaseClient:async()=>db},
  '../../inventory-air-input':{airAssetInput,airSaveError},
  '../../inventory-service-schedule':{serviceScheduleInput},
  '../../lib/inventory-session':{verifyInventoryRequest:async()=>session,sameOriginInventoryRequest:()=>!options.crossOrigin,canMutateInventory:(_ctx,p)=>{assert.equal(p,'inventory.setup.manage');return !options.member;},sessionFailureResponse:()=>Response.json({error:'No session'},{status:401})}
 };
 const exports={};new Function('require','exports',compiled)(name=>{if(!imports[name])throw Error(`Unexpected import ${name}`);return imports[name];},exports);
 return{state,post:body=>exports.POST(new Request('https://fixture.test/api/operations',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}))};
}
const body=(changes={})=>({action:'update_equipment',equipmentId:'item',compartmentId:'place',name:'Spreaders',equipmentCategory:'equipment',itemType:'individual',checkTypes:['inventory'],serviceStatus:'in_service',expectedUpdatedAt:'2026-01-01T00:00:00Z',serviceSchedule:{last_serviced_date:'2025-01-31',service_interval_months:18,service_reminder_months:4},...changes});
test('actual generic API writes service fields and asset together and confirms returned row',async()=>{
 const h=harness();const response=await h.post(body());assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private, no-store/);
 assert.equal(h.state.updates,1);assert.equal(h.state.row.last_serviced_date,'2025-01-31');assert.equal(h.state.row.service_interval_months,18);assert.equal(h.state.row.service_reminder_months,4);
 const saved=await response.json();assert.equal(saved.equipment.id,'item');
 const again=await h.post(body({expectedUpdatedAt:h.state.row.updated_at}));assert.equal((await again.json()).changed,false);assert.equal(h.state.updates,1);
});
test('failed, raced or denied writes are never reported saved by actual API',async()=>{
 for(const options of [{fail:true},{race:true},{denied:true}]){const h=harness(options);const response=await h.post(body());assert.equal(response.status,options.fail?503:409);assert.equal(h.state.row.last_serviced_date,undefined);}
});
test('actual API enforces setup permission, origin and stale version before a write',async()=>{
 for(const options of [{member:true},{crossOrigin:true}]){const h=harness(options);assert.equal((await h.post(body())).status,403);assert.equal(h.state.queries.length,0);}
 const h=harness();assert.equal((await h.post(body({expectedUpdatedAt:'old'}))).status,409);assert.equal(h.state.updates,0);
});
test('actual API rejects invalid schedule without changing other asset fields',async()=>{
 for(const schedule of [{last_serviced_date:'2099-01-01'}, {last_serviced_date:'2025-01-31',service_interval_months:12,service_reminder_months:12},'not an object']){const h=harness();assert.equal((await h.post(body({name:'Must not save',serviceSchedule:schedule}))).status,400);assert.equal(h.state.updates,0);assert.equal(h.state.row.name,'Spreaders');}
});
test('actual air API sends the validated schedule through one tenant-scoped atomic RPC',async()=>{
 const h=harness();const response=await h.post({action:'save_air_asset',id:'air-item',asset:{scba_asset_kind:'pack',asset_number:'PACK-1',name:'Pack',compartment_id:'place',...body().serviceSchedule}});assert.equal(response.status,200);assert.equal(h.state.rpc.length,1);assert.equal(h.state.rpc[0].name,'inventory_save_air_asset');assert.equal(h.state.rpc[0].args.p_department,'dept');assert.equal(h.state.rpc[0].args.p_asset.service_interval_months,18);
});
