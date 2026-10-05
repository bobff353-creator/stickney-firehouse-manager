import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
const migration=fs.readFileSync(new URL('../supabase/migrations/20261005151249_inventory_phase_two_safe_operations.sql',import.meta.url),'utf8');
const dept='14a76771-4c24-481b-8def-e6cce005c17b';
const foreign='00000000-0000-4000-8000-000000000099';
const user='00000000-0000-4000-8000-000000000002';
const rig='00000000-0000-4000-8000-000000000003';
const equip='00000000-0000-4000-8000-000000000004';
const lot='00000000-0000-4000-8000-000000000005';
const item='00000000-0000-4000-8000-000000000006';
async function setup(){
 const pg=new PGlite();
 await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE SCHEMA private;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '${user}'::uuid$$;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$SELECT '{"email":"preview-only@example.test"}'::jsonb$$;
 CREATE FUNCTION private.inventory_can_access(d uuid) RETURNS boolean LANGUAGE sql AS $$SELECT d='${dept}'::uuid$$;
 CREATE FUNCTION private.inventory_can_write(d uuid) RETURNS boolean LANGUAGE sql AS $$SELECT d='${dept}'::uuid$$;
 CREATE FUNCTION private.portal_server_request() RETURNS boolean LANGUAGE sql AS $$SELECT current_setting('fixture.server',true)='yes'$$;
 CREATE FUNCTION private.portal_has_permission(p text) RETURNS boolean LANGUAGE sql AS $$SELECT p=ANY(string_to_array(current_setting('fixture.permissions',true),','))$$;
 CREATE TABLE public.departments(id uuid PRIMARY KEY);
 INSERT INTO public.departments VALUES('${dept}'),('${foreign}');
 CREATE TABLE public.inventory_apparatus_profiles(id uuid PRIMARY KEY,department_id uuid,name text);
 CREATE TABLE public.inventory_equipment(id uuid PRIMARY KEY,department_id uuid,apparatus_id uuid,retired_at timestamptz,service_status text,updated_at timestamptz);
 CREATE TABLE public.inventory_stock_lots(id uuid PRIMARY KEY,department_id uuid,stock_item_id uuid,quantity_on_hand integer,location_id text);
 CREATE TABLE public.inventory_transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),department_id uuid,stock_item_id uuid,stock_lot_id uuid,transaction_type text,quantity integer,to_location_id text,reason text,performed_by uuid);
 CREATE TABLE public.inventory_deficiency_photos(id uuid PRIMARY KEY,department_id uuid,apparatus_id uuid);
 CREATE TABLE public.inventory_readiness_exceptions(id uuid PRIMARY KEY,department_id uuid,apparatus_id uuid,result text,priority text,notes text,status text,out_of_service boolean,opened_by text,issue_categories text[],assigned_employee_ids text[],assigned_employee_names text[],evidence_photo_id uuid,resolved_at timestamptz,resolved_by text,resolution_notes text);
 CREATE TABLE public.inventory_work_orders(id uuid PRIMARY KEY,department_id uuid,apparatus_id uuid,equipment_id uuid,status text,priority text,summary text,details text,assigned_to text,assigned_employee_ids text[],assigned_employee_names text[],opened_by text,service_type text,odometer integer,linked_exception_id uuid,closed_at timestamptz,repair_date date,repair_cost numeric,vendor text,invoice_number text,resolution_notes text,closed_by text,labor_hours numeric,performed_by text,parts_used text,next_service_due_date date,next_service_due_mileage integer);
 INSERT INTO public.inventory_apparatus_profiles VALUES('${rig}','${dept}','Preview-only apparatus');
 INSERT INTO public.inventory_equipment VALUES('${equip}','${dept}','${rig}',null,'in_service',now());
 INSERT INTO public.inventory_stock_lots VALUES('${lot}','${dept}','${item}',5,'Preview-only station');
 GRANT USAGE ON SCHEMA public,auth,private TO authenticated;
 GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;`);
 for(const table of ['inventory_apparatus_profiles','inventory_equipment','inventory_stock_lots','inventory_transactions','inventory_deficiency_photos','inventory_readiness_exceptions','inventory_work_orders']) {
  await pg.exec(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY; CREATE POLICY tenant ON public.${table} TO authenticated USING(private.inventory_can_access(department_id)) WITH CHECK(private.inventory_can_write(department_id));`);
 }
 await pg.exec(migration);
 await pg.exec("SET fixture.server='yes'; SET fixture.permissions='inventory.check,inventory.repairs.manage'; SET ROLE authenticated;");
 return pg;
}
const save=(pg,action,input,id=randomUUID(),department=dept)=>pg.query('SELECT public.inventory_apply_operation($1,$2,$3,$4) saved',[department,id,action,input]).then(result=>result.rows[0].saved);
const stock={lotId:lot,delta:-1,reason:'Preview-only use'};
const create={apparatusId:rig,equipmentId:equip,summary:'Preview-only repair',serviceType:'repair'};
const close=(id)=>({workOrderId:id,repairDate:'2026-10-05',repairCost:10,resolutionNotes:'Preview-only verified maintenance',serviceType:'repair'});
test('stock retry records one movement and audit; subsequent movement has its own receipt',async()=>{
 const pg=await setup();try{
  const id=randomUUID();assert.equal((await save(pg,'adjust_stock',stock,id)).quantityOnHand,4);
  assert.equal((await save(pg,'adjust_stock',stock,id)).replayed,true);
  assert.equal((await pg.query('SELECT count(*)::int n FROM inventory_transactions')).rows[0].n,1);
  assert.equal((await save(pg,'adjust_stock',stock)).quantityOnHand,3);
  await assert.rejects(save(pg,'adjust_stock',{...stock,delta:-2},id),/different details/);
  const audits=(await pg.query('SELECT quantity,performed_by FROM inventory_transactions')).rows;
  assert.deepEqual(audits.map(row=>row.quantity),[-1,-1]);assert.ok(audits.every(row=>row.performed_by===user));
 }finally{await pg.close();}
});
test('audit failure rolls back stock and receipt; overdraw and fractional counts never clamp silently',async()=>{
 const pg=await setup();try{
  await pg.exec('RESET ROLE; ALTER TABLE inventory_transactions ADD CONSTRAINT simulated_audit_failure CHECK(false); SET ROLE authenticated');
  const id=randomUUID();await assert.rejects(save(pg,'adjust_stock',stock,id),/simulated_audit_failure/);
  assert.equal((await pg.query('SELECT quantity_on_hand n FROM inventory_stock_lots')).rows[0].n,5);
  assert.equal((await pg.query('SELECT count(*)::int n FROM inventory_operation_receipts')).rows[0].n,0);
  await pg.exec('RESET ROLE; ALTER TABLE inventory_transactions DROP CONSTRAINT simulated_audit_failure; SET ROLE authenticated');
  await assert.rejects(save(pg,'adjust_stock',{...stock,delta:-6}),/exceeds the saved quantity/);
  await assert.rejects(save(pg,'adjust_stock',{...stock,delta:1.5}),/whole non-zero/);
  await assert.rejects(save(pg,'adjust_stock',{...stock,reason:''}),/reason/);
  assert.equal((await save(pg,'adjust_stock',stock,id)).quantityOnHand,4);
 }finally{await pg.close();}
});
test('direct repair creation is atomic and retry-safe and preserves an out-of-service asset',async()=>{
 const pg=await setup();try{
  await pg.exec("RESET ROLE; ALTER TABLE inventory_equipment ADD CONSTRAINT simulated_status_failure CHECK(service_status <> 'in_repair'); SET ROLE authenticated");
  const id=randomUUID();await assert.rejects(save(pg,'create_work_order',create,id),/simulated_status_failure/);
  assert.equal((await pg.query('SELECT count(*)::int n FROM inventory_work_orders')).rows[0].n,0);
  await pg.exec("RESET ROLE; ALTER TABLE inventory_equipment DROP CONSTRAINT simulated_status_failure; UPDATE inventory_equipment SET service_status='out_of_service'; SET ROLE authenticated");
  const result=await save(pg,'create_work_order',create,id);await save(pg,'create_work_order',create,id);
  assert.ok(result.workOrder.id);
  assert.equal((await pg.query('SELECT count(*)::int n FROM inventory_work_orders')).rows[0].n,1);
  assert.equal((await pg.query('SELECT service_status FROM inventory_equipment')).rows[0].service_status,'out_of_service');
 }finally{await pg.close();}
});
test('linked notice rollback leaves no orphan and completion retains other defects and service status',async()=>{
 const pg=await setup();try{
  const notice={apparatusId:rig,notes:'Preview-only broken tool',issueCategories:['equipment'],assignedEmployeeIds:['preview-only'],assignedEmployeeNames:['Preview Member']};
  await pg.exec('RESET ROLE; ALTER TABLE inventory_work_orders ADD CONSTRAINT simulated_order_failure CHECK(false); SET ROLE authenticated');
  await assert.rejects(save(pg,'create_notice',notice),/simulated_order_failure/);
  assert.equal((await pg.query('SELECT count(*)::int n FROM inventory_readiness_exceptions')).rows[0].n,0);
  await pg.exec('RESET ROLE; ALTER TABLE inventory_work_orders DROP CONSTRAINT simulated_order_failure; SET ROLE authenticated');
  const saved=await save(pg,'create_notice',notice);
  const second=randomUUID();await pg.query('INSERT INTO inventory_work_orders(id,department_id,apparatus_id,status,linked_exception_id) VALUES($1,$2,$3,$4,$5)',[second,dept,rig,'new',saved.noticeId]);
  const closing=randomUUID();await save(pg,'close_work_order',close(saved.workOrderId),closing);await save(pg,'close_work_order',close(saved.workOrderId),closing);
  assert.equal((await pg.query('SELECT status FROM inventory_readiness_exceptions')).rows[0].status,'open');
  await save(pg,'close_work_order',close(second));
  assert.equal((await pg.query('SELECT status FROM inventory_readiness_exceptions')).rows[0].status,'resolved');
  const direct=await save(pg,'create_work_order',create);await save(pg,'close_work_order',close(direct.workOrder.id));
  assert.equal((await pg.query('SELECT service_status FROM inventory_equipment')).rows[0].service_status,'in_repair','completion never implies verified return to use');
 }finally{await pg.close();}
});
test('completion failure rolls back history and exception resolution',async()=>{
 const pg=await setup();try{
  const saved=await save(pg,'create_notice',{apparatusId:rig,notes:'Preview issue',issueCategories:['vehicle'],assignedEmployeeIds:['preview'],assignedEmployeeNames:[]});
  await pg.exec("RESET ROLE; ALTER TABLE inventory_readiness_exceptions ADD CONSTRAINT simulated_resolution_failure CHECK(status <> 'resolved'); SET ROLE authenticated");
  await assert.rejects(save(pg,'close_work_order',close(saved.workOrderId)),/simulated_resolution_failure/);
  assert.equal((await pg.query('SELECT status FROM inventory_work_orders')).rows[0].status,'new');
 }finally{await pg.close();}
});
test('stale stage changes and completed work cannot be overwritten',async()=>{
 const pg=await setup();try{
  const saved=await save(pg,'create_work_order',create);const id=saved.workOrder.id;
  await save(pg,'update_work_order_status',{workOrderId:id,status:'assigned',expectedStatus:'new'});
  await assert.rejects(save(pg,'update_work_order_status',{workOrderId:id,status:'waiting_parts',expectedStatus:'new'}),/changed since/);
  await save(pg,'close_work_order',close(id));
  await assert.rejects(save(pg,'update_work_order_status',{workOrderId:id,status:'new'}),/no longer open/);
  await assert.rejects(save(pg,'close_work_order',close(id)),/no longer open/);
 }finally{await pg.close();}
});
test('RLS, server boundary, granular permission and foreign department remain enforced',async()=>{
 const pg=await setup();try{
  await assert.rejects(save(pg,'adjust_stock',stock,randomUUID(),foreign),/permission/);
  await assert.rejects(save(pg,'create_work_order',{...create,equipmentId:foreign}),/Active equipment not found/);
  await pg.exec("SET fixture.permissions='inventory.check'");
  await assert.rejects(save(pg,'create_work_order',create),/Permission for this operation/);
  await pg.exec("SET fixture.server='no'");await assert.rejects(save(pg,'adjust_stock',stock),/row-level security/);
  await pg.exec('RESET ROLE');
  const privileges=(await pg.query("SELECT has_function_privilege('anon','public.inventory_apply_operation(uuid,uuid,text,jsonb)','execute') anonymous,(SELECT prosecdef FROM pg_proc WHERE proname='inventory_apply_operation') definer,(SELECT relrowsecurity FROM pg_class WHERE oid='inventory_operation_receipts'::regclass) rls")).rows[0];
  assert.deepEqual(privileges,{anonymous:false,definer:false,rls:true});
 }finally{await pg.close();}
});
