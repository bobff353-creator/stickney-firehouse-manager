import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {trainingHarness} from './helpers/training-harness.mjs';
import {trainingModules} from './helpers/training-modules.mjs';
import {serviceInput,recordedHydrantFlow,operationalNotes,hydrantBodyColor} from '../app/preplans/field-workspace-data.ts';
import {prepareFieldReconciliation} from '../scripts/reconcile-field-preplans.mjs';

const nativeSql=`CREATE FUNCTION firehouse.has_department_access() RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
CREATE TABLE field_preplans(id text PRIMARY KEY,business_name text DEFAULT '',address text DEFAULT '',latitude double precision,longitude double precision,a_side_latitude double precision,a_side_longitude double precision,footprint text DEFAULT '',footprint_square_feet double precision,floor_count int,construction_type text DEFAULT '',occupancy_flow_category text DEFAULT '',sprinkler_standard text DEFAULT '',access_info text DEFAULT '',construction text DEFAULT '',contact_info text DEFAULT '',alarm_system text DEFAULT '',knox_box text DEFAULT '',riser text DEFAULT '',fdc text DEFAULT '',sprinkler_system text DEFAULT '',status text DEFAULT '',publication_status text DEFAULT '',completeness_status text DEFAULT '',construction_profile text DEFAULT '',occupancy_profile text DEFAULT '',target_hazard_level text DEFAULT '',created_by text DEFAULT '',updated_by text DEFAULT '',created_at text DEFAULT '',updated_at text DEFAULT '');
CREATE TABLE field_preplan_imports(id text PRIMARY KEY,linked_preplan_id text DEFAULT '',status text);
CREATE TABLE field_hydrants(id text PRIMARY KEY,service_status text);
INSERT INTO field_preplans(id,business_name,address,publication_status,created_by) VALUES('native-building','Fixture old building','1 Fixture Way','published','owner@example.invalid');
INSERT INTO field_hydrants VALUES('hydrant-fixture','out_of_service'),('archived-fixture','archived');`;
async function setup(){
 const h=await trainingHarness();await h.pg.exec(nativeSql);await h.pg.exec(readFileSync(resolve('supabase/migrations/20261118021500_field_workspace_integration.sql'),'utf8'));
 await h.pg.exec("CREATE SCHEMA IF NOT EXISTS private;CREATE OR REPLACE FUNCTION private.portal_server_request() RETURNS boolean LANGUAGE sql AS $$SELECT COALESCE(current_setting('fixture.portal_signed',true),'true')='true'$$;GRANT USAGE ON SCHEMA firehouse,private TO authenticated;");
 await h.pg.exec(readFileSync(resolve('supabase/migrations/20261118024000_field_workspace_server_boundary.sql'),'utf8'));
 let allowed=true;
 const modules=trainingModules({[resolve('db/bootstrap.ts')]:{ensureDatabase:async()=>h.db},[resolve('app/server-permissions.ts')]:{hasPermission:async()=>allowed,canReadPreplanLifecycle:()=>true,preplanReadAccess:async()=>({})},[resolve('app/portal-storage.ts')]:{getPortalStorage:()=>({put:async()=>{},delete:async()=>{}})}});
 const service=modules('app/api/field-hydrants/service/route.ts'),quick=modules('app/api/field-preplans/quick/route.ts'),observations=modules('app/api/field-preplans/observations/route.ts');
 const request=(path,payload,origin='https://fixture.invalid')=>new Request('https://fixture.invalid'+path,{method:'POST',headers:{origin,'content-type':'application/json','oai-authenticated-user-email':'owner@example.invalid'},body:JSON.stringify(payload)});
 return {...h,service,quick,observations,request,deny:()=>{allowed=false;}};
}
test('additive migration enables department RLS and has no anonymous table access',async()=>{
 const h=await setup();try{const rows=await h.pg.query("SELECT relname,relrowsecurity FROM pg_class JOIN pg_namespace n ON n.oid=relnamespace WHERE n.nspname='firehouse' AND relname IN ('field_preplan_external_details','field_hydrant_service_events','field_preplan_observations')");assert.equal(rows.rows.length,3);assert.ok(rows.rows.every(r=>r.relrowsecurity));assert.equal((await h.pg.query("SELECT has_table_privilege('anon','firehouse.field_preplan_observations','select') granted")).rows[0].granted,false);}finally{await h.close();}
});
test('maintenance and flow saves are idempotent, preserve status, and reject conflicting retries',async()=>{
 const h=await setup();try{const payload={id:'service-fixture-1',hydrantId:'hydrant-fixture',kind:'maintenance',performedOn:'2025-01-01',notes:'Repair drop pipe; do not alter status.'};
  for(let i=0;i<2;i++)assert.equal((await h.service.POST(h.request('/api/field-hydrants/service',payload))).status,200);
  assert.equal((await h.pg.query('SELECT count(*)::int n FROM field_hydrant_service_events')).rows[0].n,1);
  assert.equal((await h.pg.query("SELECT service_status FROM field_hydrants WHERE id='hydrant-fixture'")).rows[0].service_status,'out_of_service');
  assert.equal((await h.service.POST(h.request('/api/field-hydrants/service',{...payload,notes:'Different work'}))).status,409);
  assert.equal((await h.service.POST(h.request('/api/field-hydrants/service',{...payload,id:'service-fixture-2',kind:'flow',flowGpm:1250}))).status,200);
  const list=await(await h.service.GET(new Request('https://fixture.invalid/api/field-hydrants/service?hydrantId=hydrant-fixture'))).json();assert.equal(list.events.length,2);
 }finally{await h.close();}
});
test('an authenticated direct client without the signed portal proof cannot read or write new tables',async()=>{
 const h=await setup();try{
  await h.pg.exec("INSERT INTO field_preplan_observations(id,address,note,priority,actor,created_at) VALUES('fixture-note-private','Fixture only','Private fixture note','routine','fixture','2025-01-01');SET fixture.portal_signed='false';SET ROLE authenticated;");
  assert.equal((await h.pg.query('SELECT count(*)::int n FROM firehouse.field_preplan_observations')).rows[0].n,0);
  await assert.rejects(()=>h.pg.exec("INSERT INTO firehouse.field_preplan_observations(id,address,note,priority,actor,created_at) VALUES('blocked-fixture','Fixture','Denied','routine','fixture','2025-01-01')"),/row-level security/);
  await h.pg.exec('RESET ROLE');assert.equal((await h.pg.query('SELECT count(*)::int n FROM firehouse.field_preplan_observations')).rows[0].n,1);
 }finally{await h.close();}
});
test('missing, archived, unauthorized and cross-origin hydrant writes cannot create service history',async()=>{
 const h=await setup();try{const p={id:'service-denied-1',hydrantId:'archived-fixture',kind:'flow',performedOn:'2025-01-01',flowGpm:1000};
  assert.equal((await h.service.POST(h.request('/api/field-hydrants/service',p))).status,409);
  assert.equal((await h.service.POST(h.request('/api/field-hydrants/service',{...p,hydrantId:'missing'}))).status,404);
  assert.equal((await h.service.POST(h.request('/api/field-hydrants/service',{...p,hydrantId:'hydrant-fixture'},'https://other.invalid'))).status,403);
  h.deny();assert.equal((await h.service.POST(h.request('/api/field-hydrants/service',p))).status,403);assert.equal((await h.pg.query('SELECT count(*)::int n FROM field_hydrant_service_events')).rows[0].n,0);
 }finally{await h.close();}
});
test('quick capture saves a draft without inventing a footprint or replacing the published record',async()=>{
 const h=await setup();try{const original=(await h.pg.query("SELECT * FROM field_preplans WHERE id='native-building'")).rows[0];const p={id:'quick-fixture-1',businessName:'Fixture New',address:'2 Fixture Way',latitude:41.8,longitude:-87.8,locationConfirmed:true,floorCount:0,alarmSystem:'Unknown'};
  for(let i=0;i<2;i++)assert.equal((await h.quick.POST(h.request('/api/field-preplans/quick',p))).status,200);
  const saved=(await h.pg.query("SELECT * FROM field_preplans WHERE id='quick-fixture-1'")).rows[0];assert.equal(saved.footprint,'[]');assert.equal(saved.publication_status,'draft');assert.equal(saved.floor_count,0);assert.equal(saved.construction_type,'unknown');
  assert.equal((await h.quick.POST(h.request('/api/field-preplans/quick',{...p,accessInfo:'Changed after an uncertain save'}))).status,409);
  assert.deepEqual((await h.pg.query("SELECT * FROM field_preplans WHERE id='native-building'")).rows[0],original);
  const duplicate=await h.quick.POST(h.request('/api/field-preplans/quick',{...p,id:'quick-fixture-2'}));assert.equal(duplicate.status,409);assert.equal((await duplicate.json()).existingId,p.id);
  assert.equal((await h.pg.query('SELECT count(*)::int n FROM field_preplans')).rows[0].n,2);
 }finally{await h.close();}
});
test('quick capture rejects unconfirmed and invalid positions and denied sessions',async()=>{
 const h=await setup();try{const p={id:'quick-fixture-bad',businessName:'Fixture',address:'3 Fixture Way',latitude:41.8,longitude:-87.8,floorCount:1,locationConfirmed:false};assert.equal((await h.quick.POST(h.request('/api/field-preplans/quick',p))).status,400);assert.equal((await h.quick.POST(h.request('/api/field-preplans/quick',{...p,locationConfirmed:true,latitude:999}))).status,400);h.deny();assert.equal((await h.quick.POST(h.request('/api/field-preplans/quick',p))).status,403);}finally{await h.close();}
});
test('call observations save separately with retry protection and never mutate the approved preplan',async()=>{
 const h=await setup();try{const before=(await h.pg.query("SELECT * FROM field_preplans WHERE id='native-building'")).rows[0];function request(note='Rear access blocked'){const form=new FormData();for(const[k,v]of Object.entries({id:'note-fixture-001',preplanId:'native-building',address:'1 Fixture Way',note,priority:'urgent'}))form.set(k,v);return new Request('https://fixture.invalid/api/field-preplans/observations',{method:'POST',headers:{origin:'https://fixture.invalid','oai-authenticated-user-email':'owner@example.invalid'},body:form});}
  for(let i=0;i<2;i++)assert.equal((await h.observations.POST(request())).status,200);assert.equal((await h.observations.POST(request('Changed'))).status,409);assert.equal((await h.pg.query('SELECT count(*)::int n FROM field_preplan_observations')).rows[0].n,1);assert.deepEqual((await h.pg.query("SELECT * FROM field_preplans WHERE id='native-building'")).rows[0],before);
 }finally{await h.close();}
});
test('invalid work dates, blank maintenance, zero and nonfinite flow fail validation',()=>{
 const p={id:'service-fixture-1',hydrantId:'fixture',kind:'flow',performedOn:'2025-01-01',flowGpm:1250};assert.equal(serviceInput(p).flowGpm,1250);for(const patch of [{flowGpm:0},{flowGpm:Infinity},{performedOn:'2025-02-30'},{performedOn:'9999-01-01'},{kind:'maintenance',notes:''}])assert.throws(()=>serviceInput({...p,...patch}));
});
test('recorded flow precedence respects later full tests and older backdated updates',()=>{
 const test={testedAt:'2025-06-01',availableFlow:1200};assert.equal(recordedHydrantFlow({reportedFlow:900,reportedFlowDate:null,flowTests:[test]}),1200);assert.equal(recordedHydrantFlow({reportedFlow:900,reportedFlowDate:'2025-05-01',flowTests:[test]}),1200);assert.equal(recordedHydrantFlow({reportedFlow:1500,reportedFlowDate:'2025-07-01',flowTests:[test]}),1500);assert.equal(hydrantBodyColor(null),'#e3bc35');assert.equal(hydrantBodyColor(1000),'#5aaa5c');assert.equal(hydrantBodyColor(2500,true),'#929a9b');
});
test('operational notes remove transfer prose while preserving actual access and repair details',()=>{
 const text='Imported from FlowMSP on 2026-09-02; source export 2026-09-01. Needs field verification. FlowMSP source ID: 0027f5a8-61f9-4e28-b50a-393f66f1010f. Original FlowMSP GPS coordinates retained; the provider-generated address is display-only. FlowMSP reported flow: 619 GPM (ORANGE).\nRear access blocked.\nRear access blocked.';assert.equal(operationalNotes(text),'Rear access blocked.');assert.equal(operationalNotes('FlowMSP source: test imported metadata\nConstruction Type: Masonry'),'Construction Type: Masonry');
});
test('reconciliation rejects foreign or repeated source identities instead of guessing',()=>{
 const before={departmentId:'14a76771-4c24-481b-8def-e6cce005c17b',tables:{field_preplans:[],field_preplan_imports:[],field_preplan_photos:[],field_hydrants:[],field_preplan_assets:[]}};assert.throws(()=>prepareFieldReconciliation(before,{records:[]},[{customerSlug:'other'}],[]));assert.throws(()=>prepareFieldReconciliation(before,{records:[]},[{customerSlug:'stickneyfire',id:'missing'}],[]));
});
