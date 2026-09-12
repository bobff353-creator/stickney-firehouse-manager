import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { defaultPermissionsForRank, permissionCatalog } from '../app/permissions.ts';

const migration=fs.readFileSync(new URL('../supabase/migrations/20260911192047_portal_permission_boundary.sql',import.meta.url),'utf8');
const digest=migration.match(/= '([a-f0-9]{64})'/)[1];
const department='14a76771-4c24-481b-8def-e6cce005c17b', user='00000000-0000-4000-8000-000000000001';
const tables=[...migration.matchAll(/CREATE POLICY portal_server_boundary ON public\.(\w+)/g)].map(m=>m[1]);
async function fixture({ beforeLiveAccess = false } = {}) {
 const db=new PGlite();
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE SCHEMA auth; CREATE SCHEMA private; CREATE SCHEMA extensions; CREATE SCHEMA firehouse; CREATE SCHEMA storage;
 GRANT USAGE ON SCHEMA public,auth,extensions,firehouse,storage TO authenticated;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.test_uid',true),'')::uuid $$;
 CREATE FUNCTION public.is_platform_owner() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
 CREATE FUNCTION public.current_department_ids() RETURNS SETOF uuid LANGUAGE sql AS $$ SELECT '${department}'::uuid $$;
 CREATE FUNCTION public.can_manage_department(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
 CREATE FUNCTION extensions.digest(value text,algorithm text) RETURNS bytea LANGUAGE sql AS $$ SELECT decode(CASE WHEN value='fixture-server-key' THEN '${digest}' ELSE repeat('0',64) END,'hex') $$;
 CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
 INSERT INTO auth.users VALUES('${user}','member@example.invalid');
 CREATE TABLE public.departments(id uuid PRIMARY KEY,slug text);
 INSERT INTO public.departments VALUES('${department}','stickney-fire-department');
 CREATE TABLE public.department_memberships(department_id uuid,user_id uuid,status text,role text);
 CREATE TABLE public.department_invites(id int,department_id uuid);
 ALTER TABLE public.department_invites ENABLE ROW LEVEL SECURITY;
 INSERT INTO public.department_memberships VALUES('${department}','${user}','active','user');
 CREATE TABLE firehouse.system_meta(key text PRIMARY KEY,value text,updated_at text);
 CREATE TABLE firehouse.pay_scales(id text PRIMARY KEY,label text);
 INSERT INTO firehouse.pay_scales VALUES('rank','Firefighter');
 CREATE TABLE firehouse.employees(id text PRIMARY KEY,name text,pay_scale_id text,active int);
 INSERT INTO firehouse.employees VALUES('member','Fictional Member','rank',1);
 CREATE TABLE firehouse.employee_profiles(employee_id text PRIMARY KEY,email text,is_admin int,employee_number text,end_date text,phone text);
 INSERT INTO firehouse.employee_profiles VALUES('member','member@example.invalid',0,'1234',NULL,'555');
 CREATE TABLE firehouse.rank_permissions(rank text,permission_key text,allowed int,updated_at text,PRIMARY KEY(rank,permission_key));
 CREATE TABLE firehouse.employee_permission_overrides(employee_id text,permission_key text,effect text,updated_at text,PRIMARY KEY(employee_id,permission_key));
 CREATE FUNCTION firehouse.has_department_access() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.department_memberships WHERE department_id='${department}' AND user_id=auth.uid() AND status='active') $$;
 CREATE FUNCTION public.firehouse_sql(p_sql text,p_mode text DEFAULT 'all',p_secret text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$ SELECT NULL::jsonb $$;
 CREATE FUNCTION public.firehouse_sql_batch(p_statements jsonb,p_secret text DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$ SELECT NULL::jsonb $$;
 CREATE TABLE storage.objects(id int,bucket_id text,name text);
 ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
 ${tables.map(t=>`CREATE TABLE public.${t}(id int,department_id uuid); ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY; CREATE POLICY original_access ON public.${t} FOR ALL TO authenticated USING (true) WITH CHECK(true);`).join('\n')}
 GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public,storage,firehouse TO authenticated;
 `);
 await db.exec(migration);
 if (!beforeLiveAccess) await db.exec(fs.readFileSync(new URL('../supabase/migrations/20260912190645_live_operations_individual_access.sql',import.meta.url),'utf8'));
 await db.exec(fs.readFileSync(new URL('../supabase/migrations/20260912100948_inventory_invoker_schema_access.sql',import.meta.url),'utf8'));
 await db.exec(`CREATE OR REPLACE FUNCTION public.firehouse_sql(p_sql text,p_mode text DEFAULT 'all',p_secret text DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY INVOKER AS $$ SELECT firehouse.execute_portal_sql(p_sql,p_mode,p_secret) $$;`);
 return db;
}
async function identity(db,trusted=true){await db.exec(`SET ROLE authenticated; SET request.test_uid='${user}'; SET request.headers='${JSON.stringify(trusted?{'x-firehouse-server-key':'fixture-server-key'}:{})}';`);}

test('Live Operations requires a member grant, ignores legacy rank grants and honors immediate revocation',async()=>{
 const db=await fixture();try{
  const allowed=async()=>{await identity(db);const row=(await db.query("SELECT private.portal_has_permission('operations_board.view') live,private.portal_has_permission('road_closures.view') roads")).rows[0];await db.exec('RESET ROLE');return row;};
  for(const rank of ['Chief','Captain','Lieutenant','Firefighter']){
   await db.query('UPDATE firehouse.pay_scales SET label=$1',[rank]);
   await db.query("INSERT INTO firehouse.rank_permissions VALUES($1,'operations_board.view',1,NULL)",[rank]);
   assert.deepEqual(await allowed(),{live:false,roads:true});
  }
  await db.exec("INSERT INTO firehouse.employee_permission_overrides VALUES('member','operations_board.view','allow',NULL)");
  assert.equal((await allowed()).live,true);
  await db.exec("BEGIN; UPDATE firehouse.employee_permission_overrides SET effect='deny'; ROLLBACK;");
  assert.equal((await allowed()).live,true,'rolled back removal does not change access');
  await db.exec("UPDATE firehouse.employee_permission_overrides SET effect='deny'");
  assert.equal((await allowed()).live,false);
  await db.exec("UPDATE firehouse.employee_profiles SET is_admin=1");
  assert.equal((await allowed()).live,false,'individual deny wins over admin');
  await db.exec("DELETE FROM firehouse.employee_permission_overrides");
  assert.equal((await allowed()).live,true,'administrator default restored');
  await db.exec("UPDATE firehouse.employee_profiles SET is_admin=0");
  assert.equal((await allowed()).live,false,'clearing a member grant stays opt-in');
 }finally{await db.close();}
});

test('cutover preserves historical rank and member Road Closures decisions without deleting old rows',async()=>{
 const db=await fixture({beforeLiveAccess:true});try{
  await db.exec("INSERT INTO firehouse.rank_permissions VALUES('Firefighter','operations_board.view',0,'old'); INSERT INTO firehouse.employee_permission_overrides VALUES('member','operations_board.view','allow','old');");
  const sql=fs.readFileSync(new URL('../supabase/migrations/20260912190645_live_operations_individual_access.sql',import.meta.url),'utf8');
  const before=(await db.query("SELECT value FROM firehouse.system_meta WHERE key='permissions-revision'")).rows[0].value;
  await db.exec(sql);
  assert.notEqual((await db.query("SELECT value FROM firehouse.system_meta WHERE key='permissions-revision'")).rows[0].value,before);
  assert.deepEqual((await db.query("SELECT allowed FROM firehouse.rank_permissions ORDER BY permission_key")).rows,[{allowed:0},{allowed:0}]);
  assert.deepEqual((await db.query("SELECT effect FROM firehouse.employee_permission_overrides ORDER BY permission_key")).rows,[{effect:'allow'},{effect:'allow'}]);
  await db.exec("UPDATE firehouse.employee_permission_overrides SET effect='deny' WHERE permission_key='road_closures.view'");
  await db.exec(sql);
  assert.equal((await db.query("SELECT effect FROM firehouse.employee_permission_overrides WHERE permission_key='road_closures.view'")).rows[0].effect,'deny','replay cannot overwrite a later administrator decision');
 }finally{await db.close();}
});

test('migration closes direct SQL/table/storage access while preserving authenticated server RPC',async()=>{
 const db=await fixture();try{
  await identity(db,false);
  await assert.rejects(db.query('SELECT * FROM firehouse.employee_profiles'),/permission denied/);
  await assert.rejects(db.query("SELECT public.firehouse_sql('SELECT name FROM employees','all',NULL)"),/Use the authenticated portal API/);
  assert.equal((await db.query("SELECT private.inventory_can_access($1) allowed",[department])).rows[0].allowed,false);
  await assert.rejects(db.query('INSERT INTO public.inventory_checks VALUES(1,$1)',[department]),/row-level security/);
  await assert.rejects(db.query("INSERT INTO storage.objects VALUES(1,'firehouse-portal','fixture')"),/row-level security/);
  await assert.rejects(db.query('INSERT INTO public.department_invites VALUES(1,$1)',[department]),/row-level security/);
  await identity(db,true);
  const result=await db.query("SELECT public.firehouse_sql('SELECT name FROM employees','all',NULL) result");assert.equal(result.rows[0].result[0].name,'Fictional Member');
  assert.equal((await db.query('SELECT private.inventory_can_write($1) allowed',[department])).rows[0].allowed,true);
  await db.exec('RESET ROLE');await db.exec("UPDATE public.department_memberships SET status='inactive'");await identity(db,true);
  await assert.rejects(db.query("SELECT public.firehouse_sql('SELECT name FROM employees','all',NULL)"),/department access required/);
 }finally{await db.close();}
});
test('database inventory permissions honor member extras and administrator removals',async()=>{
 const db=await fixture();try{
  await identity(db,true);assert.equal((await db.query('SELECT private.inventory_can_admin($1) allowed',[department])).rows[0].allowed,false);
  await db.exec('RESET ROLE');await db.exec("INSERT INTO firehouse.employee_permission_overrides VALUES('member','inventory.setup.manage','allow',NULL)");
  await identity(db,true);assert.equal((await db.query('SELECT private.inventory_can_admin($1) allowed',[department])).rows[0].allowed,true);
  await db.exec('RESET ROLE');await db.exec("INSERT INTO firehouse.employee_permission_overrides VALUES('member','employees.manage','allow',NULL)");
  await identity(db,true);await db.query('INSERT INTO public.department_invites VALUES(1,$1)',[department]);
  await db.exec('RESET ROLE');await db.exec("UPDATE firehouse.employee_profiles SET is_admin=1; UPDATE firehouse.employee_permission_overrides SET effect='deny'");
  await identity(db,true);assert.equal((await db.query('SELECT private.inventory_can_admin($1) allowed',[department])).rows[0].allowed,false);
  await assert.rejects(db.query('INSERT INTO public.department_invites VALUES(2,$1)',[department]),/row-level security/);
  await db.exec('RESET ROLE');await db.exec("UPDATE firehouse.employee_profiles SET end_date='2000-01-01'");
  await identity(db,true);assert.equal((await db.query('SELECT private.inventory_can_write($1) allowed',[department])).rows[0].allowed,false);
 }finally{await db.close();}
});
test('database defaults stay in parity with all rank defaults',async()=>{
 const db=await fixture();try{
  for(const rank of ['Chief','Deputy Chief','Captain','Lieutenant','Firefighter','Temp Firefighter','Unknown']){
   await db.exec('RESET ROLE');await db.query('UPDATE firehouse.pay_scales SET label=$1',[rank]);await identity(db,true);
   const actual=await db.query('SELECT permission FROM unnest($1::text[]) permission WHERE private.portal_has_permission(permission)',[permissionCatalog.map(x=>x.key)]);
   assert.deepEqual(actual.rows.map(x=>x.permission).sort(),defaultPermissionsForRank(rank).sort(),rank);
  }
 }finally{await db.close();}
});
test('permission revision is atomic, no-op stable, and includes identity/rank changes',async()=>{
 const db=await fixture();try{
  const revision=async()=>(await db.query("SELECT value FROM firehouse.system_meta WHERE key='permissions-revision'")).rows[0].value;
  const first=await revision();
  await db.exec("UPDATE firehouse.employee_profiles SET phone='new phone'");assert.equal(await revision(),first);
  await db.exec("UPDATE firehouse.employee_profiles SET is_admin=0");assert.equal(await revision(),first);
  await db.exec("BEGIN; INSERT INTO firehouse.employee_permission_overrides VALUES('member','inventory.check','deny',NULL); ROLLBACK;");assert.equal(await revision(),first);
  await db.exec("INSERT INTO firehouse.employee_permission_overrides VALUES('member','inventory.check','deny',NULL)");const second=await revision();assert.notEqual(second,first);
  await db.exec("UPDATE firehouse.employee_permission_overrides SET effect='deny'");assert.equal(await revision(),second);
  await db.exec("DELETE FROM firehouse.employee_permission_overrides");assert.notEqual(await revision(),second);
  for(const sql of ["UPDATE firehouse.employee_profiles SET email='changed@example.invalid'","UPDATE firehouse.employee_profiles SET employee_number='4321'","UPDATE firehouse.employee_profiles SET is_admin=1","UPDATE firehouse.employees SET active=0","UPDATE firehouse.pay_scales SET label='Captain'"]){const before=await revision();await db.exec(sql);assert.notEqual(await revision(),before,sql);}
 }finally{await db.close();}
});
