import assert from 'node:assert/strict';
import test from 'node:test';
import {resolve} from 'node:path';
import {trainingModules} from './helpers/training-modules.mjs';
const root=resolve(import.meta.dirname,'..');
function api({allowed=true}={}){
 const updates=[];
 const db={from(table){let changes;const filters=[];return{update(value){changes=value;return this;},eq(key,value){filters.push([key,value]);return this;},select(){return this;},maybeSingle:async()=>{assert.equal(table,'department_apparatus');assert.ok(filters.some(([key,value])=>key==='department_id'&&value==='verified-dept'));updates.push(changes);return{data:{id:'trailer',status:changes.status}};},insert:async()=>({error:null})};}};
 const route=trainingModules({[resolve(root,'app/lib/supabase-server.ts')]:{createInventorySupabaseClient:async()=>db},[resolve(root,'app/lib/inventory-session.ts')]:{verifyInventoryRequest:async()=>({ok:true,context:{department:{id:'verified-dept'},user:{id:'actor',email:'fixture@example.test'}}}),sameOriginInventoryRequest:()=>true,canMutateInventory:()=>allowed}})('app/api/digital-twin/route.ts');
 return{updates,post:status=>route.POST(new Request('https://fixture.test/api/digital-twin',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'update_apparatus_status',apparatusId:'trailer',status,departmentId:'forged'})}))};
}
test('actual Fleet API accepts all three requested trailer statuses with existing setup authorization',async()=>{
 for(const status of ['in_service','out_of_service','deployed']){const h=api();assert.equal((await h.post(status)).status,200);assert.equal(h.updates[0].status,status);}
 const invalid=api();assert.equal((await invalid.post('invented')).status,400);assert.equal(invalid.updates.length,0);
 const denied=api({allowed:false});assert.equal((await denied.post('deployed')).status,403);assert.equal(denied.updates.length,0);
});
