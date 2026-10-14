import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { trainingHarness } from './helpers/training-harness.mjs';
import { trainingModules } from './helpers/training-modules.mjs';

async function setup(){
  const h=await trainingHarness();
  await h.pg.exec(`CREATE TABLE field_hydrants(id text PRIMARY KEY,hydrant_number text DEFAULT '',address text DEFAULT '',latitude double precision DEFAULT 41,longitude double precision DEFAULT -87,service_status text DEFAULT 'in_service',manufacturer text DEFAULT '',model text DEFAULT '',port_count integer DEFAULT 2,port_sizes text DEFAULT '[]',notes text DEFAULT '',created_by text DEFAULT '',updated_by text DEFAULT '',updated_at text DEFAULT '2026-01-01T00:00:00Z');
    CREATE TABLE field_hydrant_flushes(id text PRIMARY KEY,hydrant_id text REFERENCES field_hydrants,flushed_at text,flushed_by text,water_clear int,issues text,notes text);
    CREATE TABLE field_hydrant_flow_tests(id text PRIMARY KEY,test_hydrant_id text REFERENCES field_hydrants,flow_hydrant_id text REFERENCES field_hydrants,tested_at text,static_pressure numeric,residual_pressure numeric,desired_residual numeric,outlet_diameter numeric,pitot_pressure numeric,discharge_coefficient numeric,measured_flow numeric,available_flow numeric,tested_by text,notes text);
    CREATE TABLE record_revisions(id text PRIMARY KEY,record_type text,record_id text,revision_number int,action text,summary text,actor text,UNIQUE(record_type,record_id,revision_number));
    INSERT INTO field_hydrants(id,hydrant_number) VALUES('fixture-test','T'),('fixture-flow','F');
    INSERT INTO field_hydrant_flushes(id,hydrant_id) VALUES('flush','fixture-flow');
    INSERT INTO field_hydrant_flow_tests(id,test_hydrant_id,flow_hydrant_id) VALUES('shared-test','fixture-test','fixture-flow');`);
  let allowed=true;
  const load=trainingModules({[resolve('db/bootstrap.ts')]:{ensureDatabase:async()=>h.db},[resolve('app/server-permissions.ts')]:{permissionsForEmail:async()=>new Set(allowed?['field_preplans.view','field_preplans.edit']:[])}});
  const api=load('app/api/field-hydrants/route.ts');
  return {...h,api,deny:()=>{allowed=false;},post:payload=>api.POST(new Request('https://fixture.invalid/api/field-hydrants',{method:'POST',headers:{origin:'https://fixture.invalid','content-type':'application/json','oai-authenticated-user-email':'fixture@example.invalid'},body:JSON.stringify(payload)}))};
}
test('archive and restore preserve shared tests, flushing and IDs; retry creates one audit',async()=>{
  const h=await setup();try{
    const payload={action:'archiveHydrant',id:'fixture-flow',confirmation:'ARCHIVE'};
    assert.equal((await h.post(payload)).status,200);assert.equal((await h.post(payload)).status,200);
    assert.equal((await h.pg.query('SELECT count(*)::int n FROM field_hydrant_flow_tests')).rows[0].n,1);
    assert.equal((await h.pg.query('SELECT count(*)::int n FROM field_hydrant_flushes')).rows[0].n,1);
    assert.equal((await h.pg.query('SELECT count(*)::int n FROM record_revisions')).rows[0].n,1);
    const active=await(await h.api.GET(new Request('https://fixture.invalid/api/field-hydrants'))).json();
    assert.deepEqual(active.hydrants.map(x=>x.id),['fixture-test']);
    const history=await(await h.api.GET(new Request('https://fixture.invalid/api/field-hydrants?includeArchived=1'))).json();assert.equal(history.hydrants.length,2);
    assert.equal((await(await h.post({action:'restoreHydrant',id:'fixture-flow'})).json()).serviceStatus,'out_of_service');
    assert.equal((await h.post({action:'restoreHydrant',id:'fixture-flow'})).status,200);
    assert.equal((await h.pg.query('SELECT count(*)::int n FROM record_revisions')).rows[0].n,2);
  }finally{await h.close();}
});
test('legacy delete archives; failed audit rolls back; denied and cross-origin writes preserve records',async()=>{
  const h=await setup();try{
    const payload={action:'deleteHydrant',id:'fixture-flow',confirmation:'DELETE'};
    h.stats.failBatchAt=1;assert.equal((await h.post(payload)).status,503);
    assert.equal((await h.pg.query("SELECT service_status FROM field_hydrants WHERE id='fixture-flow'")).rows[0].service_status,'in_service');
    assert.equal((await h.pg.query('SELECT count(*)::int n FROM record_revisions')).rows[0].n,0);
    assert.equal((await h.post(payload)).status,200);
    assert.equal((await h.pg.query('SELECT count(*)::int n FROM field_hydrants')).rows[0].n,2);
    assert.equal((await h.post({action:'addFlush',hydrantId:'fixture-flow',flushedAt:'2026-01-01'})).status,409);
    assert.equal((await h.api.POST(new Request('https://fixture.invalid/api/field-hydrants',{method:'POST',headers:{origin:'https://other.invalid'},body:JSON.stringify(payload)}))).status,403);
    h.deny();assert.equal((await h.post({action:'restoreHydrant',id:'fixture-flow'})).status,403);
  }finally{await h.close();}
});
test('profile retries keep one ID and stale or failed saves cannot overwrite the last confirmed version',async()=>{
  const h=await setup();try{
    const payload={action:'saveHydrant',id:'fixture-created',hydrantNumber:'New',address:'Fixture only',latitude:41,longitude:-87,serviceStatus:'in_service',manufacturer:'',model:'',portCount:2,portSizes:['2.5','4.5'],notes:''};
    assert.equal((await h.post({...payload,id:''})).status,409);
    const first=await(await h.post(payload)).json();assert.ok(first.updatedAt);
    assert.equal((await(await h.post(payload)).json()).updatedAt,first.updatedAt);
    const second=await(await h.post({...payload,notes:'Changed',updatedAt:first.updatedAt})).json();assert.ok(second.updatedAt>first.updatedAt);
    assert.equal((await h.post({...payload,notes:'Stale',updatedAt:first.updatedAt})).status,409);
    h.stats.failBatchAt=1;assert.equal((await h.post({...payload,notes:'Fail',updatedAt:second.updatedAt})).status,503);
    assert.equal((await h.pg.query("SELECT notes FROM field_hydrants WHERE id='fixture-created'")).rows[0].notes,'Changed');
    await h.post({action:'archiveHydrant',id:'fixture-created',confirmation:'ARCHIVE'});
    assert.equal((await h.post({...payload,updatedAt:second.updatedAt})).status,409);
    assert.equal((await h.pg.query("SELECT count(*)::int n FROM field_hydrants WHERE id='fixture-created'")).rows[0].n,1);
  }finally{await h.close();}
});
