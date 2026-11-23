import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as drug from '../app/inventory-drug-model.ts';
import * as recurrence from '../app/inventory-check-recurrence.ts';
import * as index from '../app/inventory-index.ts';
import {serviceScheduleInput} from '../app/inventory-service-schedule.ts';
import {airAssetInput,airSaveError} from '../app/inventory-air-input.ts';
import {privatePacketResponse} from '../app/lib/private-packet-response.ts';
const code=ts.transpileModule(readFileSync('app/api/operations/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(options={}){
 const rows=[{id:'box',department_id:'dept',apparatus_id:'rig',compartment_id:'place',item_type:'toolbox',name:'Box',retired_at:null,updated_at:'v1'},{id:'tool',department_id:'dept',apparatus_id:'rig',compartment_id:'place',parent_equipment_id:null,item_type:'individual',name:'Hammer',quantity_required:1,retired_at:null,updated_at:'v1',service_notes:'Keep service notes',check_types:['inventory'],serial_number:'Keep serial'}];
 const queries=[],history=[{equipment_id:'tool',equipment_name:'Original hammer',result:'pass'}];
 const db={from(table){const query={table,filters:[],changes:null};queries.push(query);const builder={select(){return builder;},eq(k,v){query.filters.push([k,v]);return builder;},is(k,v){return builder.eq(k,v);},update(changes){query.changes=changes;return builder;},async insert(record){rows.push(record);return {error:null};},async maybeSingle(){assert.ok(query.filters.some(([k,v])=>k==='department_id'&&v==='dept'),'every lookup/write is department scoped');const row=table==='inventory_compartments'?{id:'place',apparatus_id:'rig'}:rows.find(r=>query.filters.every(([k,v])=>r[k]===v));if(!row)return {data:null};if(query.changes){if(options.race)return {data:null};if(options.fail)return {error:Error('Fixture write failure')};Object.assign(row,query.changes);}return {data:structuredClone(row)};}};return builder;}};
 const imports={'../../inventory-drug-model':drug,'../../inventory-check-recurrence':recurrence,'../../inventory-index':index,'../../lib/private-packet-response':{privatePacketResponse},'../../inventory-service-schedule':{serviceScheduleInput},'../../inventory-air-input':{airAssetInput,airSaveError},'../../lib/supabase-server':{createInventorySupabaseClient:async()=>db},'../../lib/inventory-session':{verifyInventoryRequest:async()=>({ok:true,context:{department:{id:'dept'},user:{id:'user',email:'fixture@example.test'}}}),sameOriginInventoryRequest:()=>!options.foreignOrigin,canMutateInventory:(_c,p)=>{assert.equal(p,'inventory.setup.manage');return !options.member;},sessionFailureResponse:()=>Response.json({}, {status:401})}};
 const exports={};new Function('require','exports',code)(n=>{assert.ok(n in imports,n);return imports[n];},exports);
 return {rows,queries,history,post:body=>exports.POST(new Request('https://fixture.test/api/operations',{method:'POST',body:JSON.stringify(body),headers:{'content-type':'application/json'}}))};
}
const request=(operation,version='v1',extra={})=>({action:'manage_container_item',containerId:'box',equipmentId:'tool',operation,expectedUpdatedAt:version,...extra});
test('container add, edit and removal preserve IDs, service fields, location and saved check history',async()=>{
 const f=fixture(),before=structuredClone(f.history);
 assert.equal((await f.post(request('add'))).status,200);
 const tool=f.rows[1];assert.equal(tool.parent_equipment_id,'box');
 assert.equal((await f.post(request('edit',tool.updated_at,{name:'Claw hammer',quantityRequired:2}))).status,200);
 assert.equal(tool.name,'Claw hammer');assert.equal(tool.quantity_required,2);assert.equal(tool.serial_number,'Keep serial');assert.equal(tool.service_notes,'Keep service notes');
 assert.equal((await f.post(request('remove',tool.updated_at))).status,200);assert.equal(tool.parent_equipment_id,null);assert.equal(tool.compartment_id,'place');assert.deepEqual(f.history,before);assert.ok(f.queries.every(q=>!q.table.includes('check')));
});
test('container controls reject stale, foreign, nested, unassigned and denied changes without modifying equipment',async()=>{
 for(const option of [{member:true},{foreignOrigin:true}]){const f=fixture(option);assert.equal((await f.post(request('add'))).status,403);assert.equal(f.queries.length,0);}
 for(const mutate of [f=>f.rows[1].department_id='other',f=>f.rows[0].department_id='other']){const f=fixture();mutate(f);assert.equal((await f.post(request('add'))).status,404);}
 for(const mutate of [f=>f.rows[1].compartment_id='other',f=>f.rows[1].item_type='toolbox',f=>f.rows[0].item_type='individual']){const f=fixture();mutate(f);assert.equal((await f.post(request('add'))).status,400);}
 const f=fixture();assert.equal((await f.post(request('add','stale'))).status,409);assert.equal((await f.post(request('remove'))).status,409);assert.equal(f.rows[1].parent_equipment_id,null);
 for(const option of [{race:true},{fail:true}]){const f=fixture(option);assert.equal((await f.post(request('add'))).status,option.race?409:503);assert.equal(f.rows[1].parent_equipment_id,null);}
});
test('new contained items are created with a validated parent in their saved compartment',async()=>{
 const f=fixture(),body={action:'create_equipment',compartmentId:'place',name:'New tool',parentEquipmentId:'box',itemType:'individual',checkTypes:['inventory']};
 assert.equal((await f.post(body)).status,201);assert.equal(f.rows.at(-1).parent_equipment_id,'box');
 const invalid=fixture();invalid.rows[0].compartment_id='other';assert.equal((await invalid.post(body)).status,400);assert.equal(invalid.rows.length,2);
});
