import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {trainingModules} from './helpers/training-modules.mjs';
const load=trainingModules(),model=load('app/fire-inspections/model.ts'),field=load('app/fire-inspections/field-workflow.ts');
const record=(id='fictional-record',version=0)=>({id,kind:'inspection',version,archived:false,data:{...model.emptyInspection(),title:'Fictional property',propertyId:'fictional-property',preplanObservations:{knoxBox:'Test east door',fdc:'Test north wall'}},createdAt:'',updatedAt:'',updatedBy:''});
test('field observations normalize only known, nonempty fields and reset signed review',()=>{
 assert.deepEqual(field.normalizeObservations({knoxBox:' East door ',fdc:' ',unknown:'ignored'}),{knoxBox:'East door'});
 assert.throws(()=>field.normalizeObservations({fdc:44}));assert.throws(()=>field.normalizeObservations({fdc:'x'.repeat(2001)}));
 const r=record();r.data.inspectorAttested=true;assert.equal(model.updateInspectionDetail(r.data,'preplanObservations',{fdc:'New'}).inspectorAttested,false);
 assert.deepEqual(model.normalizeInspection(r.data).preplanObservations,r.data.preplanObservations);
 assert.equal(model.followUpRecord(r,'routine','2027-01-01').data.preplanObservations.knoxBox,undefined);
});
test('property history uses IDs, preserves archives, separates tests and unlinked same-address records',()=>{
 const a={...record('fictional-one'),updatedAt:'2026-01-01',archived:true},b={...record('fictional-two'),updatedAt:'2026-02-01'};b.data.test=true;
 const c=record('fictional-three');c.data.propertyId='';
 assert.deepEqual(field.propertyVisits([a,b,c],'fictional-property').map(r=>r.id),[a.id]);assert.deepEqual(field.propertyVisits([a,b,c],'fictional-property',true).map(r=>r.id),[b.id,a.id]);
});
test('queue survives serialization, replaces its own revision, rejects incompatible versions and retains old entries for review',()=>{
 const rows=field.queueInspection([],record(),'2026-10-05T10:00:00Z'),now=Date.parse('2026-10-05T11:00:00Z');
 assert.equal(field.readFieldQueue(JSON.stringify(rows),now).length,1);assert.equal(field.queueInspection(rows,record()).length,1);
 assert.throws(()=>field.queueInspection(rows,record('fictional-record',1)),/Review/);
 assert.notEqual(field.fieldQueueKey('a'),field.fieldQueueKey('b'));
 assert.equal(field.readFieldQueue(JSON.stringify(rows),now+86400000)[0].state,'conflict');
 assert.deepEqual(field.readFieldQueue('bad'),[]);
});
test('replay removes only confirmed receipts, keeps failures/conflicts and stops on authorization or connection loss',async()=>{
 const rows=field.queueInspection(field.queueInspection([],record()),record('fictional-two'));let saved=0,calls=0;
 let remaining=await field.replayInspections(rows,async r=>({status:200,saved:{...r,version:r.version+1}}),()=>saved++);assert.equal(saved,2);assert.equal(remaining.length,0);
 remaining=await field.replayInspections(rows,async()=>({status:200}),()=>assert.fail());assert.equal(remaining.length,2);
 remaining=await field.replayInspections(rows,async()=>({status:409,error:'newer record'}),()=>assert.fail());assert.equal(remaining[0].state,'conflict');
 await field.replayInspections(remaining,async()=>{calls++;},()=>assert.fail());assert.equal(calls,0);
 remaining=await field.replayInspections(rows,async()=>{calls++;return{status:403};},()=>assert.fail());assert.equal(calls,1);assert.equal(remaining.length,2);
 remaining=await field.replayInspections(rows,async()=>{throw Error('lost');},()=>assert.fail());assert.equal(remaining.length,2);assert.equal(remaining[0].state,'failed');
});
test('hydrant references use valid saved coordinates, stable distance order and no inferred fire flow',()=>{
 const h=[{latitude:41.8,longitude:-87.8,id:'same'},{latitude:41.81,longitude:-87.8,id:'far'},{latitude:0,longitude:0,id:'unset'}];
 assert.deepEqual(field.nearbyHydrants({latitude:41.8,longitude:-87.8},h).map(h=>h.id),['same','far']);assert.equal(field.nearbyHydrants({},h).length,0);assert.equal(field.nearbyHydrants({latitude:41.8,longitude:-87.8},h)[0].distanceFeet,0);
});
async function harness(){
 const pg=new PGlite();await pg.exec(`CREATE SCHEMA firehouse;SET search_path=firehouse;CREATE ROLE anon;CREATE ROLE authenticated;
 CREATE TABLE field_preplans(id text primary key,business_name text,address text,updated_at text,updated_by text,latitude float,longitude float,access_info text,knox_box text,fdc text,alarm_system text,sprinkler_system text);
 CREATE TABLE system_meta(key text primary key,value text,updated_at text);`);
 await pg.exec(readFileSync('supabase/migrations/20260925032225_fire_inspections_private_pilot.sql','utf8').split('CREATE OR REPLACE FUNCTION')[0]);
 await pg.exec(readFileSync('supabase/migrations/20260925104123_inspection_reports_codes_and_evidence.sql','utf8'));
 let permission=true,fail=false;
 const modules=trainingModules({[resolve('app/supabase-server.ts')]:{},[resolve('app/department-portal.ts')]:{getPortalDepartment:async()=>({id:'fixture-department',isolated:false})}});
 const db=modules('db/postgres-adapter.ts').createPostgresD1Adapter(async()=>({rpc:async(name,args)=>{try{const run=async(tx,s)=>{if(fail&&s.sql.includes('INSERT INTO system_meta')){fail=false;throw Error('Injected receipt failure');}const r=await tx.query(s.sql);if(s.requiredChanges!=null&&r.affectedRows!==s.requiredChanges)throw Error('SAVE_CONFLICT');return s.mode==='first'?r.rows[0]??null:s.mode==='all'?r.rows:{success:true};};return{data:name.endsWith('_batch')?await pg.transaction(async tx=>{const r=[];for(const s of args.p_statements)r.push(await run(tx,s));return r;}):await run(pg,{sql:args.p_sql,mode:args.p_mode}),error:null};}catch(e){return{data:null,error:{message:e.message}};}}}));
 const apiLoad=trainingModules({[resolve('db/bootstrap.ts')]:{ensureDatabase:async()=>db},[resolve('app/server-permissions.ts')]:{hasPermission:async()=>permission}}),api=apiLoad('app/api/fire-inspections/preplan/route.ts'),inspection=apiLoad('app/api/fire-inspections/route.ts');
 await pg.query('INSERT INTO field_preplans(id,business_name,address,updated_at,knox_box,fdc,access_info) VALUES($1,$2,$3,$4,$5,$6,$7)',['fictional-property','Fictional property','Test address','baseline','Old Knox','Old FDC','Preserve access']);
 const request=(body,dept='fixture-department',email='bobff353@gmail.com')=>new Request('http://localhost/api/fire-inspections/preplan',{method:'POST',headers:{origin:'http://localhost','x-department-id':dept,'oai-authenticated-user-email':email},body:JSON.stringify(body)});
 const saved=await(await inspection.POST(request(record()))).json();assert.ok(saved.record,saved.error);
 const body={recordId:saved.record.id,version:saved.record.version,fields:['knoxBox'],expectedUpdatedAt:'baseline',expectedValues:{knoxBox:'Old Knox'}};
 return{pg,api,inspection,request,body,saved:saved.record,setPermission(v){permission=v;},fail(){fail=true;},close:()=>pg.close()};
}
test('review updates only selected fields atomically, preserves the inspection and retries without duplication',async()=>{const h=await harness();try{
 let r=await h.api.POST(h.request(h.body));assert.equal(r.status,200,await r.clone().text());const j=await r.json();assert.equal(j.saved,true);
 const plan=(await h.pg.query('select * from field_preplans')).rows[0];assert.equal(plan.knox_box,'Test east door');assert.equal(plan.fdc,'Old FDC');assert.equal(plan.access_info,'Preserve access');
 r=await h.api.POST(h.request(h.body));assert.equal(r.status,200);assert.equal((await r.json()).replayed,true);assert.equal((await h.pg.query('select * from system_meta')).rows.length,1);
 assert.equal((await h.pg.query('select version from fire_inspection_pilot_records')).rows[0].version,1);
 }finally{await h.close();}});
test('review denies missing permission, other account/department, test records and unrecorded fields',async()=>{const h=await harness();try{
 h.setPermission(false);assert.equal((await h.api.POST(h.request(h.body))).status,403);h.setPermission(true);
 assert.equal((await h.api.POST(h.request(h.body,'other'))).status,404);assert.equal((await h.api.POST(h.request(h.body,'fixture-department','other@example.invalid'))).status,403);
 assert.equal((await h.api.POST(h.request({...h.body,fields:['construction']}))).status,400);assert.equal((await h.api.POST(h.request({...h.body,fields:['accessInfo']}))).status,400);
 await h.pg.query("UPDATE fire_inspection_pilot_records SET payload=jsonb_set(payload::jsonb,'{test}','true')::text");assert.equal((await h.api.POST(h.request(h.body))).status,400);
 assert.equal((await h.pg.query('select knox_box from field_preplans')).rows[0].knox_box,'Old Knox');
 }finally{await h.close();}});
test('newer inspection or preplan is protected and a receipt failure rolls back every change',async()=>{const h=await harness();try{
 assert.equal((await h.api.POST(h.request({...h.body,version:0}))).status,409);assert.equal((await h.api.POST(h.request({...h.body,expectedUpdatedAt:'older'}))).status,409);
 await h.pg.query("UPDATE field_preplans SET knox_box='Same-second edit'");assert.equal((await h.api.POST(h.request(h.body))).status,409);await h.pg.query("UPDATE field_preplans SET knox_box='Old Knox'");
 h.fail();assert.equal((await h.api.POST(h.request(h.body))).status,503);assert.equal((await h.pg.query('select knox_box from field_preplans')).rows[0].knox_box,'Old Knox');assert.equal((await h.pg.query('select * from system_meta')).rows.length,0);
 assert.equal((await h.api.POST(h.request(h.body))).status,200);
 }finally{await h.close();}});
