import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';

const migration=await readFile(new URL('../supabase/migrations/20261030165652_weekly_meter_checks.sql',import.meta.url),'utf8');
const existing=await readFile(new URL('../supabase/migrations/20260908033045_inventory_atomic_item_result.sql',import.meta.url),'utf8');
const compiled=ts.transpileModule(await readFile(new URL('../app/inventory-meter-model.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const model=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const ids={dept:'00000000-0000-4000-8000-000000000001',other:'00000000-0000-4000-8000-000000000002',rig3:'00000000-0000-4000-8000-000000000003',rig4:'00000000-0000-4000-8000-000000000004',equip3:'00000000-0000-4000-8000-000000000013',equip4:'00000000-0000-4000-8000-000000000014',check3:'00000000-0000-4000-8000-000000000023',check4:'00000000-0000-4000-8000-000000000024',history:'00000000-0000-4000-8000-000000000025',daily:'00000000-0000-4000-8000-000000000026',photo:'00000000-0000-4000-8000-000000000031'};
const passing=()=>({...model.emptyMeterResponse(),inspectionDate:'2026-01-01',meterId:'M1',batteryCharge:'yes',stationLights:['green'],actions:['bumped'],endOfLife:'none',sensitOperational:'yes',sensitLowBattery:'no',memberName:'Fixture Firefighter'});
async function setup(t) {
  const pg=new PGlite();t.after(()=>pg.close());
  await pg.exec(`create role authenticated;create schema auth;create schema private;
    create function auth.uid() returns uuid language sql as $$ select '00000000-0000-4000-8000-000000000099'::uuid $$;
    create function auth.jwt() returns jsonb language sql as $$ select '{"email":"fixture@example.test"}'::jsonb $$;
    create function private.inventory_can_write(d uuid) returns boolean language sql as $$ select d='${ids.dept}'::uuid and coalesce(current_setting('fixture.write',true),'true')<>'false' $$;
    create function private.inventory_can_admin(d uuid) returns boolean language sql as $$ select d='${ids.dept}'::uuid and coalesce(current_setting('fixture.admin',true),'true')<>'false' $$;
    create table departments(id uuid primary key,name text);
    create table inventory_apparatus_profiles(id uuid primary key,department_id uuid,name text);
    create table inventory_equipment(id uuid primary key,department_id uuid,apparatus_id uuid,name text,source_key text,check_types text[],retired_at timestamptz,response_type text default 'pass_fail',equipment_category text default 'equipment',serial_number text,quantity_required int default 1);
    create table inventory_checks(id uuid primary key,department_id uuid,apparatus_id uuid,check_type text,status text,completed_at timestamptz,review_status text,reviewed_by text,reviewed_at timestamptz,review_notes text);
    create table inventory_check_items(id uuid primary key default gen_random_uuid(),department_id uuid,check_id uuid,equipment_id uuid,result text,notes text,numeric_reading numeric,checked_by text,checked_at timestamptz,unique(check_id,equipment_id));
    create table inventory_scba_check_entries(id uuid,department_id uuid,check_id uuid,result text);
    create table inventory_deficiency_photos(id uuid primary key,department_id uuid,apparatus_id uuid,check_item_id uuid);
    create table inventory_readiness_exceptions(id uuid primary key default gen_random_uuid(),department_id uuid,apparatus_id uuid,equipment_id uuid,check_item_id uuid,result text,priority text,notes text,status text,out_of_service boolean,opened_by text,issue_categories text[],assigned_employee_ids text[],assigned_employee_names text[],evidence_photo_id uuid);
    create table inventory_work_orders(id uuid primary key default gen_random_uuid(),department_id uuid,apparatus_id uuid,equipment_id uuid,linked_exception_id uuid,status text,priority text,summary text,details text,assigned_to text,assigned_employee_ids text[],assigned_employee_names text[],opened_by text);
    insert into departments values ('${ids.dept}','Stickney Fire Department'),('${ids.other}','Other Department');
    insert into inventory_apparatus_profiles values ('${ids.rig3}','${ids.dept}','1203'),('${ids.rig4}','${ids.dept}','1204');
    insert into inventory_equipment(id,department_id,apparatus_id,name,source_key,check_types,serial_number) values
      ('${ids.equip3}','${ids.dept}','${ids.rig3}','5 gas meter (fully charged)','frontline-251-023',array['inventory'],'EXISTING-3'),
      ('${ids.equip4}','${ids.dept}','${ids.rig4}','5 gas meter (fully charged)','form-439-023',array['inventory'],'EXISTING-4');
    insert into inventory_checks(id,department_id,apparatus_id,check_type,status) values
      ('${ids.check3}','${ids.dept}','${ids.rig3}','weekly','in_progress'),('${ids.check4}','${ids.dept}','${ids.rig4}','weekly','in_progress'),
      ('${ids.history}','${ids.dept}','${ids.rig3}','weekly','completed'),('${ids.daily}','${ids.dept}','${ids.rig3}','daily','in_progress');
    insert into inventory_check_items(department_id,check_id,equipment_id,result,notes) values
      ('${ids.dept}','${ids.check4}','${ids.equip4}','pending',null),('${ids.dept}','${ids.history}','${ids.equip3}','pass','Original historical reading'),('${ids.dept}','${ids.daily}','${ids.equip3}','pending',null);
  `);
  await pg.exec(existing);await pg.exec(migration);return pg;
}
const row=async(pg,check=ids.check3)=>(await pg.query('select * from inventory_check_items where check_id=$1',[check])).rows[0];
async function save(pg,response,{complete=true,version=0,photo=null,item=null,dept=ids.dept}={}) {
  item ||= (await row(pg)).id;
  return (await pg.query('select inventory_save_meter_atomic($1,$2,$3,$4,$5,$6,$7) saved',[dept,item,JSON.stringify(response),version,complete,model.meterSummary(response),photo])).rows[0].saved.checkItems[0];
}
test('source fields start unanswered and identify every observed MSA or Sensit issue',()=>{
  assert.ok(model.meterErrors(model.emptyMeterResponse(),'2026-10-30').length>=8);
  assert.deepEqual(model.meterErrors(passing(),'2026-10-30'),[]);
  assert.ok(model.meterErrors({...passing(),inspectionDate:'2026-02-30'},'2026-10-30').length);
  assert.ok(model.meterErrors({...passing(),inspectionDate:'2099-01-01'},'2026-10-30').length);
  const failed={...passing(),sensitLowBattery:'yes',notes:'Observed low battery'};
  assert.match(model.meterIssues(failed).join(' '),/Sensit low battery/);
  assert.match(model.meterSummary(failed),/Member performing check: Fixture Firefighter/);
  assert.doesNotMatch(model.meterSummary(failed),/null|\[object Object\]/);
});
test('migration preserves original assets and completed/daily results while adding only pending weekly snapshots',async t=>{
  const pg=await setup(t);
  const equipment=(await pg.query('select * from inventory_equipment order by id')).rows;
  assert.equal(equipment.length,2);assert.equal(equipment[0].serial_number,'EXISTING-3');assert.deepEqual(equipment[0].check_types,['inventory','weekly']);
  assert.equal((await row(pg,ids.history)).notes,'Original historical reading');assert.equal((await row(pg,ids.history)).meter_template,null);assert.equal((await row(pg,ids.daily)).meter_template,null);
  assert.ok((await row(pg)).meter_template);assert.ok((await row(pg,ids.check4)).meter_template);assert.equal((await row(pg)).result,'pending');
});
test('draft persists unanswered fields, blocks submission, and cannot be bypassed by generic Pass or N/A',async t=>{
  const pg=await setup(t);const first=await save(pg,{...model.emptyMeterResponse(),meterId:'M2'},{complete:false});
  assert.equal(first.result,'pending');assert.equal(JSON.parse(first.meter_response).meterId,'M2');assert.equal(first.meter_response_version,1);
  await assert.rejects(pg.query('select inventory_complete_check_atomic($1,$2)',[ids.dept,ids.check3]),/Complete a configured checklist/);
  for(const result of ['pass','not_applicable']) await assert.rejects(pg.query('select inventory_record_item_atomic($1,$2,$3)',[ids.dept,first.id,result]),/required|Record the station|completed meter form/);
  await assert.rejects(pg.query("update inventory_check_items set result='pass' where id=$1",[first.id]),/required/);
});
test('completed form persists native results and audit and supports edits with version conflict protection',async t=>{
  const pg=await setup(t);const saved=await save(pg,passing());assert.equal(saved.result,'pass');assert.equal(saved.checked_by,'fixture@example.test');assert.ok(saved.checked_at);
  await assert.rejects(save(pg,{...passing(),meterId:'M2'}),/Another crew member/);
  const changed=await save(pg,{...passing(),meterId:'M2'},{version:saved.meter_response_version});assert.equal(JSON.parse(changed.meter_response).meterId,'M2');
  await pg.query('select inventory_complete_check_atomic($1,$2)',[ids.dept,ids.check3]);
  await assert.rejects(save(pg,passing(),{version:changed.meter_response_version}),/no longer in progress/);
});
test('contradictory, unknown, invalid date and malformed answers are rejected without changing saved progress',async t=>{
  const pg=await setup(t);
  for(const change of [{stationLights:['green','red']},{actions:['bumped','failed']},{meterId:'M3'},{batteryCharge:'maybe'},{stationLights:['green','green']},{inspectionDate:'2099-01-01'},{inspectionDate:'2026-02-30'},{endOfLife:null},{actions:'bumped'},{invented:'value'}]) await assert.rejects(save(pg,{...passing(),...change}));
  assert.equal((await row(pg)).meter_response,null);assert.equal((await row(pg)).result,'pending');
});
test('issue requires scoped photo and comments, creates one native repair, and failed transaction retains the draft',async t=>{
  const pg=await setup(t);const response={...passing(),sensitOperational:'no',notes:'Sensit did not power on.'};
  await assert.rejects(save(pg,response),/photo/);assert.equal((await row(pg)).meter_response,null);
  const item=await row(pg);await pg.query('insert into inventory_deficiency_photos values($1,$2,$3,$4)',[ids.photo,ids.dept,ids.rig4,item.id]);
  await assert.rejects(save(pg,response,{photo:ids.photo}),/photo/);
  await pg.query('update inventory_deficiency_photos set apparatus_id=$1 where id=$2',[ids.rig3,ids.photo]);
  const saved=await save(pg,response,{photo:ids.photo});assert.equal(saved.result,'failed');
  const repair=(await pg.query('select * from inventory_work_orders')).rows[0];assert.equal(repair.summary,'Weekly meter inspection needs attention');assert.match(repair.details,/Sensit did not power on/);
  await save(pg,{...response,notes:'Confirmed Sensit would not start.'},{version:saved.meter_response_version});
  assert.equal((await pg.query('select count(*)::int n from inventory_work_orders')).rows[0].n,1);
});
test('templates keep fixed source questions, preserve prior snapshots, and require department admin permission',async t=>{
  const pg=await setup(t);const before=await row(pg);
  await pg.query('select inventory_save_meter_template($1,$2,1,$3,$4)',[ids.dept,ids.equip3,'Weekly meter readiness','Department instructions']);
  assert.equal((await row(pg)).meter_template,before.meter_template);
  await assert.rejects(pg.query("update inventory_check_items set meter_template='{}' where id=$1",[before.id]),/snapshot cannot change/);
  await assert.rejects(pg.query('select inventory_save_meter_template($1,$2,1,$3,$4)',[ids.dept,ids.equip3,'Stale','Stale']),/template changed/);
  await pg.exec("set fixture.admin='false'");
  await assert.rejects(pg.query('select inventory_save_meter_template($1,$2,2,$3,$4)',[ids.dept,ids.equip3,'No','No']),/permission required/);
  await assert.rejects(save(pg,passing(),{dept:ids.other}),/permission required/);
  await pg.exec("set fixture.write='false'");await assert.rejects(save(pg,passing()),/permission required/);
});

const routeCode=ts.transpileModule(await readFile(new URL('../app/api/operations/meters/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function api(options={}) {
  const calls=[];const permissions=[];
  const imports={
    '../../../inventory-meter-model':model,
    '../../../lib/supabase-server':{createInventorySupabaseClient:async()=>({rpc:async(name,args)=>{calls.push({name,args});return options.error?{error:options.error}:{data:options.missing?{}:name==='inventory_save_meter_template'?{id:args.p_equipment_id}:{saved:true,checkItems:[{id:args.p_item_id}]}};}})},
    '../../../lib/inventory-session':{verifyInventoryRequest:async()=>options.anonymous?{ok:false,status:401}:{ok:true,context:{department:{id:ids.dept}}},sessionFailureResponse:session=>Response.json({}, {status:session.status}),sameOriginInventoryRequest:()=>!options.crossOrigin,canMutateInventory:(_context,permission)=>{permissions.push(permission);return !options.denied;}}
  };
  const exports={};new Function('require','exports',routeCode)(name=>{assert.ok(imports[name],name);return imports[name];},exports);
  return {calls,permissions,post:body=>exports.POST(new Request('https://fixture.example.test/api/operations/meters',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}))};
}
const body=()=>({action:'save_response',id:ids.equip3,version:0,complete:true,response:passing(),departmentId:ids.other});
test('meter API enforces verified tenant, permission and origin, and preserves original answers for database validation',async()=>{
  for (const [options,status] of [[{anonymous:true},401],[{denied:true},403],[{crossOrigin:true},403]]) {const h=api(options);assert.equal((await h.post(body())).status,status);assert.equal(h.calls.length,0);}
  const h=api();assert.equal((await h.post(body())).status,200);assert.equal(h.calls[0].args.p_department_id,ids.dept);assert.deepEqual(h.permissions,['inventory.check']);assert.match(h.calls[0].args.p_notes,/MSA Altair 5 identification: M1/);
  const template=api();assert.equal((await template.post({action:'save_template',id:ids.equip3,version:1,title:'Weekly meter check',instructions:'Fixture instructions'})).status,200);assert.deepEqual(template.permissions,['inventory.setup.manage']);
});
test('meter API distinguishes conflicts and failed confirmations and rejects incomplete or invalid requests',async()=>{
  for(const [code,status] of [['40001',409],['42501',403],['P0001',400]]) {const h=api({error:{code,message:'Fixture rejection'}});assert.equal((await h.post(body())).status,status);}
  assert.equal((await api({missing:true}).post(body())).status,503);
  for(const change of [{version:-1},{id:'not-a-record'},{complete:'yes'},{response:model.emptyMeterResponse()}]){const h=api();assert.equal((await h.post({...body(),...change})).status,400);assert.equal(h.calls.length,0);}
});
