import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {drugErrors,drugIssues,drugResponse,drugSchema,drugSummary,emptyDrugResponse} from '../app/inventory-drug-model.ts';

const migration=await readFile(new URL('../supabase/migrations/20261101025458_daily_drug_inventory_checks.sql',import.meta.url),'utf8');
const atomic=await readFile(new URL('../supabase/migrations/20260908033045_inventory_atomic_item_result.sql',import.meta.url),'utf8');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const dept=id(1),rig=id(2),place=id(3),equipment=id(4),check=id(5),item=id(6),photo=id(7),other=id(8),legacy=id(9);
const schema={version:1,title:'Fixture Albuterol',mode:'medication',expectedQuantity:2,location:'1205 · Jump Bag'};
const valid=()=>({...emptyDrugResponse(),condition:'satisfactory',count:'2',expirations:['2030-01-01','2031-01-01'],locations:[schema.location,schema.location]});
async function setup(t){
 const pg=new PGlite();t.after(()=>pg.close());
 await pg.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE SCHEMA auth;CREATE SCHEMA private;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '${id(99)}'::uuid$$;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$SELECT '{"email":"fixture@example.test"}'::jsonb$$;
 CREATE FUNCTION private.inventory_can_write(d uuid) RETURNS boolean LANGUAGE sql AS $$SELECT d='${dept}'::uuid AND COALESCE(current_setting('fixture.allowed',true),'yes')<>'no'$$;
 CREATE TABLE inventory_apparatus_profiles(id uuid PRIMARY KEY,department_id uuid,name text);
 CREATE TABLE inventory_compartments(id uuid PRIMARY KEY,department_id uuid,apparatus_id uuid,label text);
 CREATE TABLE inventory_equipment(id uuid PRIMARY KEY,department_id uuid,apparatus_id uuid,compartment_id uuid,name text,quantity_required int,response_type text CONSTRAINT inventory_equipment_response_type_check CHECK(response_type IN ('pass_fail','quantity','expiration_date','numeric','mileage','text')),equipment_category text);
 CREATE TABLE inventory_checks(id uuid PRIMARY KEY,department_id uuid,apparatus_id uuid,check_type text CONSTRAINT inventory_checks_check_type_check CHECK(check_type IN ('daily','weekly','inventory','air_pack')),status text,completed_at timestamptz,review_status text,reviewed_by text,reviewed_at timestamptz,review_notes text);
 CREATE TABLE inventory_inspection_schedules(id uuid,check_type text CONSTRAINT inventory_inspection_schedules_check_type_check CHECK(check_type IN ('daily','weekly','inventory','air_pack')));
 CREATE TABLE inventory_check_items(id uuid PRIMARY KEY,department_id uuid,check_id uuid,equipment_id uuid,result text,notes text,numeric_reading numeric,checked_by text,checked_at timestamptz);
 CREATE TABLE inventory_scba_check_entries(id uuid,department_id uuid,check_id uuid,result text);
 CREATE TABLE inventory_deficiency_photos(id uuid PRIMARY KEY,department_id uuid,apparatus_id uuid,check_item_id uuid);
 CREATE TABLE inventory_readiness_exceptions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),department_id uuid,apparatus_id uuid,equipment_id uuid,check_item_id uuid,result text,priority text,notes text,status text,out_of_service boolean,opened_by text,issue_categories text[],assigned_employee_ids text[],assigned_employee_names text[],evidence_photo_id uuid);
 CREATE TABLE inventory_work_orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),department_id uuid,apparatus_id uuid,equipment_id uuid,linked_exception_id uuid,status text,priority text,summary text,details text,assigned_to text,assigned_employee_ids text[],assigned_employee_names text[],opened_by text);
 INSERT INTO inventory_apparatus_profiles VALUES('${rig}','${dept}','1205');
 INSERT INTO inventory_compartments VALUES('${place}','${dept}','${rig}','Jump Bag');
 INSERT INTO inventory_equipment VALUES('${equipment}','${dept}','${rig}','${place}','Fixture Albuterol',2,'pass_fail','equipment');
 INSERT INTO inventory_checks(id,department_id,apparatus_id,check_type,status) VALUES('${legacy}','${dept}','${rig}','daily','completed');
 INSERT INTO inventory_check_items(id,department_id,check_id,equipment_id,result,notes) VALUES('${legacy}','${dept}','${legacy}','${equipment}','pass','Original observation');`);
 await pg.exec(atomic);await pg.exec(migration);
 await pg.exec(`UPDATE inventory_equipment SET response_type='medication';INSERT INTO inventory_checks(id,department_id,apparatus_id,check_type,status) VALUES('${check}','${dept}','${rig}','drug','in_progress');INSERT INTO inventory_check_items(id,department_id,check_id,equipment_id,result) VALUES('${item}','${dept}','${check}','${equipment}','pending');INSERT INTO inventory_deficiency_photos VALUES('${photo}','${dept}','${rig}','${item}');`);
 return pg;
}
const savedRow=async pg=>(await pg.query('SELECT * FROM inventory_check_items WHERE id=$1',[item])).rows[0];
const save=async(pg,response,{complete=true,version=0,evidence=null,department=dept}={})=>(await pg.query('SELECT inventory_save_drug_atomic($1,$2,$3,$4,$5,$6) saved',[department,item,JSON.stringify(response),version,complete,evidence])).rows[0].saved;

test('source-based medication logging starts blank and retains each container date and observed location',()=>{
 assert.ok(drugErrors(schema,emptyDrugResponse(),'2026-10-31').length);
 assert.deepEqual(drugErrors(schema,valid(),'2026-10-31'),[]);
 assert.match(drugSummary(schema,valid()),/2030-01-01/);assert.match(drugSummary(schema,valid()),/2031-01-01/);
 assert.equal(drugResponse(null).count,'');assert.equal(drugSchema(JSON.stringify(schema)).mode,'medication');
 assert.equal(drugSchema('{}'),null);
 assert.ok(drugErrors(schema,{...valid(),expirations:['2026-02-30','2030-01-01']},'2026-10-31').length);
 assert.match(drugIssues(schema,{...valid(),locations:[schema.location,'Another rig']},'2026-10-31').join(' '),/different location/);
});
test('migration preserves original observations; new items snapshot logging format and resist template changes',async t=>{
 const pg=await setup(t);assert.equal((await pg.query('SELECT notes FROM inventory_check_items WHERE id=$1',[legacy])).rows[0].notes,'Original observation');
 const before=await savedRow(pg);assert.deepEqual(JSON.parse(before.drug_schema),schema);
 await pg.exec("UPDATE inventory_equipment SET response_type='text',quantity_required=5,name='Edited future template'");
 assert.equal((await savedRow(pg)).drug_schema,before.drug_schema);
 await assert.rejects(pg.query('UPDATE inventory_check_items SET drug_schema=$1 WHERE id=$2',[JSON.stringify({...schema,mode:'text'}),item]),/cannot change/);
 const saved=await save(pg,valid());assert.equal(saved.checkItems[0].result,'pass');assert.match(saved.checkItems[0].notes,/2031-01-01/);
 assert.equal((await pg.query('SELECT inventory_complete_check_atomic($1,$2) saved',[dept,check])).rows[0].saved.completed,true);
 await assert.rejects(save(pg,valid(),{version:saved.checkItems[0].drug_response_version}),/no longer in progress/);
});
test('drafts stay pending, invalid or stale entries never overwrite observations, and generic pass cannot bypass required fields',async t=>{
 const pg=await setup(t);const draft=(await save(pg,{...emptyDrugResponse(),count:'1'},{complete:false})).checkItems[0];assert.equal(draft.result,'pending');assert.equal(draft.drug_response_version,1);
 await assert.rejects(save(pg,valid()),/Another crew member/);
 await assert.rejects(pg.query("SELECT inventory_record_item_atomic($1,$2,'pass')",[dept,item]),/Choose the observed result/);
 await assert.rejects(pg.query('SELECT inventory_complete_check_atomic($1,$2)',[dept,check]),/Complete a configured checklist/);
 for(const response of [{...valid(),expirations:['bad','2030-01-01']},{...valid(),count:'-1'},{...valid(),locations:[]},{...valid(),condition:'not_applicable',notes:''},{...valid(),forged:'field'}])await assert.rejects(save(pg,response,{version:1}));
 assert.equal((await savedRow(pg)).drug_response,draft.drug_response);
});
test('expired, missing, or unverified stock requires evidence and creates one linked finding and repair on retry',async t=>{
 const pg=await setup(t);const response={...valid(),expirations:['2000-01-01','unknown'],notes:'Fixture expired label and unreadable second label'};
 await assert.rejects(save(pg,response),/Attach a photo/);
 const row=(await save(pg,response,{evidence:photo})).checkItems[0];assert.equal(row.result,'failed');
 const again=(await save(pg,response,{evidence:photo,version:row.drug_response_version})).checkItems[0];assert.equal(again.result,'failed');
 assert.equal((await pg.query('SELECT count(*)::int n FROM inventory_readiness_exceptions')).rows[0].n,1);assert.equal((await pg.query('SELECT count(*)::int n FROM inventory_work_orders')).rows[0].n,1);
 assert.match(again.notes,/Unable to verify/);assert.doesNotMatch(again.notes,/null|\[object Object\]/);
 await pg.query("UPDATE inventory_checks SET status='completed' WHERE id=$1",[check]);
 await assert.rejects(pg.query("UPDATE inventory_check_items SET notes='Cannot edit' WHERE id=$1",[item]),/cannot move or change|no longer in progress/);
});
test('every editable logging method validates against the original snapshot and the current server date',async t=>{
 const pg=await setup(t);
 const cases=[['medication',valid(),'pass'],['pass_fail',{...emptyDrugResponse(),condition:'satisfactory'},'pass'],['quantity',{...emptyDrugResponse(),condition:'satisfactory',count:'2'},'pass'],['expiration_date',{...emptyDrugResponse(),condition:'satisfactory',value:'2030-01-01'},'pass'],['numeric',{...emptyDrugResponse(),condition:'satisfactory',value:'1.5'},'pass'],['mileage',{...emptyDrugResponse(),condition:'satisfactory',value:'2000'},'pass'],['text',{...emptyDrugResponse(),condition:'satisfactory',value:'Observed fixture note'},'pass']];
 for(const [mode,response,outcome] of cases){const s={...schema,mode};assert.deepEqual(drugErrors(s,response,'2026-10-31'),[]);assert.equal((await pg.query('SELECT inventory_drug_outcome($1,$2,true) outcome',[JSON.stringify(s),JSON.stringify(response)])).rows[0].outcome,outcome);}
 await assert.rejects(save(pg,valid(),{department:other}),/permission/);
 await pg.exec("SET fixture.allowed='no'");await assert.rejects(save(pg,valid()),/permission/);
 const security=(await pg.query("SELECT prosecdef,has_function_privilege('anon',oid,'EXECUTE') anonymous FROM pg_proc WHERE proname='inventory_save_drug_atomic'")).rows[0];assert.deepEqual(security,{prosecdef:false,anonymous:false});
});
test('the actual invoker save runs under the authenticated role with department RLS intact',async t=>{
 const pg=await setup(t);
 await pg.exec(`GRANT USAGE ON SCHEMA public,auth,private TO authenticated;GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;REVOKE ALL ON FUNCTION private.inventory_can_write(uuid) FROM PUBLIC;GRANT EXECUTE ON FUNCTION private.inventory_can_write(uuid) TO authenticated;
 ALTER TABLE inventory_check_items ENABLE ROW LEVEL SECURITY;CREATE POLICY department_items ON inventory_check_items TO authenticated USING(department_id='${dept}'::uuid) WITH CHECK(department_id='${dept}'::uuid);SET ROLE authenticated;`);
 const row=(await save(pg,valid())).checkItems[0];assert.equal(row.result,'pass');assert.equal(row.checked_by,'fixture@example.test');
 await assert.rejects(save(pg,valid(),{department:other}),/permission/);await pg.exec('RESET ROLE');
 assert.equal((await pg.query("SELECT relrowsecurity FROM pg_class WHERE oid='inventory_check_items'::regclass")).rows[0].relrowsecurity,true);
});
