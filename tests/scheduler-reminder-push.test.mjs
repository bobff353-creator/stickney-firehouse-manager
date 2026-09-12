import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import ts from 'typescript';
import vm from 'node:vm';

const file = path => readFileSync(new URL(path,import.meta.url),'utf8');
function load(path,mocks={}) { const m={exports:{}}; vm.runInNewContext(ts.transpileModule(file(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:name=>{if(!(name in mocks))throw Error(name);return mocks[name];},Response,Request,process,Buffer,console});return m.exports; }
const {drainSchedulerPush}=load('../app/scheduler-push-delivery.ts');
const department='14a76771-4c24-481b-8def-e6cce005c17b',user='00000000-0000-4000-8000-000000000001';
const migration=file('../supabase/migrations/20260912193252_scheduler_reminder_push.sql');

test('scheduler reminder migration, recipients, due clock and durable worker',async t=>{
 const pg=new PGlite();
 try {
 await pg.exec(`CREATE SCHEMA firehouse; CREATE SCHEMA auth; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,deleted_at timestamptz,banned_until timestamptz);
 CREATE TABLE public.platform_owners(email text PRIMARY KEY);
 CREATE TABLE public.department_memberships(department_id uuid,user_id uuid,status text);
 CREATE TABLE firehouse.employees(id text PRIMARY KEY,active int,pay_scale_id text);
 CREATE TABLE firehouse.employee_profiles(employee_id text PRIMARY KEY,email text,is_admin int,end_date text,single_role int DEFAULT 0,acting_officer_eligible int DEFAULT 0,driver_status text DEFAULT '');
 CREATE TABLE firehouse.pay_scales(id text PRIMARY KEY,label text);
 CREATE TABLE firehouse.rank_permissions(rank text,permission_key text,allowed int,PRIMARY KEY(rank,permission_key));
 CREATE TABLE firehouse.employee_permission_overrides(employee_id text,permission_key text,effect text,PRIMARY KEY(employee_id,permission_key));
 CREATE TABLE firehouse.push_subscriptions(id text PRIMARY KEY,user_id text,department_id text,endpoint text UNIQUE,p256dh text,auth text,active bigint,failure_count bigint DEFAULT 0,last_success_at text,last_error text,updated_at text);
 CREATE TABLE firehouse.station_reminder_rules(id text PRIMARY KEY,type text,offsets text,enabled int,updated_at text,target text DEFAULT '');
 CREATE TABLE firehouse.station_shift_types(id text PRIMARY KEY,start_time text,end_time text,active int);
 CREATE TABLE firehouse.station_schedule_entries(id text PRIMARY KEY,entry_date text,shift_type_id text);
 CREATE TABLE firehouse.station_shift_slots(id text PRIMARY KEY,entry_id text,role text,employee_id text,status text,start_time text DEFAULT '',end_time text DEFAULT '');
 CREATE TABLE firehouse.station_shift_claims(id text PRIMARY KEY,slot_id text,employee_id text,status text);
 CREATE TABLE firehouse.station_availability(employee_id text,availability_date text,status text,all_day int,start_time text,end_time text);
 INSERT INTO auth.users VALUES('${user}','member@fixture.invalid',NULL,NULL);
 INSERT INTO public.department_memberships VALUES('${department}','${user}','active');
 INSERT INTO firehouse.employees VALUES('member',1,'ff');
 INSERT INTO firehouse.employee_profiles(employee_id,email,is_admin) VALUES('member','member@fixture.invalid',0);
 INSERT INTO firehouse.pay_scales VALUES('ff','Firefighter');
 INSERT INTO firehouse.push_subscriptions VALUES('one','${user}','${department}','https://fixture.invalid/push','fixture','fixture',1,0,NULL,'',NULL);
 INSERT INTO firehouse.station_reminder_rules(id,type,offsets,enabled,updated_at) VALUES('open','open_shift_blast','["immediate"]',1,NULL),('deadline','request_deadline','["1 day before"]',1,NULL),('claim','shift_request','["immediate"]',1,NULL);
 INSERT INTO firehouse.station_shift_types VALUES('day','06:00','18:00',1);
 INSERT INTO firehouse.station_schedule_entries VALUES('tomorrow',to_char((now() AT TIME ZONE 'America/Chicago')+interval '2 days','YYYY-MM-DD'),'day');
 INSERT INTO firehouse.station_shift_slots(id,entry_id,role,status) VALUES('old','tomorrow','FF/Attendant','open');`);
 await pg.exec(migration);
 const count=async table=>Number((await pg.query(`SELECT count(*) n FROM firehouse.${table}`)).rows[0].n);
 const enqueue=async()=>pg.query('SELECT firehouse.enqueue_scheduler_push()');
 const claim=async()=> (await pg.query('SELECT firehouse.claim_scheduler_push() job')).rows.map(r=>r.job);
 const finish=outcomes=>pg.query('SELECT firehouse.finish_scheduler_push_batch($1)',[Buffer.from(JSON.stringify(outcomes)).toString('base64')]);
 const insert=async(id='new',role='FF/Attendant')=>pg.query("INSERT INTO firehouse.station_shift_slots(id,entry_id,role,status) VALUES($1,'tomorrow',$2,'open')",[id,role]);
 const reset=async()=>{await pg.exec(`TRUNCATE firehouse.scheduler_push_deliveries,firehouse.scheduler_push_events,firehouse.station_shift_slots,firehouse.station_shift_claims;
 UPDATE firehouse.station_schedule_entries SET entry_date=to_char((now() AT TIME ZONE 'America/Chicago')+interval '2 days','YYYY-MM-DD'); UPDATE firehouse.station_shift_types SET start_time='06:00';
 UPDATE firehouse.station_reminder_rules SET push_enabled=0; UPDATE firehouse.station_reminder_rules SET enabled=1,push_enabled=1;
 UPDATE firehouse.station_reminder_rules SET offsets='["immediate"]' WHERE id='open';
 UPDATE firehouse.push_subscriptions SET active=1,user_id='${user}',department_id='${department}',auth='fixture';
 UPDATE firehouse.employee_profiles SET is_admin=0,end_date=NULL,single_role=0,acting_officer_eligible=0,driver_status=''; UPDATE firehouse.employees SET active=1;
 UPDATE public.department_memberships SET status='active'; UPDATE auth.users SET banned_until=NULL;
 DELETE FROM firehouse.rank_permissions; DELETE FROM firehouse.employee_permission_overrides; DELETE FROM firehouse.station_availability;`);};
 await t.test('installation is opt-in and enabling sends no historical blasts',async()=>{
  await enqueue();assert.equal(await count('scheduler_push_events'),0);
  await pg.exec('UPDATE firehouse.station_reminder_rules SET push_enabled=1');await enqueue();assert.equal(await count('scheduler_push_events'),0);
 });
 await t.test('failed transactions and no-op saves do not produce reminder changes',async()=>{
  await reset();await pg.exec('BEGIN');await insert();await pg.exec('ROLLBACK');await enqueue();assert.equal(await count('scheduler_push_events'),0);
  await insert();await enqueue();const before=await count('scheduler_push_events');await pg.exec("UPDATE firehouse.station_shift_slots SET status=status");await enqueue();assert.equal(await count('scheduler_push_events'),before);
 });
 await t.test('overlapping planners and workers do not claim the same delivery twice',async()=>{
  await reset();await insert();await Promise.all([enqueue(),enqueue(),enqueue()]);assert.equal(await count('scheduler_push_events'),1);assert.equal(await count('scheduler_push_deliveries'),1);
  const [a,b]=await Promise.all([claim(),claim()]);assert.equal(a.length+b.length,1);
 });
 await t.test('new requests recheck current deadlines, closed positions, and duplicate requests atomically',async()=>{
  await reset();await insert();
  const request=()=>pg.exec("INSERT INTO firehouse.station_shift_claims(id,slot_id,employee_id,status) VALUES(gen_random_uuid()::text,'new','member','pending')");
  await pg.exec("UPDATE firehouse.station_shift_slots SET request_deadline='2000-01-01T12:00'");await assert.rejects(request(),/SHIFT_REQUEST_CLOSED/);
  await pg.exec("UPDATE firehouse.station_shift_slots SET request_deadline='',status='filled'");await assert.rejects(request(),/SHIFT_REQUEST_CLOSED/);
  await pg.exec("UPDATE firehouse.station_shift_slots SET status='open'");await request();await assert.rejects(request(),/SHIFT_REQUEST_DUPLICATE/);
  assert.equal(await count('station_shift_claims'),1);
 });
 await t.test('server restart reclaims a lost lease; stale finish cannot acknowledge the new lease',async()=>{
  await reset();await insert();await enqueue();const [old]=await claim();await pg.exec("UPDATE firehouse.scheduler_push_deliveries SET next_attempt_at=now()-interval '1 second'");const [job]=await claim();assert.notEqual(job.lease,old.lease);
  await finish([{id:old.id,lease:old.lease,status:201}]);assert.equal((await pg.query('SELECT state FROM firehouse.scheduler_push_deliveries')).rows[0].state,'sending');
  await finish([{id:job.id,lease:job.lease,status:201}]);assert.equal((await claim()).length,0);
 });
 for(const [name,sql] of [
  ['department mismatch',"UPDATE firehouse.push_subscriptions SET department_id='00000000-0000-4000-8000-000000000099'"],
  ['inactive membership',"UPDATE public.department_memberships SET status='inactive'"],
  ['inactive employee','UPDATE firehouse.employees SET active=0'],
  ['ended employment',"UPDATE firehouse.employee_profiles SET end_date='2000-01-01'"],
  ['scheduler last-day exclusion',"UPDATE firehouse.employee_profiles SET end_date='2099-01-01'"],
  ['banned login',"UPDATE auth.users SET banned_until=now()+interval '1 day'"],
  ['removed permission',"INSERT INTO firehouse.employee_permission_overrides VALUES('member','scheduling.view','deny')"],
  ['filled position',"UPDATE firehouse.station_shift_slots SET status='filled',employee_id='member'"],
  ['deleted position',"DELETE FROM firehouse.station_shift_slots"],
  ['disabled rule',"UPDATE firehouse.station_reminder_rules SET push_enabled=0"],
  ['rotated subscription',"UPDATE firehouse.push_subscriptions SET auth='rotated'"],
  ['unavailable member',"INSERT INTO firehouse.station_availability SELECT 'member',entry_date,'unavailable',1,'00:00','23:59' FROM firehouse.station_schedule_entries"],
  ['member already requested',"INSERT INTO firehouse.station_shift_claims VALUES('claim-one','new','member','pending',now())"],
 ]) await t.test(`current delivery check rejects ${name}`,async()=>{await reset();await insert();await enqueue();await pg.exec(sql);assert.equal((await claim()).length,0);});
 await t.test('qualifications prevent incorrect role broadcasts; individual extra permission is honored',async()=>{
  await reset();await insert('driver','Engine Driver');await enqueue();assert.equal(await count('scheduler_push_deliveries'),0);
  await pg.exec("UPDATE firehouse.employee_profiles SET driver_status='cleared'; INSERT INTO firehouse.rank_permissions VALUES('Firefighter','scheduling.view',0); INSERT INTO firehouse.employee_permission_overrides VALUES('member','scheduling.view','allow')");await insert('driver-two','Engine Driver');await enqueue();assert.equal((await claim()).length,1);
 });
 await t.test('timed reminders become due without a browser or a new save',async()=>{
  await reset();await pg.exec("UPDATE firehouse.station_reminder_rules SET offsets='[\"1 day before\"]' WHERE id='open'; UPDATE firehouse.station_reminder_rules SET push_enabled_at=now()-interval '2 days' WHERE id='open'");
  await insert();await pg.exec("UPDATE firehouse.station_schedule_entries SET entry_date=to_char((now() AT TIME ZONE 'America/Chicago')+interval '1 day','YYYY-MM-DD'); UPDATE firehouse.station_shift_types SET start_time=to_char((now() AT TIME ZONE 'America/Chicago')-interval '1 minute','HH24:MI')");
  await enqueue();assert.equal(await count('scheduler_push_events'),1);await enqueue();assert.equal(await count('scheduler_push_events'),1);
 });
 await t.test('deadline reminders require a saved deadline, never an assumed one',async()=>{
  await reset();await insert();await pg.exec("UPDATE firehouse.station_reminder_rules SET push_enabled=0 WHERE id='open'");await enqueue();assert.equal(await count('scheduler_push_events'),0);
  await pg.exec("UPDATE firehouse.station_reminder_rules SET offsets='[\"immediate\"]' WHERE id='deadline'; UPDATE firehouse.station_shift_slots SET request_deadline=to_char((now() AT TIME ZONE 'America/Chicago')+interval '2 hours','YYYY-MM-DD\"T\"HH24:MI')");await enqueue();assert.equal(await count('scheduler_push_events'),1);
 });
 await t.test('request updates reach requester even after they are assigned; pending timers stop after review',async()=>{
  await reset();await insert();await pg.exec("UPDATE firehouse.station_reminder_rules SET push_enabled=0 WHERE id='open'; INSERT INTO firehouse.station_shift_claims VALUES('request-one','new','member','pending',now())");await enqueue();assert.equal((await claim()).length,1);
  await pg.exec("UPDATE firehouse.station_shift_claims SET status='approved'; UPDATE firehouse.station_shift_slots SET status='filled',employee_id='member'");await enqueue();assert.equal((await claim()).length,1);
 });
 await t.test('normal-priority delivery batches acknowledgements and retains failed requests',async()=>{
  await reset();await insert();let sends=0,acks=0;const result=await drainSchedulerPush({enqueue,claim,finish:outcomes=>{acks++;return finish(outcomes);}},async job=>{sends++;assert.equal(job.payload.kind,'scheduler');assert.ok(job.ttl>0);});assert.equal(result.accepted,1);assert.equal(sends,1);assert.equal(acks,1);
  await insert('failed');await assert.rejects(drainSchedulerPush({enqueue,claim,finish:async()=>{throw Error('simulated interrupted acknowledgement');}},async()=>{}),/interrupted/);
 });
 await t.test('private queue functions and tables are not exposed to browser roles',async()=>{
  for(const role of ['anon','authenticated','service_role']) {
   const result=await pg.query("SELECT has_function_privilege($1,'firehouse.enqueue_scheduler_push()','EXECUTE') allowed,has_table_privilege($1,'firehouse.scheduler_push_deliveries','SELECT') readable",[role]);assert.equal(result.rows[0].allowed,false);assert.equal(result.rows[0].readable,false);
  }
 });
 await t.test('Central-day timings preserve local clock time over both DST changes',async()=>{
  const due=async(anchor,timing)=>(await pg.query("SELECT firehouse.scheduler_reminder_due($1::timestamp,now(),$2) at",[anchor,timing])).rows[0].at;
  assert.equal(new Date(await due('2027-03-14 06:00','1 day before')).toISOString(),'2027-03-13T12:00:00.000Z');
  assert.equal(new Date(await due('2026-11-01 06:00','1 day before')).toISOString(),'2026-10-31T11:00:00.000Z');
  assert.equal(new Date(await due('2027-03-14 06:00','24 hours before')).toISOString(),'2027-03-13T11:00:00.000Z');
 });
 await t.test('the real reminder save handler validates and persists push without changing other channels',async()=>{
  const {createPostgresD1Adapter}=load('../db/postgres-adapter.ts',{'../app/supabase-server':{},'./sql-literal':load('../db/sql-literal.ts')});
  await pg.exec('SET search_path=firehouse,public');
  const db=createPostgresD1Adapter(async()=>({rpc:async(_name,{p_sql,p_mode})=>{try {const result=await pg.query(p_sql);return {data:p_mode==='all'?result.rows:p_mode==='first'?(result.rows[0]??null):{success:true,meta:{changes:result.affectedRows}},error:null};}catch(error){return {data:null,error};}}}));
  const source=file('../app/api/station-scheduler/route.ts');const ast=ts.createSourceFile('route.ts',source,ts.ScriptTarget.Latest,true);
  const selected=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='saveReminderRule').map(n=>n.getText(ast)).join('\n');
  const sandbox={exports:{},...load('../app/scheduler-reminders.ts'),ok:()=>Response.json({ok:true}),bad:(error,status=400)=>Response.json({error},{status})};
  vm.runInNewContext(ts.transpileModule(selected+'\nexports.save=saveReminderRule;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,sandbox);
  await reset(); const save=(body,admin=true)=>sandbox.exports.save(db,{id:'open',offsets:['immediate'],enabled:true,pushEnabled:true,...body},()=>{if(!admin)throw Error('Administrator required');});
  await assert.rejects(save({},false),/Administrator/);
  assert.equal((await save({offsets:['whenever']})).status,400);assert.equal((await save({offsets:[]})).status,400);assert.equal((await save({id:'missing'})).status,404);
  assert.equal((await save({pushEnabled:false})).status,200);assert.equal((await pg.query("SELECT push_enabled FROM firehouse.station_reminder_rules WHERE id='open'")).rows[0].push_enabled,0);
  assert.equal((await save({target:'Everyone including other departments'})).status,200);assert.match((await pg.query("SELECT target FROM firehouse.station_reminder_rules WHERE id='open'")).rows[0].target,/eligible/);
 });
 } finally {await pg.close();}
});

test('reminder timing validation rejects ambiguous and unbounded values',()=>{
 const {validReminderTiming}=load('../app/scheduler-reminders.ts');
 for(const timing of ['immediate','1 hour before','168 hours before','60 days before'])assert.equal(validReminderTiming(timing),true);
 for(const timing of ['tomorrow','0 days before','61 days before','169 hours before','-1 days before','1 week before'])assert.equal(validReminderTiming(timing),false);
});
test('cron verifies its secret before starting the worker',async()=>{
 let runs=0;const api=load('../app/api/cron/scheduler-reminders/route.ts',{'../../../scheduler-push-worker':{runSchedulerPushWorker:async()=>{runs++;return {accepted:0,failed:0};}}});
 const previous=process.env.CRON_SECRET;process.env.CRON_SECRET='fixture-only';
 try {assert.equal((await api.GET(new Request('https://fixture.invalid'))).status,401);assert.equal(runs,0);assert.equal((await api.GET(new Request('https://fixture.invalid',{headers:{authorization:'Bearer fixture-only'}}))).status,200);assert.equal(runs,1);}finally{if(previous===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=previous;}
});
