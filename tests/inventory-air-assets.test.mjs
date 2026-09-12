import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { airCheckLines } from '../app/inventory-air-checks.ts';
import { airAssetInput, airSaveError } from '../app/inventory-air-input.ts';
const migration = fs.readFileSync(new URL('../supabase/migrations/20260912030430_individual_air_assets.sql', import.meta.url), 'utf8');
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const dept=uuid(1), other=uuid(2), rig=uuid(3), rig2=uuid(4), location=uuid(5), location2=uuid(6), pack=uuid(7), bottle=uuid(8);
async function setup() {
 const pg = new PGlite();
 await pg.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA private; CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '${uuid(100)}'::uuid$$;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$SELECT '{"email":"fixture@example.test"}'::jsonb$$;
 CREATE FUNCTION private.inventory_can_admin(id uuid) RETURNS boolean LANGUAGE sql AS $$SELECT id='${dept}'::uuid AND current_setting('fixture.admin',true)='yes'$$;
 CREATE FUNCTION private.inventory_can_write(id uuid) RETURNS boolean LANGUAGE sql AS $$SELECT id='${dept}'::uuid AND current_setting('fixture.allowed',true)='yes'$$;
 CREATE FUNCTION private.portal_has_permission(p text) RETURNS boolean LANGUAGE sql AS $$SELECT current_setting('fixture.allowed',true)='yes'$$;
 SET fixture.admin='yes'; SET fixture.allowed='yes';
 CREATE TABLE inventory_apparatus_profiles(id uuid PRIMARY KEY,department_id uuid,name text,asset_type text);
 CREATE TABLE inventory_compartments(id uuid PRIMARY KEY,department_id uuid,apparatus_id uuid,label text);
 CREATE TABLE inventory_equipment(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),department_id uuid NOT NULL,apparatus_id uuid NOT NULL,compartment_id uuid NOT NULL,name text NOT NULL,manufacturer text,model text,serial_number text,barcode text,quantity_required int NOT NULL DEFAULT 1,equipment_category text NOT NULL DEFAULT 'equipment',item_type text NOT NULL DEFAULT 'individual',check_types text[] DEFAULT ARRAY['inventory'],purchase_date date,in_service_date date,expiration_date date,retired_at timestamptz,service_status text DEFAULT 'in_service',updated_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE inventory_scba_templates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),department_id uuid,apparatus_id uuid,pack_positions text[],include_rit boolean,spare_bottle_count int,active boolean);
 CREATE TABLE inventory_checks(id uuid PRIMARY KEY,department_id uuid,apparatus_id uuid,shift_id text,check_type text,status text,started_by text);
 CREATE UNIQUE INDEX one_active ON inventory_checks(department_id,apparatus_id,check_type) WHERE status='in_progress';
 CREATE TABLE inventory_scba_check_entries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),department_id uuid,check_id uuid REFERENCES inventory_checks(id),section text,label text,sort_order int,result text DEFAULT 'pending',harness_number text,cylinder_number text,UNIQUE(check_id,sort_order));
 CREATE TABLE inventory_work_orders(id uuid PRIMARY KEY,department_id uuid,apparatus_id uuid,equipment_id uuid REFERENCES inventory_equipment(id),status text,priority text,summary text,details text,opened_by text,closed_by text,closed_at timestamptz,repair_date date,repair_cost numeric CHECK(repair_cost>=0),vendor text,invoice_number text,resolution_notes text,performed_by text,service_type text,next_service_due_date date);
 INSERT INTO inventory_apparatus_profiles VALUES('${rig}','${dept}','Fixture engine','engine'),('${rig2}','${dept}','Fixture ambulance','ambulance'),('${uuid(40)}','${other}','Other department','engine');
 INSERT INTO inventory_compartments VALUES('${location}','${dept}','${rig}','Officer seat'),('${location2}','${dept}','${rig2}','Cab'),('${uuid(41)}','${other}','${uuid(40)}','Cab');
 INSERT INTO inventory_scba_templates(department_id,apparatus_id,pack_positions,include_rit,spare_bottle_count,active) VALUES('${dept}','${rig}',ARRAY['Officer seat','Rear seat'],true,1,true);
 INSERT INTO inventory_equipment(id,department_id,apparatus_id,compartment_id,name,quantity_required) VALUES('${uuid(99)}','${dept}','${rig}','${location}','Legacy grouped SCBA harnesses',4);`);
 await pg.exec(migration);
 await pg.exec(fs.readFileSync(new URL('../supabase/migrations/20260912030432_equipment_service_reminders.sql', import.meta.url), 'utf8'));
 return pg;
}
const input = (changes={}) => airAssetInput({ name:'Fixture pack',asset_number:'PACK-01',scba_asset_kind:'pack',compartment_id:location,scba_check_slot:'pack:Officer seat',serial_number:'FIXTURE-SERIAL',purchase_date:'2025-01-10',...changes });
const save = (pg,id=pack,data=input(),expected=null,department=dept) => pg.query('SELECT inventory_save_air_asset($1,$2,$3,$4) result',[department,id,expected,data]);
const start = (pg,apparatus=rig) => pg.query('SELECT inventory_start_air_check($1,$2) result',[dept,apparatus]);

test('service schedule saves atomically with asset; invalid writes roll back and no-op stays unchanged',async()=>{
 const pg=await setup();try{
  const schedule={last_serviced_date:'2024-01-31',service_interval_months:18,service_reminder_months:4};
  await save(pg,pack,input(schedule));
  const old=(await pg.query('SELECT * FROM inventory_equipment WHERE id=$1',[pack])).rows[0];
  assert.equal(old.last_serviced_date.toISOString().slice(0,10),'2024-01-31');assert.equal(old.service_interval_months,18);assert.equal(old.service_reminder_months,4);
  assert.equal((await save(pg,pack,input(schedule),old.updated_at)).rows[0].result.changed,false);
  for(const changes of [{last_serviced_date:'2099-01-01'}, {service_interval_months:0}, {service_interval_months:18,service_reminder_months:18}, {service_reminder_months:null}, {last_serviced_date:null}]){
   await assert.rejects(save(pg,pack,{...input(schedule),...changes,name:'Must roll back'},old.updated_at));
   assert.equal((await pg.query('SELECT name FROM inventory_equipment WHERE id=$1',[pack])).rows[0].name,old.name);
  }
  // Old clients omit these keys, so editing another field cannot erase a new schedule.
  await save(pg,pack,input({name:'Old-client rename'}),old.updated_at);
  assert.equal((await pg.query('SELECT service_interval_months FROM inventory_equipment WHERE id=$1',[pack])).rows[0].service_interval_months,18);
  await pg.exec(`SET fixture.admin='no'`);
  await assert.rejects(save(pg,pack,input(schedule),old.updated_at),/permission/);
 }finally{await pg.close();}
});

test('generic equipment uses the same constraints, opt-in defaults, and atomic row write',async()=>{
 const pg=await setup();try{
  const legacy=(await pg.query('SELECT * FROM inventory_equipment WHERE id=$1',[uuid(99)])).rows[0];
  assert.equal(legacy.last_serviced_date,null);assert.equal(legacy.service_interval_months,null);
  await pg.query('UPDATE inventory_equipment SET last_serviced_date=$1,service_interval_months=12,service_reminder_months=3 WHERE id=$2',['2024-01-01',uuid(99)]);
  await assert.rejects(pg.query("UPDATE inventory_equipment SET name='bad',last_serviced_date='2099-01-01' WHERE id=$1",[uuid(99)]),/future/);
  assert.equal((await pg.query('SELECT name FROM inventory_equipment WHERE id=$1',[uuid(99)])).rows[0].name,legacy.name);
  await pg.query('UPDATE inventory_equipment SET service_interval_months=NULL,service_reminder_months=NULL WHERE id=$1',[uuid(99)]);
  assert.equal((await pg.query('SELECT last_serviced_date::text FROM inventory_equipment WHERE id=$1',[uuid(99)])).rows[0].last_serviced_date,'2024-01-01');
 }finally{await pg.close();}
});

test('unique physical IDs, no-op retries, legacy preservation, and stale edits',async()=>{
 const pg=await setup();try{
  await save(pg);
  const before=(await pg.query('SELECT * FROM inventory_equipment WHERE id=$1',[pack])).rows[0];
  assert.equal(before.quantity_required,1); assert.deepEqual(before.check_types,['air_pack']);
  assert.equal((await save(pg)).rows[0].result.changed,false);
  await assert.rejects(save(pg,bottle,input({asset_number:' pack-01 ',scba_check_slot:null})),/inventory_air_asset_number/);
  await assert.rejects(save(pg,bottle,input({asset_number:'PACK-02'})),/inventory_air_check_slot/);
  await assert.rejects(save(pg,pack,input({name:'Changed on stale screen'})),/another screen/);
  await save(pg,pack,input({name:'Saved correction'}),before.updated_at);
  const legacy=(await pg.query('SELECT * FROM inventory_equipment WHERE id=$1',[uuid(99)])).rows[0];
  assert.equal(legacy.quantity_required,4); assert.equal(legacy.scba_asset_kind,null);
  await assert.rejects(save(pg,uuid(99)),/not an active registered/);
 }finally{await pg.close();}
});

test('future checks bind IDs and location; moves, retirements, and template changes preserve old snapshots',async()=>{
 const pg=await setup();try{
  await save(pg);
  await save(pg,bottle,input({name:'Fixture cylinder',asset_number:'BOTTLE-01',scba_asset_kind:'bottle',scba_check_slot:'spare:Spare #1',hydro_test_date:'2024-01-01',hydro_due_date:'2027-01-01'}));
  const opened=(await start(pg)).rows[0].result;
  assert.equal((await start(pg)).rows[0].result.checkId,opened.checkId);
  const rows=(await pg.query('SELECT * FROM inventory_scba_check_entries ORDER BY sort_order')).rows;
  assert.equal(rows.length,4); assert.equal(rows[0].asset_number,'PACK-01'); assert.equal(rows[3].asset_number,'BOTTLE-01'); assert.equal(rows[1].equipment_id,null);
  const before=(await pg.query('SELECT updated_at FROM inventory_equipment WHERE id=$1',[pack])).rows[0];
  await save(pg,pack,input({compartment_id:location2,scba_check_slot:null}),before.updated_at);
  assert.deepEqual((await pg.query('SELECT * FROM inventory_scba_check_entries ORDER BY sort_order')).rows,rows);
  const newCheck=(await start(pg,rig2)).rows[0].result.checkId;
  const moved=(await pg.query('SELECT * FROM inventory_scba_check_entries WHERE check_id=$1',[newCheck])).rows;
  assert.equal(moved.length,1); assert.equal(moved[0].equipment_id,pack); assert.match(moved[0].location_snapshot,/Fixture ambulance · Cab/);
  await pg.exec("UPDATE inventory_checks SET status='completed'; UPDATE inventory_scba_templates SET pack_positions=ARRAY['Changed seat']");
  await pg.query('UPDATE inventory_equipment SET retired_at=now() WHERE id=$1',[bottle]);
  const next=(await start(pg)).rows[0].result.checkId;
  assert.equal((await pg.query('SELECT count(*)::int n FROM inventory_scba_check_entries WHERE check_id=$1 AND equipment_id IS NOT NULL',[next])).rows[0].n,0);
  await assert.rejects(save(pg,uuid(80),input({asset_number:'BOTTLE-01',scba_check_slot:null})),/inventory_air_asset_number/);
  assert.equal((await pg.query('SELECT asset_number FROM inventory_scba_check_entries WHERE check_id=$1 AND equipment_id=$2',[opened.checkId,bottle])).rows[0].asset_number,'BOTTLE-01');
 }finally{await pg.close();}
});

test('empty and failed check creation roll back atomically; frontend preview matches SQL',async()=>{
 const pg=await setup();try{
  await assert.rejects(start(pg,rig2),/Register an air asset/);
  assert.equal((await pg.query('SELECT count(*)::int n FROM inventory_checks')).rows[0].n,0);
  await save(pg);
  await save(pg,bottle,input({scba_asset_kind:'bottle',asset_number:'BOTTLE-01',scba_check_slot:null}));
  await pg.exec('ALTER TABLE inventory_scba_check_entries ADD CONSTRAINT simulated_failure CHECK(false)');
  await assert.rejects(start(pg),/simulated_failure/);
  assert.equal((await pg.query('SELECT count(*)::int n FROM inventory_checks')).rows[0].n,0);
  await pg.exec('ALTER TABLE inventory_scba_check_entries DROP CONSTRAINT simulated_failure');
  await start(pg);
  const template=(await pg.query('SELECT * FROM inventory_scba_templates')).rows[0];
  const assets=(await pg.query('SELECT * FROM inventory_equipment')).rows;
  const expected=airCheckLines(template,assets,rig);
  const actual=(await pg.query('SELECT label,section,equipment_id FROM inventory_scba_check_entries ORDER BY sort_order')).rows;
  assert.deepEqual(actual,expected.map(({label,section,equipment_id})=>({label,section,equipment_id})));
 }finally{await pg.close();}
});

test('authorization, tenant isolation, real location, hydro dates, and active asset editing are enforced',async()=>{
 const pg=await setup();try{
  await assert.rejects(save(pg,pack,input(),null,other),/permission required/);
  await assert.rejects(save(pg,pack,input({compartment_id:uuid(41)})),/saved department location/);
  await assert.rejects(save(pg,pack,{...input(),hydro_test_date:'2026-01-01',hydro_due_date:'2025-01-01'}),/inventory_air_hydro_dates/);
  await assert.rejects(save(pg,pack,input({scba_check_slot:'pack:Does not exist'})),/checklist position changed/);
  await pg.exec("SET fixture.admin='no'");
  await assert.rejects(save(pg),/permission required/);
  await pg.exec("SET fixture.admin='yes'; SET fixture.allowed='no'");
  await save(pg);
  await assert.rejects(start(pg),/permission required/);
  const functions=(await pg.query("SELECT proname,prosecdef,proacl::text FROM pg_proc WHERE proname IN ('inventory_save_air_asset','inventory_start_air_check','inventory_log_air_maintenance')")).rows;
  assert.equal(functions.length,3); functions.forEach(row=>{assert.equal(row.prosecdef,false);assert.doesNotMatch(row.proacl,/anon|\{=X/);});
 }finally{await pg.close();}
});

test('maintenance follows its asset after a move without changing readiness or hydro dates',async()=>{
 const pg=await setup();try{
  await save(pg);
  await pg.query("UPDATE inventory_equipment SET service_status='out_of_service' WHERE id=$1",[pack]);
  const record={summary:'Fixture annual service',repair_date:'2025-06-01',resolution_notes:'Recorded from fixture service report',vendor:'Fixture vendor',repair_cost:'25.15'};
  const log=()=>pg.query('SELECT inventory_log_air_maintenance($1,$2,$3,$4)',[dept,pack,uuid(90),record]);
  await log(); await log();
  assert.equal((await pg.query('SELECT count(*)::int n FROM inventory_work_orders')).rows[0].n,1);
  const asset=(await pg.query('SELECT * FROM inventory_equipment WHERE id=$1',[pack])).rows[0];
  assert.equal(asset.service_status,'out_of_service'); assert.equal(asset.hydro_test_date,null);
  await save(pg,pack,input({compartment_id:location2,scba_check_slot:null}),asset.updated_at);
  const history=(await pg.query('SELECT * FROM inventory_work_orders WHERE equipment_id=$1',[pack])).rows;
  assert.equal(history.length,1); assert.equal(history[0].apparatus_id,rig); assert.equal(history[0].repair_cost,'25.15');
  await assert.rejects(pg.query('SELECT inventory_log_air_maintenance($1,$2,$3,$4)',[dept,uuid(99),uuid(91),record]),/Air asset not found/);
  await assert.rejects(pg.query('SELECT inventory_log_air_maintenance($1,$2,$3,$4)',[dept,pack,uuid(91),{...record,repair_date:'2999-01-01'}]),/future/);
 }finally{await pg.close();}
});

test('request input is allowlisted and rejects malformed dates, lengths, and invalid hydro order',()=>{
 assert.equal(input({department_id:other,service_status:'in_service'}).department_id,undefined);
 assert.equal(input({department_id:other,service_status:'in_service'}).service_status,undefined);
 assert.throws(()=>input({purchase_date:'2026-02-30'}),/calendar dates/);
 assert.throws(()=>input({hydro_test_date:'2026-01-01',hydro_due_date:'2025-01-01'}),/cannot be before/);
 assert.throws(()=>input({asset_number:' '.repeat(10)}),/unique ID/);
 assert.throws(()=>input({asset_number:'x'.repeat(81)}),/80 characters/);
 assert.equal(airSaveError({code:'23505'}).status,409);
 assert.equal(airSaveError({code:'42501'}).status,403);
 const api=fs.readFileSync(new URL('../app/api/operations/route.ts',import.meta.url),'utf8');
 assert.match(api,/verifyInventoryRequest\(request\)/); assert.match(api,/sameOriginInventoryRequest\(request\)/);
 assert.match(api,/"log_air_maintenance"\]\s*\.includes\(action\)[\s\S]*?"inventory.repairs.manage"/);
});

test('invoker cannot bypass a denied RLS write and physical-asset lookup uses the partial index',async()=>{
 const pg=await setup();try{
  await pg.exec(`GRANT USAGE ON SCHEMA public,private,auth TO authenticated;
   GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
   ALTER TABLE inventory_equipment ENABLE ROW LEVEL SECURITY;
   CREATE POLICY fixture_read ON inventory_equipment FOR SELECT TO authenticated USING(department_id='${dept}');
   CREATE POLICY fixture_insert ON inventory_equipment FOR INSERT TO authenticated WITH CHECK(department_id='${dept}' AND current_setting('fixture.write_allowed',true)='yes');
   CREATE POLICY fixture_update ON inventory_equipment FOR UPDATE TO authenticated USING(department_id='${dept}' AND current_setting('fixture.write_allowed',true)='yes') WITH CHECK(department_id='${dept}');
   SET fixture.write_allowed='yes'; SET ROLE authenticated;`);
  await save(pg);
  await pg.exec("SET fixture.write_allowed='no'");
  await assert.rejects(save(pg,bottle,input({asset_number:'BLOCKED',scba_check_slot:null})),/row-level security/);
  await pg.exec('RESET ROLE');
  assert.equal((await pg.query("SELECT count(*)::int n FROM inventory_equipment WHERE asset_number='BLOCKED'")).rows[0].n,0);
  await pg.exec(`INSERT INTO inventory_equipment(department_id,apparatus_id,compartment_id,name) SELECT '${dept}','${rig}','${location}','Fictional ordinary equipment '||n FROM generate_series(1,3000) n; ANALYZE inventory_equipment;`);
  const plan=(await pg.query('EXPLAIN SELECT id FROM inventory_equipment WHERE department_id=$1 AND apparatus_id=$2 AND scba_asset_kind IS NOT NULL AND retired_at IS NULL',[dept,rig])).rows;
  assert.match(JSON.stringify(plan),/inventory_air_location/);
 }finally{await pg.close();}
});
