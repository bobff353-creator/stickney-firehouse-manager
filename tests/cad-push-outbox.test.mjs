import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const department='14a76771-4c24-481b-8def-e6cce005c17b';
const user='00000000-0000-4000-8000-000000000001';
const other='00000000-0000-4000-8000-000000000099';
function loadTs(path, mocks={}) {
  const compiledModule={exports:{}};
  const require=createRequire(import.meta.url);
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,
    {module:compiledModule,exports:compiledModule.exports,require:name=>mocks[name]??require(name),process,Buffer,console,AbortSignal,Response,Request,TextEncoder,TextDecoder});
  return compiledModule.exports;
}
const cad=loadTs('../app/cad-push.ts');
const {drainCadPush}=loadTs('../app/cad-push-delivery.ts',{'./cad-push':cad});

test('durable CAD queue: actual migration and delivery worker against local PostgreSQL',async t=>{
 const pg=new PGlite();
 try {
 await pg.exec(`CREATE SCHEMA firehouse; CREATE SCHEMA auth;
 CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,deleted_at timestamptz,banned_until timestamptz);
 CREATE TABLE public.platform_owners(email text PRIMARY KEY);
 CREATE TABLE public.department_memberships(department_id uuid,user_id uuid,status text,PRIMARY KEY(department_id,user_id));
 CREATE TABLE firehouse.employees(id text PRIMARY KEY,active int,pay_scale_id text);
 CREATE TABLE firehouse.employee_profiles(employee_id text PRIMARY KEY,email text,is_admin int,end_date text);
 CREATE TABLE firehouse.pay_scales(id text PRIMARY KEY,label text);
 CREATE TABLE firehouse.rank_permissions(rank text,permission_key text,allowed int,PRIMARY KEY(rank,permission_key));
 CREATE TABLE firehouse.employee_permission_overrides(employee_id text,permission_key text,effect text,PRIMARY KEY(employee_id,permission_key));
 CREATE TABLE firehouse.dispatch_incidents(incident_id text PRIMARY KEY,call_type text,time_out text,narrative text,active bigint);
 CREATE TABLE firehouse.push_subscriptions(id text PRIMARY KEY,user_id text,department_id text,endpoint text UNIQUE,p256dh text,auth text,active bigint,failure_count bigint DEFAULT 0,last_success_at text,last_error text,updated_at text);
 CREATE INDEX push_subscriptions_department_active_idx ON firehouse.push_subscriptions(department_id,active);
 INSERT INTO auth.users VALUES('${user}','member@fixture.invalid',NULL,NULL);
 INSERT INTO public.department_memberships VALUES('${department}','${user}','active');
 INSERT INTO firehouse.employees VALUES('member',1,'ff');
 INSERT INTO firehouse.employee_profiles VALUES('member','member@fixture.invalid',0,NULL);
 INSERT INTO firehouse.pay_scales VALUES('ff','Firefighter');
 INSERT INTO firehouse.push_subscriptions VALUES('one','${user}','${department}','https://push.fixture.invalid/one','fixture-key','fixture-auth',1,0,NULL,'',NULL);
 -- Installing the migration must not enqueue old incidents.
 INSERT INTO firehouse.dispatch_incidents VALUES('old','Fixture','0000','Local test only',1);`);
 await pg.exec(readFileSync(new URL('../supabase/migrations/20260912180527_durable_cad_push_outbox.sql',import.meta.url),'utf8'));
 const count=async table=>Number((await pg.query(`SELECT count(*) n FROM firehouse.${table}`)).rows[0].n);
 const insert=async(id='new',active=1)=>pg.query(`WITH enabled AS MATERIALIZED(SELECT firehouse.enable_cad_push_outbox()) INSERT INTO firehouse.dispatch_incidents SELECT $1,'LOCAL TEST CALL','1234','Fixture only: no real notification',$2 FROM enabled ON CONFLICT(incident_id) DO UPDATE SET narrative=excluded.narrative`,[id,active]);
 const claim=async(id=null)=>(await pg.query('SELECT firehouse.claim_cad_push(50,$1) job',[id])).rows.map(r=>r.job);
 const finish=async outcomes=>{ await pg.query('SELECT firehouse.finish_cad_push_batch($1)',[Buffer.from(JSON.stringify(outcomes)).toString('base64')]); };
 const state=async()=> (await pg.query('SELECT state FROM firehouse.cad_push_deliveries ORDER BY id')).rows.map(r=>r.state);
 const reset=async()=>pg.exec(`TRUNCATE firehouse.cad_push_deliveries,firehouse.cad_push_events,firehouse.dispatch_incidents;
 UPDATE firehouse.push_subscriptions SET active=1,user_id='${user}',department_id='${department}',auth='fixture-auth',failure_count=0;
 UPDATE firehouse.employees SET active=1; UPDATE firehouse.employee_profiles SET is_admin=0,end_date=NULL;
 UPDATE public.department_memberships SET status='active'; UPDATE auth.users SET banned_until=NULL;
 DELETE FROM firehouse.employee_permission_overrides; DELETE FROM firehouse.rank_permissions;`);
 await t.test('migration sends no historical alerts; new-call and delivery writes roll back together',async()=>{
   assert.equal(await count('cad_push_events'),0);
   await pg.exec("INSERT INTO firehouse.dispatch_incidents VALUES('legacy','Fixture','0000','Old deployment sends directly',1)");
   assert.equal(await count('cad_push_events'),0,'old handlers do not double-queue during a migration-first rollout');
   await pg.exec('BEGIN'); await insert('rollback'); await pg.exec('ROLLBACK');
   assert.equal(await count('cad_push_events'),0); assert.equal(await count('cad_push_deliveries'),0);
   await insert('closed',0); assert.equal(await count('cad_push_events'),0);
 });
 await t.test('overlapping duplicate/upsert deliveries produce one event and one recipient job',async()=>{
   await reset(); await Promise.all(Array.from({length:8},()=>insert()));
   assert.equal(await count('cad_push_events'),1); assert.equal(await count('cad_push_deliveries'),1);
   const [first,second]=await Promise.all([claim(),claim()]);
   assert.equal(first.length+second.length,1); assert.equal((await claim()).length,0);
 });
 await t.test('interrupted worker lease is reclaimed; stale acknowledgement cannot finish a new lease',async()=>{
   await reset(); await insert(); const [lost]=await claim();
   await pg.exec("UPDATE firehouse.cad_push_deliveries SET next_attempt_at=now()-interval '1 second'");
   const [recovered]=await claim(); assert.notEqual(recovered.lease,lost.lease);
   await finish([{id:lost.id,lease:lost.lease,status:201}]); assert.deepEqual(await state(),['sending']);
   await finish([{id:recovered.id,lease:recovered.lease,status:201}]); assert.deepEqual(await state(),['accepted']);
   assert.equal((await claim()).length,0);
 });
 await t.test('transient failure retries; expired endpoint deactivates; late jobs expire instead of sending old alerts',async()=>{
   await reset(); await insert(); let [job]=await claim(); await finish([{id:job.id,lease:job.lease,status:503}]);
   assert.deepEqual(await state(),['retry']); assert.equal((await claim()).length,0);
   await pg.exec("UPDATE firehouse.cad_push_deliveries SET next_attempt_at=now()-interval '1 second'");
   [job]=await claim(); await finish([{id:job.id,lease:job.lease,status:410}]);
   assert.deepEqual(await state(),['failed']); assert.equal((await pg.query("SELECT active FROM firehouse.push_subscriptions WHERE id='one'")).rows[0].active,0);
   await reset(); await insert(); await pg.exec("UPDATE firehouse.cad_push_deliveries SET expires_at=now()-interval '1 second'");
   assert.equal((await claim()).length,0); assert.deepEqual(await state(),['expired']);
 });
 for (const [name,sql] of [
   ['other department',`UPDATE firehouse.push_subscriptions SET department_id='${other}'`],
   ['inactive membership',"UPDATE public.department_memberships SET status='inactive'"],
   ['inactive employee',"UPDATE firehouse.employees SET active=0"],
   ['past employment end date',"UPDATE firehouse.employee_profiles SET end_date='2000-01-01'"],
   ['banned identity',"UPDATE auth.users SET banned_until=now()+interval '1 day'"],
   ['explicit member deny, even administrator',"UPDATE firehouse.employee_profiles SET is_admin=1; INSERT INTO firehouse.employee_permission_overrides VALUES('member','field_preplans.view','deny')"],
   ['rank deny',"INSERT INTO firehouse.rank_permissions VALUES('Firefighter','field_preplans.view',0)"],
 ]) await t.test(`recipient filter rejects ${name}, including changes after enqueue`,async()=>{
   await reset(); await insert(); await pg.exec(sql); assert.equal((await claim()).length,0);
   assert.deepEqual(await state(),['cancelled']); await insert('later'); assert.equal(await count('cad_push_deliveries'),1);
 });
 await t.test('explicit extra member allow overrides rank denial; current day end date is inclusive',async()=>{
   await reset(); await pg.exec("INSERT INTO firehouse.rank_permissions VALUES('Firefighter','field_preplans.view',0); INSERT INTO firehouse.employee_permission_overrides VALUES('member','field_preplans.view','allow'); UPDATE firehouse.employee_profiles SET end_date=to_char(now() AT TIME ZONE 'America/Chicago','YYYY-MM-DD')");
   await insert(); assert.equal((await claim()).length,1);
 });
 await t.test('subscription rotation/reassignment cannot send queued call details to a different identity',async()=>{
   await reset(); await insert(); await pg.exec("UPDATE firehouse.push_subscriptions SET auth='rotated-fixture'");
   assert.equal((await claim()).length,0); assert.deepEqual(await state(),['cancelled']);
 });
 await t.test('preserves only the existing trusted owner exception, not a forged owner identity',async()=>{
   await reset(); await pg.exec(`UPDATE auth.users SET email='bobff353@gmail.com'; UPDATE public.department_memberships SET status='inactive'; INSERT INTO public.platform_owners VALUES('bobff353@gmail.com')`);
   await insert(); assert.equal((await claim()).length,1);
   await pg.exec('DELETE FROM public.platform_owners'); await insert('forged'); assert.equal(await count('cad_push_deliveries'),1);
   await pg.exec("UPDATE auth.users SET email='member@fixture.invalid'");
 });
 await t.test('real delivery orchestration processes 50 recipients with one acknowledgement RPC',async()=>{
   await reset(); await pg.exec(`INSERT INTO firehouse.push_subscriptions SELECT 'batch-'||n,'${user}','${department}','https://push.fixture.invalid/'||n,'fixture-key','fixture-auth',1,0,NULL,'',NULL FROM generate_series(2,50) n`);
   await insert(); let claims=0,acks=0,sends=0;
   const store={claim:async()=>{claims++;return claim();},finish:async outcomes=>{acks++;return finish(outcomes);}};
   const result=await drainCadPush(store,async(job,payload,ttl)=>{sends++; assert.ok(payload.eventId); assert.match(payload.tag,/cad-14a76771/); assert.ok(ttl>0&&ttl<=300);});
   assert.equal(sends,50); assert.equal(acks,1); assert.equal(claims,2); assert.equal(result.accepted,50);
   assert.ok((await state()).every(s=>s==='accepted'));
   await pg.exec("DELETE FROM firehouse.push_subscriptions WHERE id<>'one'");
 });
 await t.test('failed acknowledgement retains leased jobs for recovery rather than claiming success',async()=>{
   await reset(); await insert(); await assert.rejects(drainCadPush({claim,finish:async()=>{throw Error('fixture database interrupted');}},async()=>{}),/interrupted/);
   assert.deepEqual(await state(),['sending']);
 });
 await t.test('actual authenticated bridge -> SQL adapter -> atomic insert -> immediate worker -> batched acknowledgement',async()=>{
   await reset(); await pg.exec(`SET search_path=firehouse,public;
     ALTER TABLE firehouse.dispatch_incidents ADD COLUMN resend_email_id text,ADD COLUMN category text,ADD COLUMN address text,ADD COLUMN city text,ADD COLUMN responding_units text,ADD COLUMN longitude float8,ADD COLUMN latitude float8,ADD COLUMN dispatched_at text,ADD COLUMN attachment_count bigint,ADD COLUMN source_payload text,ADD COLUMN received_at text,ADD COLUMN cleared_at text;`);
   const counters={rpc:0,sends:0,acks:0},callbacks=[];
   const client={async rpc(name,args){counters.rpc++;try {
     async function execute(connection,sql,mode){
       assert.doesNotMatch(sql,/(;|--|\/\*|\*\/)|\b(create|alter|drop|truncate|grant|revoke|copy|call|show|reset|listen|notify|vacuum|analyze)\b/i,'production SQL boundary');
       if(mode==='all')return (await connection.query("SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') value FROM ("+sql+') r')).rows[0].value;
       if(mode==='first')return (await connection.query('SELECT to_jsonb(r) value FROM ('+sql+') r LIMIT 1')).rows[0]?.value??null;
       return {success:true,meta:{changes:(await connection.query(sql)).affectedRows}};
     }
     if(name.endsWith('_batch')) return {data:await pg.transaction(async tx=>{const values=[];for(const s of args.p_statements)values.push(await execute(tx,s.sql,s.mode));return values;}),error:null};
     if(args.p_sql.includes('finish_cad_push_batch'))counters.acks++;
     return{data:await execute(pg,args.p_sql,args.p_mode),error:null};
   }catch(error){return{data:null,error:{message:error.message}};}}};
   const adapter=loadTs('../db/postgres-adapter.ts',{'../app/supabase-server':{getSupabaseServerClient:async()=>client},'./sql-literal':loadTs('../db/sql-literal.ts')});
   const db=adapter.createPostgresD1Adapter(async()=>client,'firehouse_server_sql','fixture-only');
   const worker=loadTs('../app/cad-push-worker.ts',{'server-only':{},'next/server':{after:fn=>callbacks.push(fn)},'../db/postgres-adapter':adapter,'./supabase-system':{getSupabaseSystemClient:async()=>client},'./portal-server-headers':{portalServerHeaders:()=>({'x-firehouse-server-key':'fixture-only'})},'./cad-push':{webPushPublicConfig:()=>({configured:true}),deliverCadPush:async()=>{counters.sends++;}},'./cad-push-delivery':{drainCadPush}});
   const bridge=loadTs('../app/api/dispatch-bridge/route.ts',{'../../../db/bootstrap':{ensureDatabase:async()=>db},'../../dispatch-daily-log':{projectDispatchIntoDailyLog:async()=>{assert.equal(await count('cad_push_events'),1);assert.equal(callbacks.length>0,true);}},'../../cad-push-worker':worker});
   const prior=process.env.DISPATCH_BRIDGE_READ_TOKEN;process.env.DISPATCH_BRIDGE_READ_TOKEN='local-fixture-token';
   try {
     const request=authorized=>new Request('https://fixture.invalid/api/dispatch-bridge',{method:'POST',headers:{authorization:authorized?'Bearer local-fixture-token':'Bearer wrong','Content-Type':'application/json'},body:JSON.stringify({reportNumber:'FIXTURE-CALL-1',callType:'LOCAL TEST',dispatchedAt:new Date().toISOString(),narrative:'Fixture text with SQL words: call; no credentials'})});
     const denied=await bridge.POST(request(false));assert.equal(denied.status,401);assert.equal(counters.rpc,0);
     const responses=await Promise.all([bridge.POST(request(true)),bridge.POST(request(true))]);
     for(const response of responses)assert.equal(response.status,200,JSON.stringify(await response.json()));
     assert.equal(await count('cad_push_events'),1);assert.equal(counters.sends,0,'delivery is not awaited by CAD ingestion');
     await Promise.all(callbacks.map(fn=>fn()));assert.equal(counters.sends,1);assert.equal(counters.acks,1);assert.deepEqual(await state(),['accepted']);
     const cron=loadTs('../app/api/cron/cad-push/route.ts',{'../../../cad-push-worker':worker});
     const before=counters.rpc;assert.equal((await cron.GET(new Request('https://fixture.invalid/api/cron/cad-push'))).status,401);assert.equal(counters.rpc,before);
   } finally {if(prior===undefined)delete process.env.DISPATCH_BRIDGE_READ_TOKEN;else process.env.DISPATCH_BRIDGE_READ_TOKEN=prior;}
   await pg.exec('SET search_path=public');
 });
 await t.test('queue uses partial pending index with large accepted history',async()=>{
   await reset(); await insert(); await pg.exec(`INSERT INTO firehouse.cad_push_deliveries(event_id,subscription_id,recipient_id,credential_fingerprint,state)
     SELECT e.id,'history-'||n,'${user}','fixture','accepted' FROM firehouse.cad_push_events e CROSS JOIN generate_series(1,10000) n;
     ANALYZE firehouse.cad_push_deliveries;`);
   const plan=(await pg.query("EXPLAIN SELECT id FROM firehouse.cad_push_deliveries WHERE state IN ('pending','sending','retry') AND next_attempt_at<=now() ORDER BY next_attempt_at,id LIMIT 50")).rows.map(r=>r['QUERY PLAN']).join('\n');
   assert.match(plan,/cad_push_pending_idx/);
 });
 await t.test('direct anonymous/authenticated roles cannot read receipts, claim jobs, or inspect eligibility',async()=>{
   await pg.exec('GRANT USAGE ON SCHEMA firehouse TO anon,authenticated');
   for(const role of ['anon','authenticated']) {
     await pg.exec(`SET ROLE ${role}`);
     await assert.rejects(pg.query('SELECT * FROM firehouse.cad_push_deliveries'),/permission denied/);
     await assert.rejects(pg.query('SELECT firehouse.claim_cad_push(50,NULL)'),/permission denied/);
     await assert.rejects(pg.query('SELECT firehouse.cad_push_recipient_allowed($1,$2)',[department,user]),/permission denied/);
     await pg.exec('RESET ROLE');
   }
 });
 } finally {await pg.close();}
});

test('all CAD entry points schedule durable delivery after the commit, before Daily Log projection',()=>{
 for(const file of ['app/api/cad/cis/route.ts','app/api/dispatch-bridge/route.ts','app/api/resend-dispatch/route.ts','app/resend-dispatch-sync.ts']) {
   const source=readFileSync(new URL('../'+file,import.meta.url),'utf8');
   assert.doesNotMatch(source,/sendCadPushNotifications|incidentAlreadyStored/);
   assert.match(source,/enable_cad_push_outbox\(\)/);
   if(!file.includes('/cis/')) assert.match(source,/WITH cad_push_enabled AS MATERIALIZED.*FROM cad_push_enabled ON CONFLICT/);
   assert.ok(source.indexOf('scheduleCadPushDelivery(',source.indexOf('export'))<source.indexOf('await projectDispatchIntoDailyLog'));
 }
 const worker=readFileSync(new URL('../app/cad-push-worker.ts',import.meta.url),'utf8');
 assert.match(worker,/after\(async/); assert.match(worker,/firehouse_server_sql/);
 const cron=readFileSync(new URL('../app/api/cron/cad-push/route.ts',import.meta.url),'utf8');
 assert.ok(cron.indexOf('request.headers.get')<cron.indexOf('await runCadPushWorker'));
 const config=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.equal(config.crons.find(c=>c.path==='/api/cron/cad-push').schedule,'* * * * *');
});
