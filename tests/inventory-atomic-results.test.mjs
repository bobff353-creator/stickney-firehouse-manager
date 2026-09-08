import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const migration=fs.readFileSync(new URL('../supabase/migrations/20260908033045_inventory_atomic_item_result.sql',import.meta.url),'utf8');
const department='00000000-0000-4000-8000-000000000001';
const item='00000000-0000-4000-8000-000000000002';
const check='00000000-0000-4000-8000-000000000003';
const equipment='00000000-0000-4000-8000-000000000004';
const photo='00000000-0000-4000-8000-000000000005';
const apparatus='00000000-0000-4000-8000-000000000006';
async function setup(){
 const pg=new PGlite();
 await pg.exec(`CREATE ROLE authenticated; CREATE SCHEMA private; CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '${department}'::uuid$$;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$SELECT '{"email":"fixture@example.test"}'::jsonb$$;
 CREATE FUNCTION private.inventory_can_write(id uuid) RETURNS boolean LANGUAGE sql AS $$SELECT id='${department}'::uuid$$;
 CREATE TABLE public.inventory_checks(id uuid PRIMARY KEY,department_id uuid,apparatus_id uuid,status text,check_type text,completed_at timestamptz,review_status text,reviewed_by text,reviewed_at timestamptz,review_notes text);
 CREATE TABLE public.inventory_check_items(id uuid PRIMARY KEY,department_id uuid,check_id uuid,equipment_id uuid,result text,notes text,numeric_reading numeric,checked_by text,checked_at timestamptz);
 CREATE TABLE public.inventory_scba_check_entries(id uuid,department_id uuid,check_id uuid,result text);
 CREATE TABLE public.inventory_equipment(id uuid PRIMARY KEY,department_id uuid,name text,response_type text,equipment_category text);
 CREATE TABLE public.inventory_deficiency_photos(id uuid PRIMARY KEY,department_id uuid,apparatus_id uuid,check_item_id uuid);
 CREATE TABLE public.inventory_readiness_exceptions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),department_id uuid,apparatus_id uuid,equipment_id uuid,check_item_id uuid,result text,priority text,notes text,status text,out_of_service boolean,opened_by text,issue_categories text[],assigned_employee_ids text[],assigned_employee_names text[],evidence_photo_id uuid);
 CREATE TABLE public.inventory_work_orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),department_id uuid,apparatus_id uuid,equipment_id uuid,linked_exception_id uuid,status text,priority text,summary text,details text,assigned_to text,assigned_employee_ids text[],assigned_employee_names text[],opened_by text);
 INSERT INTO public.inventory_checks(id,department_id,apparatus_id,status,check_type) VALUES('${check}','${department}','${apparatus}','in_progress','inventory');
 INSERT INTO public.inventory_check_items(id,department_id,check_id,equipment_id,result) VALUES('${item}','${department}','${check}','${equipment}','pending');
 INSERT INTO public.inventory_equipment VALUES('${equipment}','${department}','Fixture hose','pass_fail','equipment');
 INSERT INTO public.inventory_deficiency_photos VALUES('${photo}','${department}','${apparatus}','${item}');`);
 await pg.exec(migration);
 return pg;
}
const fail=pg=>pg.query('SELECT public.inventory_record_item_atomic($1,$2,$3,$4,NULL,$5)',[department,item,'damaged','Fixture only',photo]);

test('repair failure rolls back inspection result and notice; retry creates one linked repair',async()=>{
 const pg=await setup();try{
  await pg.exec("ALTER TABLE public.inventory_work_orders ADD CONSTRAINT simulated_failure CHECK (false)");
  await assert.rejects(fail(pg),/simulated_failure/);
  assert.equal((await pg.query('SELECT result FROM public.inventory_check_items')).rows[0].result,'pending');
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM public.inventory_readiness_exceptions')).rows[0].n,0);
  await pg.exec('ALTER TABLE public.inventory_work_orders DROP CONSTRAINT simulated_failure');
  await fail(pg); await fail(pg);
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM public.inventory_readiness_exceptions')).rows[0].n,1);
  assert.equal((await pg.query('SELECT count(*)::int AS n FROM public.inventory_work_orders')).rows[0].n,1);
  assert.equal((await pg.query('SELECT checked_by FROM public.inventory_check_items')).rows[0].checked_by,'fixture@example.test');
 }finally{await pg.close();}
});
test('foreign department and mismatched evidence cannot change results',async()=>{
 const pg=await setup();try{
  await assert.rejects(pg.query('SELECT public.inventory_record_item_atomic($1,$2,$3)',[apparatus,item,'pass']),/permission/);
  await assert.rejects(pg.query('SELECT public.inventory_record_item_atomic($1,$2,$3,$4,NULL,$5)',[department,item,'damaged','note',apparatus]),/Photo/);
  assert.equal((await pg.query('SELECT result FROM public.inventory_check_items')).rows[0].result,'pending');
 }finally{await pg.close();}
});
test('completion rejects pending and empty checks, is repeat-safe, and prevents later result changes',async()=>{
 const pg=await setup();try{
  const complete=()=>pg.query('SELECT public.inventory_complete_check_atomic($1,$2)',[department,check]);
  await assert.rejects(complete(),/Complete a configured/);
  await pg.query('SELECT public.inventory_record_item_atomic($1,$2,$3)',[department,item,'pass']);
  await complete(); await complete();
  assert.equal((await pg.query('SELECT review_status FROM public.inventory_checks')).rows[0].review_status,'pending');
  await assert.rejects(fail(pg),/no longer in progress/);
  await assert.rejects(pg.exec("UPDATE public.inventory_check_items SET result='damaged'"),/no longer in progress/);
  await pg.exec("UPDATE public.inventory_checks SET status='in_progress'; DELETE FROM public.inventory_check_items");
  await assert.rejects(complete(),/Complete a configured/);
 }finally{await pg.close();}
});
