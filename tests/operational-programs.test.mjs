import test from 'node:test';import assert from 'node:assert/strict';import {resolve} from 'node:path';import {readFileSync} from 'node:fs';
import {trainingModules} from './helpers/training-modules.mjs';import {trainingHarness} from './helpers/training-harness.mjs';
const model=trainingModules()('app/operational-program-model.ts');
const data=patch=>model.normalizeProgram({...model.blankProgram(),title:'Preview-only work',date:'2026-10-14',...patch});
const source={id:'hydrant-one',name:'Preview hydrant',status:'in_service',flushes:[{id:'flush-one',date:'2026-10-13'}]};
const pending={hydrantId:source.id,work:'inspection',result:'pending',completedDate:'',notes:'',flushId:''};
test('hydrant work requires real source IDs, distinct work items and saved flushing evidence',()=>{
  const d=data({items:[pending]});model.validateProgram('hydrants',d,[source],[]);
  assert.throws(()=>model.validateProgram('hydrants',d,[],[]),/unavailable/);
  assert.throws(()=>model.validateProgram('hydrants',{...d,items:[pending,pending]},[source],[]),/once/);
  assert.throws(()=>model.validateProgram('hydrants',{...d,status:'completed'},[source],[]),/Complete all/);
  const flush={...pending,work:'flushing',result:'completed',completedDate:'2026-10-13',notes:'Recorded clear water',flushId:'fake'};
  assert.throws(()=>model.validateProgram('hydrants',{...d,date:'2026-10-13',items:[flush]},[source],[]),/saved flushing/);flush.flushId='flush-one';model.validateProgram('hydrants',{...d,date:'2026-10-13',items:[flush]},[source],[]);
  assert.throws(()=>model.validateProgram('hydrants',{...d,items:[flush]},[source],[]),/on or after/);
  assert.throws(()=>model.validateProgram('hydrants',{...d,items:[]},[source],[],d),/at least|removed/);
  assert.throws(()=>model.validateProgram('hydrants',d,[{...source,status:'archived'}],[]),/Archived/);
  model.validateProgram('hydrants',d,[{...source,status:'archived'}],[],d);
});
test('outreach rejects missing counts, invented members and impossible dates while preserving real zero',()=>{
  const d=data({audience:'Preview audience',location:'Preview location',status:'completed'});
  assert.throws(()=>model.validateProgram('outreach',d,[],[]),/recorded attendance/);
  model.validateProgram('outreach',{...d,attendees:0,staffHours:0},[],[]);
  assert.throws(()=>model.validateProgram('outreach',{...d,date:'2026-02-30'},[],[]),/valid/);
  assert.throws(()=>model.validateProgram('outreach',{...d,ownerId:'invented'},[],[]),/saved department member/);
  assert.throws(()=>data({attendees:-1}),/nonnegative/);assert.throws(()=>data({attendees:1.5}),/nonnegative/);
});
test('replacement reports preserve unknown costs and require equipment and quote evidence',()=>{
  const d=data({equipmentId:'equipment-one',reason:'Recorded condition'}),sources=[{id:'equipment-one',name:'Preview equipment'}];model.validateProgram('replacement',d,sources,[]);
  assert.throws(()=>model.validateProgram('replacement',{...d,estimateCents:100},sources,[]),/source of entered costs/);
  assert.throws(()=>model.validateProgram('replacement',{...d,status:'completed'},sources,[]),/actual cost/);
  assert.throws(()=>model.validateProgram('replacement',{...d,equipmentId:'other'},[...sources,{id:'other'}],[],d),/retain/);
  const record={id:'record-one',version:1,kind:'replacement',data:{...d,title:'=Preview'},updatedAt:'',updatedBy:''};const csv=model.programCsv('replacement',[record],sources,'2026-10-14T00:00Z');assert.match(csv,/'=Preview/);assert.ok(!csv.includes('"0.00"'));assert.ok(csv.includes('blank means unknown'));
});
test('program API creates audited records atomically, retries without duplicates, denies tenants and stale saves',async()=>{
  const h=await trainingHarness();try{
    await h.pg.exec("CREATE SCHEMA private;CREATE TABLE private.department_portals(schema_name name);"+readFileSync('supabase/migrations/20261014144445_operational_programs.sql','utf8')+"CREATE TABLE employees(id text primary key,name text,active int);CREATE TABLE field_hydrants(id text,hydrant_number text,address text,service_status text);CREATE TABLE field_hydrant_flushes(id text,hydrant_id text,flushed_at text);INSERT INTO employees VALUES('member-one','Preview member',1);INSERT INTO field_hydrants VALUES('hydrant-one','Preview','Preview address','in_service');");
    let allowed=true;const load=trainingModules({[resolve('db/bootstrap.ts')]:{ensureDatabase:async()=>h.db},[resolve('app/department-portal.ts')]:{getPortalDepartment:async()=>({id:'11111111-1111-1111-1111-111111111111'})},[resolve('app/server-permissions.ts')]:{permissionsForEmail:async()=>new Set(allowed?['dashboard.view','field_preplans.view','field_preplans.edit','command_center.view','incident_command.manage']:[])},[resolve('app/lib/inventory-session.ts')]:{verifyInventoryRequest:async()=>({ok:false})},[resolve('app/lib/supabase-server.ts')]:{createInventorySupabaseClient:async()=>{throw Error('Denied')}}});const api=load('app/api/operational-programs/route.ts');
    const headers={'origin':'http://localhost','oai-authenticated-user-email':'preview@example.invalid','x-department-id':'11111111-1111-1111-1111-111111111111','content-type':'application/json'};
    const post=(body,extra={})=>api.POST(new Request('http://localhost/api/operational-programs',{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)}));
    const body={id:'program-one',kind:'hydrants',version:0,data:data({ownerId:'member-one',items:[pending]})};
    assert.equal((await post(body,{'x-department-id':'22222222-2222-2222-2222-222222222222'})).status,403);allowed=false;assert.equal((await post(body)).status,403);allowed=true;
    const created=await post(body);assert.equal(created.status,201);assert.equal((await created.json()).record.version,1);assert.equal((await post(body)).status,200);
    assert.equal((await h.pg.query('SELECT * FROM operational_program_audit')).rows.length,1);
    assert.equal((await post({...body,data:{...body.data,title:'Changed'},version:0})).status,409);
    h.stats.failBatchAt=1;assert.equal((await post({...body,data:{...body.data,title:'Transaction failure'},version:1})).status,503);assert.equal((await h.pg.query('SELECT payload FROM operational_program_records')).rows[0].payload,JSON.stringify(body.data));
    const updated=await post({...body,data:{...body.data,title:'Saved change'},version:1});assert.equal(updated.status,200);assert.equal((await updated.json()).record.version,2);
    const packet=await(await api.GET(new Request('http://localhost/api/operational-programs?kind=hydrants',{headers}))).json();assert.equal(packet.records.length,1);assert.equal(packet.sources.length,1);
    const history=await(await api.GET(new Request('http://localhost/api/operational-programs?kind=hydrants&history=program-one',{headers}))).json();assert.deepEqual(history.history.map(r=>r.version),[2,1]);
    await h.pg.exec("CREATE FUNCTION employee_id_for_login(text) RETURNS text LANGUAGE sql AS $$ SELECT 'member-one'::text $$;");
    const queue=load('app/api/task-queue/route.ts');const queued=await(await queue.GET(new Request('http://localhost/api/task-queue',{headers}))).json();assert.equal(queued.items.length,1);assert.deepEqual(queued.items[0].assignedIds,['member-one']);assert.ok(queued.items[0].href.includes('programRecord=program-one'));
    const deniedInventory=await api.GET(new Request('http://localhost/api/operational-programs?kind=replacement',{headers}));assert.equal(deniedInventory.status,403);
    await h.pg.exec('SET ROLE anon');await assert.rejects(()=>h.pg.query('SELECT * FROM firehouse.operational_program_records'),/permission denied/);await h.pg.exec('RESET ROLE');
  }finally{await h.close();}
});
