import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { assetAttention } from '../app/inventory-asset-attention.ts';
import { operationsReadiness } from '../app/operations-readiness.ts';
import { stockAttention, stockGroups } from '../app/inventory-workspace-filters.ts';
import { createInventorySaveReferences } from '../app/inventory-save-reference.ts';
import { privatePacketResponse } from '../app/lib/private-packet-response.ts';
import * as board from '../app/board-configuration.ts';
const now=Date.parse('2026-10-05T15:00:00Z');
test('assets combine saved service, hydro and expiration dates; missing dates never clear readiness',()=>{
 const attention=assetAttention({service_status:'out_of_service',expiration_date:'2026-10-04',scba_asset_kind:'bottle',hydro_due_date:null,last_serviced_date:'2025-10-05',service_interval_months:12,service_reminder_months:1},now);
 assert.deepEqual(attention.map(item=>item.kind),['status','expiration','hydro','service']);
 assert.equal(attention.find(item=>item.kind==='hydro').severity,'unknown');
 assert.equal(assetAttention({expiration_date:'2026-02-30'},now)[0].severity,'unknown');
 assert.equal(assetAttention({service_interval_months:12},now)[0].severity,'unknown');
 assert.deepEqual(assetAttention({retired_at:'2026-01-01',expiration_date:'2025-01-01'},now),[]);
 assert.equal(assetAttention({expiration_date:'2026-11-04'},now)[0].severity,'warning');
 assert.equal(assetAttention({expiration_date:'2026-10-04'},Date.parse('2026-10-05T04:59:00Z'))[0].label,'Expiration due today');
});
test('stock preserves physical lots while excluding expired and unknown tracked dates from reorder counts',()=>{
 const rows=stockGroups([{id:'preview',expiration_tracked:true,reorder_point:3,lot_id:'old',quantity_on_hand:4,expires_at:'2026-10-04'},{id:'preview',expiration_tracked:true,reorder_point:3,lot_id:'unknown',quantity_on_hand:2,expires_at:null},{id:'preview',expiration_tracked:true,reorder_point:3,lot_id:'valid',quantity_on_hand:3,expires_at:'2026-10-05'}]);
 const state=stockAttention(rows[0],now);assert.equal(rows[0].total,9);assert.equal(state.usable,3);assert.equal(state.low,true);assert.equal(state.unknown.length,1);
 assert.equal(stockAttention(stockGroups([{id:'untracked',lot_id:'one',quantity_on_hand:10,expiration_tracked:false}])[0],now).usable,10);
});
test('operations totals count assets and supplies once and retain separate unknown dates',()=>{
 const data={equipment:[{service_status:'in_repair',expiration_date:'2026-10-04'},{scba_asset_kind:'bottle'},{retired_at:'2026-01-01'}],workOrders:[{status:'new',priority:'high'},{status:'closed',priority:'critical'},{status:'cancelled'}],checks:[{status:'completed'},{status:'in_progress'}],stock:[]};
 assert.deepEqual(operationsReadiness(data,now),{asOf:new Date(now).toISOString(),assets:2,assetAttention:1,assetUnknown:1,openRepairs:1,highPriorityRepairs:1,inProgressChecks:1,lowStock:0,expiredStock:0,unknownStock:0});
 assert.equal(data.workOrders.length,3);
 assert.equal(operationsReadiness({...data,equipment:[{id:'saved-asset',service_status:'in_service'}],workOrders:[],exceptions:[{equipment_id:'saved-asset',status:'open'}]},now).assetAttention,1);
});
test('save references survive a reload, isolate actors, omit private details and clear only after confirmation',async()=>{
 const rows=new Map();const store={getItem:key=>rows.get(key)||null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key)};
 const payload={action:'adjust_stock',lotId:'preview-lot',delta:1,reason:'Sensitive fixture reason'};
 const first=createInventorySaveReferences(store);const ref=await first.acquire(payload,'preview-only@example.test');
 const reload=createInventorySaveReferences(store);assert.deepEqual(await reload.acquire(payload,'preview-only@example.test'),ref);
 assert.notEqual((await reload.acquire({...payload,delta:2},'preview-only@example.test')).id,ref.id);
 assert.notEqual((await reload.acquire(payload,'different@example.test')).id,ref.id);
 assert.doesNotMatch(JSON.stringify([...rows]),/Sensitive|example\.test|lotId/);
 reload.confirm(ref.key);assert.notEqual((await reload.acquire(payload,'preview-only@example.test')).id,ref.id);
});
test('station templates remain compatible with saved settings and retain deterministic rotation and call sections',()=>{
 const standard=board.defaultBoardConfiguration();assert.deepEqual(board.validateBoardConfiguration(standard),standard);
 const readiness={...standard,template:'readiness'};assert.equal(board.validateBoardConfiguration(readiness).template,'readiness');
 assert.equal(board.boardSlideAt(now,readiness),board.boardSlideAt(now,standard));
 assert.throws(()=>board.validateBoardConfiguration({...standard,template:'invented'}),/template/);
});
const compiled=ts.transpileModule(fs.readFileSync(new URL('../app/api/operations/summary/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness(options={}){
 const state={queries:[]};const records={inventory_equipment:Array.from({length:1005},(_,i)=>({id:String(i),service_status:i===1004?'in_repair':'in_service'})),inventory_work_orders:[{id:'repair',status:'new',priority:'high'}],inventory_checks:[],inventory_readiness_exceptions:[],inventory_stock_items:[{id:'supply',expiration_tracked:true,reorder_point:2}],inventory_stock_lots:[{id:'lot',stock_item_id:'supply',quantity_on_hand:5,expires_at:'2020-01-01'}]};
 const db={from(table){const q={table,filters:[]};state.queries.push(q);const b={select(columns){q.columns=columns;return b;},eq(...filter){q.filters.push(filter);return b;},is(...filter){q.filters.push(filter);return b;},not(...filter){q.filters.push(filter);return b;},neq(...filter){q.filters.push(filter);return b;},order(){return b;},range(from,to){q.range=[from,to];return Promise.resolve(options.fail?{data:null,error:new Error('offline')}:{data:records[table].slice(from,to+1),error:null});}};return b;}};
 const session=options.anonymous?{ok:false,status:401}:{ok:true,context:{department:{id:'verified-department'},grants:options.denied?['daily_log.view']:['operations_board.view']}};
 const imports={'../../../lib/supabase-server':{createInventorySupabaseClient:async()=>db},'../../../lib/inventory-session':{verifyInventoryRequest:async()=>session,sessionFailureResponse:r=>Response.json({}, {status:r.status})},'../../../operations-readiness':{operationsReadiness},'../../../lib/private-packet-response':{privatePacketResponse}};
 const exports={};new Function('require','exports',compiled)(name=>{assert.ok(imports[name],name);return imports[name];},exports);
 return {state,get:()=>exports.GET(new Request('https://preview-only.test/api/operations/summary'))};
}
test('actual station endpoint pages all tenant assets and sends only aggregate readiness fields',async()=>{
 const h=harness();const response=await h.get();assert.equal(response.status,200);const summary=await response.json();assert.equal(summary.assets,1005);assert.equal(summary.assetAttention,1);assert.equal(summary.openRepairs,1);assert.equal(summary.lowStock,1);assert.equal(summary.expiredStock,1);
 assert.ok(h.state.queries.every(q=>q.filters.some(([field,value])=>field==='department_id'&&value==='verified-department')));
 assert.equal(h.state.queries.filter(q=>q.table==='inventory_equipment').length,2);
 assert.doesNotMatch(JSON.stringify(summary),/assigned|summary|cost|name|serial/);
 assert.match(response.headers.get('cache-control'),/private/);
});
test('denied station access reads nothing and transport failure never returns an empty all-clear',async()=>{
 for(const [options,status] of [[{anonymous:true},401],[{denied:true},403]]){const h=harness(options);assert.equal((await h.get()).status,status);assert.equal(h.state.queries.length,0);}
 const h=harness({fail:true});const response=await h.get();assert.equal(response.status,503);assert.equal((await response.json()).assets,undefined);
});
