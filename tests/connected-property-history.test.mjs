import test from 'node:test';import assert from 'node:assert/strict';import {resolve}from'node:path';
import {trainingHarness}from'./helpers/training-harness.mjs';import {trainingModules}from'./helpers/training-modules.mjs';
const {parseHistoryCursor}=trainingModules()('app/property-history-model.ts');
test('history cursor validation rejects malformed and oversized paging links',()=>{for(const value of ['garbage',Buffer.from(JSON.stringify({at:'invalid',key:'k'})).toString('base64url'),'a'.repeat(601)])assert.throws(()=>parseHistoryCursor(value));assert.equal(parseHistoryCursor(null),null);});
test('connected history retains old/archived versions, excludes tests/other properties and pages stably after newer insertion',async()=>{
  const h=await trainingHarness();try{
    await h.pg.exec(`CREATE TABLE field_preplans(id text PRIMARY KEY,business_name text,address text,publication_status text,created_by text,updated_by text);INSERT INTO field_preplans VALUES('property-a','Fixture property','Fictional address','published','','');CREATE TABLE field_preplan_revisions(id text PRIMARY KEY,preplan_id text,revision_number integer,publication_status text,summary text,actor text,created_at text);CREATE TABLE fire_inspection_pilot_audit(id text PRIMARY KEY,department_id text,record_id text,version integer,kind text,payload text,archived integer,actor text,created_at text);`);
    const insert=async(id,property,department='fixture-department',testFlag=false,version=1)=>h.pg.query('INSERT INTO fire_inspection_pilot_audit VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,department,'visit-'+id,version,'inspection',JSON.stringify({propertyId:property,title:'Fixture visit',status:'Completed',test:testFlag}),1,'fixture@example.invalid','2026-10-13T10:00:00Z']);
    for(let n=0;n<31;n++)await insert('v'+String(n).padStart(3,'0'),'property-a','fixture-department',false,n+1);
    await insert('other-property','property-b');await insert('other-dept','property-a','other-department');await insert('test','property-a','fixture-department',true);
    await h.pg.exec("INSERT INTO field_preplan_revisions VALUES('revision','property-a',1,'draft','Fixture preplan revision','fixture@example.invalid','2026-10-13T10:00:00Z');");
    await h.pg.exec("ALTER TABLE field_preplans ADD COLUMN updated_at text DEFAULT 'old';ALTER TABLE field_preplans ADD COLUMN revision_number integer DEFAULT 1;ALTER TABLE field_preplans ADD COLUMN next_review_date text DEFAULT '';CREATE TABLE fire_inspection_pilot_records(id text,department_id text,kind text,payload text,version integer,archived integer,updated_at text);");let working=true;
    const load=trainingModules({[resolve('db/bootstrap.ts')]:{ensureDatabase:async()=>h.db},[resolve('app/server-permissions.ts')]:{preplanReadAccess:async()=>({canViewPublished:true,canViewWorking:working}),canReadPreplanLifecycle:()=>true}}),api=load('app/api/fire-inspections/property-history/route.ts');
    const get=(params='',email='bobff353@gmail.com')=>api.GET(new Request('http://localhost/api/fire-inspections/property-history?property=property-a'+params,{headers:{'oai-authenticated-user-email':email,'x-department-id':'fixture-department'}}));
    assert.equal((await get('','member@example.invalid')).status,403);
    const first=await(await get()).json();assert.equal(first.entries.length,25);assert.ok(first.nextCursor);assert.ok(first.entries.some(x=>Number(x.archived)===1));
    await h.pg.query('INSERT INTO field_preplan_revisions VALUES($1,$2,2,$3,$4,$5,$6)',['new','property-a','published','Newer fixture','fixture','2026-10-14T10:00:00Z']);
    const second=await(await get('&cursor='+first.nextCursor)).json();assert.equal(second.entries.length,7);assert.equal(second.nextCursor,null);
    const ids=[...first.entries,...second.entries].map(x=>x.key);assert.equal(new Set(ids).size,32);assert.ok(!ids.some(id=>/test|other|new/.test(id)));
    assert.equal((await get('&cursor=garbage')).status,400);working=false;assert.equal((await get()).status,403);assert.equal(h.stats.writes,0);
  }finally{await h.close();}
});
