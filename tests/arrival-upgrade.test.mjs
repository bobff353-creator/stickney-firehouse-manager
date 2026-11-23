import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import * as domain from '../app/arrival/lib/preplan.ts';
import * as model from '../app/arrival/lib/native-model.ts';
import * as imports from '../app/arrival/lib/imports.ts';
import * as observations from '../app/arrival/lib/observations.ts';
import * as activity from '../app/arrival/lib/hydrant-activity.ts';
import {sqlLiteral} from '../db/sql-literal.ts';

const require=createRequire(import.meta.url);
function load(path,mocks){const compiledModule={exports:{}};vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{module:compiledModule,exports:compiledModule.exports,require:name=>mocks[name]??require(name),process,Buffer,console,Request,Response,Headers,URL,FormData,File,TextEncoder,TextDecoder,crypto,structuredClone,AbortSignal,Set,Map,Date});return compiledModule.exports;}
const nativeFixture=()=>({id:'10000000-0000-4000-8000-000000000001',businessName:'QA Original Building',address:'100 Training Lane, Stickney, IL',publicationStatus:'published',updatedAt:'2026-11-22T12:00:00Z',updatedBy:'QA',latitude:41.8189,longitude:-87.7734,footprint:[],contactInfo:'Legacy contact notes',construction:'Unknown',accessInfo:'A-side door',floorCount:0,constructionType:'unknown',alarmSystem:'Unknown',knoxBox:'None',riser:'Unknown',fdc:'Unknown',sprinklerSystem:'Unknown',photos:[],features:[]});

test('native conversion preserves identity, unknown facts and all photo references',()=>{
  const native=nativeFixture();native.photos=[{id:'a',side:'A',filename:'front.jpg',caption:'Front'},{id:'a2',side:'A',filename:'front2.png',caption:'Second front'},{id:'feature',side:'FEATURE',featureId:'knox',filename:'equipment.jpg',caption:'Key box'}];
  const original=structuredClone(native),converted=model.toArrival(native,[{id:'doc',filename:'plan.pdf',caption:'Floor plan',contentType:'application/pdf',sizeBytes:10}]);
  assert.deepEqual(native,original);assert.equal(converted.id,native.id);assert.equal(converted.working.floorCount,undefined);assert.equal(converted.working.floors,'');assert.equal(converted.working.basement,'Unknown');assert.equal(converted.working.addressConfirmed,false);assert.equal(converted.working.systems.keybox.answer,'No');assert.equal(converted.working.systems.alarm.answer,'Unknown');
  assert.deepEqual(converted.working.photos.map(p=>[p.id,p.side]),[['native-photo-a','A'],['native-photo-a2','Overview'],['native-photo-feature','Overview'],['native-asset-doc','Plan']]);
  assert.equal(domain.planSchema.safeParse(converted.working).success,true);
});
test('hydrant dates describe the same current flow value shown to crews',()=>{
  const native={id:'hydrant',hydrantNumber:'1',address:'QA',latitude:41.8,longitude:-87.7,serviceStatus:'in_service',reportedFlow:800,reportedFlowDate:'2020-01-01',notes:'',flushes:[],flowTests:[{availableFlow:1500,testedAt:'2026-01-01'}]};
  const current=model.toHydrant(native);assert.equal(current.reportedFlow,1500);assert.equal(current.flowSourceDate,'2026-01-01');assert.equal(current.flowTestDate,'2026-01-01');
});

test('actual migration and API preserve published records, reject conflicts, and enforce review access',async()=>{
  const pg=new PGlite();let permissions=new Set(['field_preplans.view','field_preplans.edit','field_preplans.review','field_preplans.publish','field_preplans.manage_attachments']);
  try{
    await pg.exec(`CREATE SCHEMA firehouse;CREATE SCHEMA private;CREATE ROLE anon;CREATE ROLE authenticated;
      CREATE FUNCTION firehouse.has_department_access() RETURNS boolean LANGUAGE sql AS 'select true';
      CREATE FUNCTION private.portal_server_request() RETURNS boolean LANGUAGE sql AS 'select true';`);
    await pg.exec(readFileSync(new URL('../supabase/migrations/20261123065339_arrival_preplan_upgrade.sql',import.meta.url),'utf8'));
    await pg.exec(`SET search_path=firehouse,public;CREATE TABLE field_preplans(id text primary key,business_name text,address text,access_info text,construction text,alarm_system text,knox_box text,fdc text,sprinkler_system text,updated_by text,updated_at text,publication_status text);
      CREATE TABLE field_preplan_assets(id text,preplan_id text,original_filename text,caption text,mime_type text,file_size integer,archived integer);
      CREATE TABLE field_hydrants(id text,service_status text,updated_by text,updated_at text,reported_flow double precision,reported_flow_date text);`);
    const native=nativeFixture();await pg.query('INSERT INTO field_preplans VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[native.id,native.businessName,native.address,native.accessInfo,native.construction,native.alarmSystem,native.knoxBox,native.fdc,native.sprinklerSystem,native.updatedBy,native.updatedAt,native.publicationStatus]);
    await pg.exec(`ALTER TABLE field_preplans ADD COLUMN construction_profile text DEFAULT '{}';ALTER TABLE field_preplans ADD COLUMN occupancy_profile text DEFAULT '{}';
      CREATE TABLE field_preplan_levels(id text,preplan_id text,name text,archived integer);
      CREATE TABLE field_preplan_alerts(id text,preplan_id text,title text,instructions text,effective_at text,expires_at text,expiration_action text,archived integer);
      CREATE TABLE field_preplan_hazmat(preplan_id text);CREATE TABLE field_preplan_spaces(preplan_id text);CREATE TABLE field_preplan_annotations(preplan_id text);CREATE TABLE field_preplan_hose_lays(preplan_id text);`);
    const department={id:'qa-department',name:'QA department',isolated:false};
    const execute=async(tx,sql,mode)=>{const r=await tx.query(sql);return mode==='all'?r.rows:mode==='first'?(r.rows[0]||null):{success:true,meta:{changes:r.affectedRows||0}};};
    const client={rpc:async(name,args)=>{try{if(name.endsWith('_batch')){const data=await pg.transaction(async tx=>{const values=[];for(const statement of args.p_statements){const value=await execute(tx,statement.sql,statement.mode);if(statement.requiredChanges!==null&&statement.requiredChanges!==undefined&&value.meta?.changes!==statement.requiredChanges)throw Error('Conflict');values.push(value);}return values;});return {data,error:null};}return {data:await execute(pg,args.p_sql,args.p_mode),error:null};}catch(error){return {data:null,error:{message:error.message}};}}};
    const adapter=load('../db/postgres-adapter.ts',{'../app/supabase-server':{getSupabaseServerClient:async()=>client},'../app/department-portal':{getPortalDepartment:async()=>department},'./sql-literal':{sqlLiteral}});
    const db=new adapter.PostgresD1Adapter(async()=>client);
    const server=load('../app/arrival/lib/server.ts',{'../../../db/bootstrap':{ensureDatabase:async()=>db},'../../department-portal':{getPortalDepartment:async()=>department},'../../server-permissions':{permissionsForEmail:async()=>permissions}});
    const nativeGet=async()=>{const row=(await pg.query('SELECT * FROM field_preplans WHERE id=$1',[native.id])).rows[0];return Response.json({preplans:[{...native,businessName:row.business_name,address:row.address,accessInfo:row.access_info,updatedAt:row.updated_at}],imports:[]});};
    const records=load('../app/arrival/lib/native-records.ts',{'../../api/field-preplans/route':{GET:nativeGet},'../../api/field-hydrants/route':{GET:async()=>Response.json({hydrants:[]})},'./native-model':model,'./server':server});
    const route=load('../app/api/arrival/[...path]/route.ts',{'../../../arrival/lib/server':server,'../../../arrival/lib/native-records':records,'../../../arrival/lib/preplan':domain,'../../../arrival/lib/imports':imports,'../../../arrival/lib/observations':observations,'../../../arrival/lib/hydrant-activity':activity,'../../../portal-storage':{getPortalStorage:()=>({})},'../../field-preplans/photos/[photoId]/route':{GET:async()=>new Response(null,{status:404})},'../../field-preplans/assets/[assetId]/route':{GET:async()=>new Response(null,{status:404})},'../../field-preplans/observations/route':{GET:async()=>Response.json({observations:[]})},'../../../upload-security':{isSafePhoto:async()=>true},'../../field-hydrants/service/route':{GET:async()=>Response.json({events:[]})},'../../field-preplans/observations/photo/route':{GET:async()=>new Response(null,{status:404})}});
    async function call(method,path,body,origin='https://portal.test'){const req=new Request('https://portal.test/api/arrival/'+path,{method,headers:{origin,'oai-authenticated-user-email':'qa@example.test','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const response=await route[method](req,{params:Promise.resolve({path:path.split('/')})});return {status:response.status,body:await response.json()};}
    const first=await call('GET','plans/'+native.id);assert.equal(first.status,200);assert.equal(first.body.plan.published.name,native.businessName);assert.equal((await pg.query('SELECT count(*)::int n FROM arrival_preplan_records')).rows[0].n,0,'reading legacy records must not create mirrors');
    const draft={...first.body.plan.working,name:'QA Updated Building',city:'Stickney',region:'IL',addressConfirmed:true,visited:'2026-11-22',entrance:'A-side door',hydrant:'Unknown',hydrantStatus:'Unknown',hazardStatus:'Unknown'};
    assert.equal(domain.blockers(draft).length,0);
    assert.equal((await call('PUT','plans/'+native.id,{revision:1,data:draft},'https://other.test')).status,403);
    const saved=await call('PUT','plans/'+native.id,{revision:1,data:draft});assert.equal(saved.status,200);assert.equal(saved.body.plan.revision,2);assert.equal(saved.body.plan.published.name,native.businessName);assert.equal((await pg.query('SELECT business_name FROM field_preplans')).rows[0].business_name,native.businessName);
    assert.equal((await call('PUT','plans/'+native.id,{revision:1,data:{...draft,name:'Stale'}})).status,409);
    const submitted=await call('POST','plans/'+native.id+'/transition',{revision:2,action:'submit'});assert.equal(submitted.status,200);assert.equal(submitted.body.plan.status,'review');
    permissions=new Set(['field_preplans.view','field_preplans.edit']);assert.equal((await call('POST','plans/'+native.id+'/transition',{revision:3,action:'publish',acknowledged:true})).status,403);
    permissions=new Set(['field_preplans.view']);const reader=await call('GET','plans/'+native.id);assert.equal(reader.body.plan.working.name,native.businessName,'read-only users receive the approved snapshot');
    permissions=new Set(['field_preplans.view','field_preplans.edit','field_preplans.publish']);
    const published=await call('POST','plans/'+native.id+'/transition',{revision:3,action:'publish',acknowledged:true});assert.equal(published.status,200);assert.equal(published.body.plan.published.name,draft.name);assert.equal((await pg.query('SELECT business_name FROM field_preplans')).rows[0].business_name,draft.name);
    const count=(await pg.query("SELECT count(*)::int n FROM arrival_preplan_records WHERE kind='event'")).rows[0].n;assert.equal(count,3,'failed writes create no audit events');
    const policies=(await pg.query("select policyname,permissive from pg_policies where schemaname='firehouse' and tablename='arrival_preplan_records'")).rows;assert.equal(policies.length,2);assert.ok(policies.some(p=>p.permissive==='RESTRICTIVE'));
  }finally{await pg.close();}
});
