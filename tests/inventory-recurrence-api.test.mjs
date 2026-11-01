import assert from 'node:assert/strict';
import test from 'node:test';
import {resolve} from 'node:path';
import {trainingModules} from './helpers/training-modules.mjs';

const root=resolve(import.meta.dirname,'..');
function api({resumed=false,denied=false}={}) {
 const writes=[],reads=[];
 const db={from(table){
  const filters=[];let inserted;
  const data=()=>{
   if(inserted)return{error:null};
   assert.ok(filters.some(([key,value])=>key==='department_id'&&value==='verified-dept'));
   if(table==='inventory_equipment')return{data:[{id:'ordinary',check_types:['weekly'],weekly_recurrence:'every_week'},{id:'run',check_types:['weekly'],weekly_recurrence:'first_third_saturday'},{id:'daily',check_types:['daily']}]};
   if(table==='inventory_checks')return{data:resumed?{id:'existing'}:null};
   return{data:{id:'rig',status:'in_service'}};
  };
  const builder={select(){return this;},eq(key,value){filters.push([key,value]);reads.push({table,key,value});return this;},is(){return this;},order(){return this;},limit(){return this;},insert(value){inserted=value;writes.push({table,value});return this;},maybeSingle:async()=>data(),then(resolve,reject){return Promise.resolve(data()).then(resolve,reject);}};
  return builder;
 }};
 const route=trainingModules({[resolve(root,'app/lib/supabase-server.ts')]:{createInventorySupabaseClient:async()=>db},[resolve(root,'app/lib/inventory-session.ts')]:{verifyInventoryRequest:async()=>({ok:true,context:{department:{id:'verified-dept'},user:{id:'actor',email:'fixture@example.test'}}}),sameOriginInventoryRequest:()=>true,canMutateInventory:()=>!denied}})('app/api/operations/route.ts');
 return{writes,reads,post:()=>route.POST(new Request('https://fixture.test/api/operations',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'start_check',checkType:'weekly',apparatusId:'rig',departmentId:'forged'})}))};
}
test('actual start API includes the run on first and third Saturdays and excludes it on other weeks',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-11-14T18:00:00Z')});
 for(const [day,expected] of [['2026-11-07',['ordinary','run']],['2026-11-14',['ordinary']],['2026-11-21',['ordinary','run']],['2026-10-31',['ordinary']]]){
  t.mock.timers.setTime(new Date(day+'T18:00:00Z').getTime());const h=api();
  assert.equal((await h.post()).status,201);
  const items=h.writes.find(w=>w.table==='inventory_check_items').value;
  assert.deepEqual(items.map(i=>i.equipment_id),expected);
  assert.ok(items.every(i=>i.department_id==='verified-dept'&&i.result==='pending'));
 }
});
test('resuming a saved check preserves its original item list regardless of the current week',async()=>{
 const h=api({resumed:true});const response=await h.post();assert.equal(response.status,200);assert.deepEqual(await response.json(),{checkId:'existing',resumed:true});assert.equal(h.writes.length,0);
 const denied=api({denied:true});assert.equal((await denied.post()).status,403);assert.equal(denied.reads.length,0);assert.equal(denied.writes.length,0);
});
