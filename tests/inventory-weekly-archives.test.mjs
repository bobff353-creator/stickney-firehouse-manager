import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const sql=await readFile(new URL('../supabase/migrations/20261101033528_inventory_weekly_check_archives.sql',import.meta.url),'utf8');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const dept='14a76771-4c24-481b-8def-e6cce005c17b',other=id(99),rig=id(2),place=id(3),original=id(4),mechanical=id(5),meter=id(6),gear=id(7);
async function setup(t){
 const pg=new PGlite();t.after(()=>pg.close());
 await pg.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE SCHEMA auth;CREATE SCHEMA private;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '${id(1)}'::uuid$$;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$SELECT '{"email":"fixture@example.test"}'::jsonb$$;
 CREATE FUNCTION private.inventory_can_admin(d uuid) RETURNS boolean LANGUAGE sql AS $$SELECT d='${dept}'::uuid AND COALESCE(current_setting('fixture.admin',true),'yes')<>'no'$$;
 CREATE FUNCTION private.inventory_can_write(d uuid) RETURNS boolean LANGUAGE sql AS $$SELECT d='${dept}'::uuid AND COALESCE(current_setting('fixture.write',true),'yes')<>'no'$$;
 CREATE FUNCTION private.portal_server_request() RETURNS boolean LANGUAGE sql AS $$SELECT COALESCE(current_setting('fixture.server',true),'yes')<>'no'$$;
 CREATE TABLE departments(id uuid PRIMARY KEY);INSERT INTO departments VALUES('${dept}'),('${other}');
 CREATE TABLE inventory_apparatus_profiles(id uuid PRIMARY KEY,department_id uuid,name text);
 CREATE TABLE department_apparatus(id uuid PRIMARY KEY,department_id uuid,status text);
 CREATE TABLE inventory_compartments(id uuid PRIMARY KEY,department_id uuid,apparatus_id uuid,label text,sort_order int);
 CREATE TABLE inventory_equipment(id uuid PRIMARY KEY,department_id uuid,apparatus_id uuid,compartment_id uuid,name text,check_types text[],weekly_recurrence text DEFAULT 'every_week',retired_at timestamptz,meter_template text,item_order int);
 CREATE TABLE inventory_checks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),department_id uuid,apparatus_id uuid,check_type text,status text CHECK(status IN('in_progress','completed','cancelled')),started_by text,started_at timestamptz DEFAULT now(),completed_at timestamptz,shift_id text,review_status text DEFAULT 'pending',reviewed_at timestamptz,reviewed_by text,review_notes text);
 CREATE UNIQUE INDEX inventory_checks_one_active_type_idx ON inventory_checks(department_id,apparatus_id,check_type) WHERE status='in_progress';
 CREATE TABLE inventory_check_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),department_id uuid,check_id uuid,equipment_id uuid,result text,notes text,numeric_reading numeric,checked_by text,checked_at timestamptz);
 CREATE TABLE inventory_scba_check_entries(id uuid,department_id uuid,check_id uuid,label text,section text,psi numeric,sort_order int,result text);
 INSERT INTO inventory_apparatus_profiles VALUES('${rig}','${dept}','1204');INSERT INTO department_apparatus VALUES('${rig}','${dept}','in_service');
 INSERT INTO inventory_compartments VALUES('${place}','${dept}','${rig}','Vehicle',1);
 INSERT INTO inventory_equipment(id,department_id,apparatus_id,compartment_id,name,check_types,meter_template,item_order) VALUES
 ('${mechanical}','${dept}','${rig}','${place}','Fixture oil check',ARRAY['weekly'],NULL,1),
 ('${meter}','${dept}','${rig}','${place}','Fixture weekly functional meter',ARRAY['weekly','inventory'],'{"version":1}',2),
 ('${gear}','${dept}','${rig}','${place}','Fixture carried equipment',ARRAY['inventory'],NULL,3);
 INSERT INTO inventory_checks(id,department_id,apparatus_id,check_type,status,started_by,started_at,shift_id) VALUES('${original}','${dept}','${rig}','weekly','in_progress','Original crew','2025-08-01 08:00Z','Original shift');
 INSERT INTO inventory_checks(id,department_id,apparatus_id,check_type,status,started_by,started_at,completed_at) VALUES('${id(20)}','${dept}','${rig}','weekly','completed','Previous crew','2025-07-01 08:00Z','2025-07-01 09:00Z'),('${id(21)}','${other}','${rig}','weekly','completed','Other department','2025-07-01 08:00Z','2025-07-01 09:00Z');
 INSERT INTO inventory_check_items(id,department_id,check_id,equipment_id,result,notes,numeric_reading,checked_by,checked_at) VALUES
 ('${id(10)}','${dept}','${original}','${mechanical}','pass','Original source note',7,'Original crew','2025-08-01 08:01Z'),
 ('${id(11)}','${dept}','${original}','${gear}','pass','Original inventory result',NULL,'Original crew','2025-08-01 08:02Z'),
 ('${id(12)}','${dept}','${original}','${meter}','pending',NULL,NULL,NULL,NULL);
 ALTER TABLE inventory_checks ENABLE ROW LEVEL SECURITY;ALTER TABLE inventory_check_items ENABLE ROW LEVEL SECURITY;
 CREATE POLICY checks_read ON inventory_checks FOR SELECT TO authenticated USING(department_id='${dept}' AND private.portal_server_request());
 CREATE POLICY checks_insert ON inventory_checks FOR INSERT TO authenticated WITH CHECK(private.inventory_can_write(department_id) AND private.portal_server_request());
 CREATE POLICY checks_update ON inventory_checks FOR UPDATE TO authenticated USING(private.inventory_can_write(department_id) AND private.portal_server_request()) WITH CHECK(private.inventory_can_write(department_id) AND private.portal_server_request());
 CREATE POLICY items_read ON inventory_check_items FOR SELECT TO authenticated USING(department_id='${dept}' AND private.portal_server_request());
 CREATE POLICY items_insert ON inventory_check_items FOR INSERT TO authenticated WITH CHECK(private.inventory_can_write(department_id) AND private.portal_server_request());
 CREATE POLICY items_update ON inventory_check_items FOR UPDATE TO authenticated USING(private.inventory_can_write(department_id)) WITH CHECK(private.inventory_can_write(department_id));
 GRANT USAGE ON SCHEMA auth,private TO authenticated;GRANT SELECT ON departments,inventory_apparatus_profiles,inventory_compartments,inventory_equipment,inventory_scba_check_entries,department_apparatus TO authenticated;
 GRANT SELECT,INSERT,UPDATE,DELETE ON inventory_checks,inventory_check_items TO authenticated;`);
 await pg.exec(sql);return pg;
}
const restart=async(pg,department=dept)=> (await pg.query('SELECT public.inventory_restart_weekly_check($1,$2,$3) saved',[department,original,'Replace with the mechanical checklist; preserve the original.'])).rows[0].saved;
const headers=async pg=>(await pg.query('SELECT * FROM inventory_checks ORDER BY id')).rows;
const entries=async pg=>(await pg.query('SELECT * FROM inventory_check_items ORDER BY id')).rows;

test('archive and restart preserve every original result and source date, create only pending current items and remain duplicate-safe under the actual authenticated role',async t=>{
 const pg=await setup(t),beforeHeaders=await headers(pg),beforeItems=await entries(pg);await pg.exec('SET ROLE authenticated');
 const receipt=await restart(pg);assert.equal(receipt.saved,true);assert.equal(receipt.itemCount,2);assert.notEqual(receipt.checkId,original);
 const afterHeaders=await headers(pg),afterItems=await entries(pg),old=afterHeaders.find(c=>c.id===original),newCheck=afterHeaders.find(c=>c.id===receipt.checkId);
 assert.deepEqual({...old,status:'in_progress'},beforeHeaders.find(c=>c.id===original));assert.equal(old.status,'cancelled');assert.equal(old.completed_at,null);
 assert.deepEqual(afterItems.filter(i=>i.check_id===original),beforeItems);const fresh=afterItems.filter(i=>i.check_id===newCheck.id);
 assert.deepEqual(fresh.map(i=>i.equipment_id).sort(),[mechanical,meter]);assert.ok(fresh.every(i=>i.result==='pending'&&i.notes===null&&i.numeric_reading===null&&i.checked_by===null&&i.checked_at===null));assert.equal(newCheck.started_by,'fixture@example.test');assert.equal(newCheck.completed_at,null);assert.equal(newCheck.shift_id,null);
 const report=(await pg.query('SELECT public.inventory_check_report($1,$2) report',[dept,original])).rows[0].report;
 assert.equal(report.items.length,3);assert.equal(report.items.filter(i=>i.result==='pass').length,2);assert.equal(report.check.status,'cancelled');assert.equal(report.check.completed_at,null);assert.equal(report.check.replacement_check_id,newCheck.id);assert.equal(report.check.archived_by,'fixture@example.test');assert.match(report.check.archive_reason,/preserve the original/);
 assert.equal((await pg.query('SELECT count(*)::int n FROM public.inventory_check_history_page($1)',[dept])).rows[0].n,2);
 assert.equal((await pg.query("SELECT count(*)::int n FROM public.inventory_check_history_page($1,NULL,NULL,'pending')",[dept])).rows[0].n,1,'archived records cannot enter the approval queue');
 const retried=await restart(pg);assert.equal(retried.alreadyRestarted,true);assert.equal(retried.checkId,newCheck.id);assert.deepEqual(await entries(pg),afterItems);assert.deepEqual(await headers(pg),afterHeaders);
 await assert.rejects(pg.query("UPDATE inventory_checks SET status='completed' WHERE id=$1",[original]),/read only/);
 await assert.rejects(pg.query("UPDATE inventory_check_items SET result='pass' WHERE id=$1",[id(12)]),/read only/);
 assert.equal((await pg.query('DELETE FROM inventory_check_items WHERE id=$1 RETURNING id',[id(12)])).rows.length,0,'existing RLS denies crew deletion');
 assert.deepEqual(await entries(pg),afterItems);await pg.exec('RESET ROLE');
 await assert.rejects(pg.query('DELETE FROM inventory_check_items WHERE id=$1',[id(12)]),/read only/,'the archive guard also prevents privileged accidental deletion');
});

test('permission denial, cross-department access and raw client requests cannot archive, read or mutate these records',async t=>{
 const pg=await setup(t),before=await headers(pg),items=await entries(pg);await pg.exec('SET ROLE authenticated');
 await pg.exec("SET fixture.admin='no'");await assert.rejects(restart(pg),/permissions required/);await pg.exec("SET fixture.admin='yes'");
 await assert.rejects(restart(pg,other),/permissions required/);
 assert.equal((await pg.query('SELECT public.inventory_check_report($1,$2) report',[other,id(21)])).rows[0].report,null);
 const permittedHeaders=await headers(pg);assert.equal(permittedHeaders.length,2);assert.deepEqual(await entries(pg),items);
 await pg.exec("SET fixture.server='no'");assert.equal((await headers(pg)).length,0);assert.equal((await pg.query('SELECT * FROM inventory_check_archives')).rows.length,0);await assert.rejects(restart(pg),/unavailable for your department/);
 await pg.exec('RESET ROLE');assert.deepEqual(await headers(pg),before);assert.deepEqual(await entries(pg),items);
 const grants=(await pg.query("SELECT has_function_privilege('anon','public.inventory_restart_weekly_check(uuid,uuid,text)','EXECUTE') anon_execute,has_table_privilege('anon','public.inventory_check_archives','SELECT') anon_read,has_table_privilege('authenticated','public.inventory_check_archives','UPDATE') crew_update")).rows[0];assert.deepEqual(grants,{anon_execute:false,anon_read:false,crew_update:false});
});

test('a replacement insert failure rolls back the archive and leaves the original open with all saved entries',async t=>{
 const pg=await setup(t),before=await headers(pg),items=await entries(pg);
 await pg.exec(`CREATE FUNCTION fixture_failure() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.check_id<>'${original}'::uuid THEN RAISE EXCEPTION 'Fixture replacement insert failure';END IF;RETURN NEW;END$$;CREATE TRIGGER fixture_failure BEFORE INSERT ON inventory_check_items FOR EACH ROW EXECUTE FUNCTION fixture_failure();`);
 await assert.rejects(restart(pg),/Fixture replacement insert failure/);assert.deepEqual(await headers(pg),before);assert.deepEqual(await entries(pg),items);assert.equal((await pg.query('SELECT count(*)::int n FROM inventory_check_archives')).rows[0].n,0);
});

test('empty or inventory-contaminated weekly templates and Out of Service apparatus leave the original untouched',async t=>{
 const pg=await setup(t),before=await headers(pg),items=await entries(pg);
 await pg.exec("UPDATE department_apparatus SET status='out_of_service'");await assert.rejects(restart(pg),/Out of Service/);await pg.exec("UPDATE department_apparatus SET status='in_service'");
 await pg.query("UPDATE inventory_equipment SET check_types=ARRAY['inventory','weekly'] WHERE id=$1",[gear]);await assert.rejects(restart(pg),/inventory-only/);
 await pg.exec("UPDATE inventory_equipment SET check_types=ARRAY['inventory'],meter_template=NULL");await assert.rejects(restart(pg),/Configure the current weekly/);
 assert.deepEqual(await headers(pg),before);assert.deepEqual(await entries(pg),items);
});
