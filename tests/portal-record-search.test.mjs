import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { trainingHarness } from './helpers/training-harness.mjs';
import { trainingModules } from './helpers/training-modules.mjs';
import { portalPageUrl } from '../app/portal-navigation.ts';
import { searchPattern,privateSearchItem } from '../app/portal-record-search.ts';

test('private and equipment links retain exact IDs and remove unrelated record context',()=>{
  const prior='?inspectionProperty=old&equipment=old&trainingRecord=old&hydrant=old&nerisRecord=old';
  assert.equal(portalPageUrl('/',prior,'Training',{trainingRecord:'training-2',trainingTab:'History & reports'}),'/?page=training&display=portal&trainingRecord=training-2&trainingTab=History+%26+reports');
  assert.equal(portalPageUrl('/',prior,'Fire Inspections',{inspectionRecord:'inspection-2'}),'/?page=fire-inspections&display=portal&inspectionRecord=inspection-2');
  assert.equal(portalPageUrl('/',prior,'NERIS Reporting',{nerisRecord:'incident-2'}),'/?page=neris-reporting&display=portal&nerisRecord=incident-2');
  assert.equal(portalPageUrl('/',prior,'Inventory',{equipment:'equipment-2'}),'/?page=inventory&display=portal&equipment=equipment-2');
});
test('literal wildcard searches and malformed or test records are handled without exposing payloads',()=>{
  assert.equal(searchPattern('100%_\\'),'%100\\%\\_\\\\%');
  assert.equal(privateSearchItem('training',{id:'fixture',payload:'bad JSON'}),null);
  assert.equal(privateSearchItem('neris',{id:'fixture',payload:JSON.stringify({local:{test:true,title:'Fixture'}})}),null);
});

test('equipment search matches name and serial together, deduplicates sources and retains tenant/session gates', async () => {
  const calls = [];
  let validSession = true;
  const rows = [
    { id: 'matched', apparatus_id:'engine-1', compartment_id:'cab', name: 'SCBA cylinder', serial_number: 'XY2', barcode: 'B1', service_status: 'in_service' },
    { id: 'unrelated', name: 'SCBA cylinder', serial_number: 'ZZ9', barcode: 'B2', service_status: 'in_service' },
  ];
  const client = { from(table) {
    const call = { table }; calls.push(call);
    const builder = {
      select() { return this; }, eq(field, value) { call[field] = value; return this; },
      is(field, value) { call[field] = value; return this; }, ilike(field, value) { call.pattern = [field,value]; return this; },
      in(field,value) { call.ids=value; return Promise.resolve({data:table==='inventory_apparatus_profiles'?[{id:'engine-1',name:'Fixture Engine'}]:[{id:'cab',label:'Driver cab'}],error:null}); },
      order() { return this; }, limit() { return Promise.resolve({data: rows,error: null}); },
    };
    return builder;
  }};
  const api = trainingModules({
    [resolve('db/bootstrap.ts')]: { ensureDatabase: async () => ({}) },
    [resolve('app/server-permissions.ts')]: { permissionsForEmail: async () => new Set(['inventory.view']) },
    [resolve('app/lib/inventory-session.ts')]: { verifyInventoryRequest: async () => ({ok:true,context:{department:{id:validSession?'fixture-department':'other-department'},user:{email:'member@example.invalid'}}}) },
    [resolve('app/lib/supabase-server.ts')]: { createInventorySupabaseClient: async () => client },
  })('app/api/portal-search/route.ts');
  const request = () => new Request('https://fixture.invalid/api/portal-search?q=air%20pack%20XY2', {headers:{'oai-authenticated-user-email':'member@example.invalid','x-department-id':'fixture-department'}});
  const result = await (await api.GET(request())).json();
  assert.deepEqual(result.items.map(item => item.id), ['equipment-matched']);
  assert.ok(calls.length > 0);
  assert.ok(calls.every(call => call.department_id === 'fixture-department'));
  assert.ok(calls.filter(call=>call.table==='inventory_equipment').every(call=>call.retired_at===null));
  assert.equal(result.items[0].detail,'Fixture Engine · Driver cab · XY2 · B1 · in service');
  assert.deepEqual(calls.find(call=>call.table==='inventory_apparatus_profiles').ids,['engine-1']);
  validSession = false; calls.length = 0;
  const denied = await (await api.GET(request())).json();
  assert.deepEqual(denied.items, []);
  assert.deepEqual(denied.unavailable, ['Equipment']);
  assert.equal(calls.length, 0);
});
test('search retains owner-only pilots, department isolation, archived filtering and partial failure recovery',async()=>{
  const h=await trainingHarness();try{
    await h.pg.exec("CREATE TABLE field_hydrants(id text PRIMARY KEY,hydrant_number text,address text,service_status text);INSERT INTO field_hydrants VALUES('h-active','Fixture hydrant','','in_service'),('h-archived','Fixture archived','','archived');");
    for(const table of ['fire_inspection_pilot_records','training_pilot_records','neris_pilot_records'])await h.pg.exec(`CREATE TABLE ${table}(id text PRIMARY KEY,department_id text,kind text,payload text,archived integer,updated_at text);`);
    for(const [id,dept,testFlag,archived]of [['own','fixture-department',false,0],['other','other-department',false,0],['archived','fixture-department',false,1],['test','fixture-department',true,0]])await h.pg.query("INSERT INTO training_pilot_records VALUES($1,$2,'completion',$3,$4,'2026-01-01')",[id,dept,JSON.stringify({title:'Fixture training',test:testFlag}),archived]);
    await h.pg.exec("INSERT INTO field_hydrants VALUES('h-number','17','Pershing Road','in_service');");
    let permissions=new Set(['field_preplans.view']);
    const load=trainingModules({[resolve('db/bootstrap.ts')]:{ensureDatabase:async()=>h.db},[resolve('app/server-permissions.ts')]:{permissionsForEmail:async()=>permissions},[resolve('app/lib/inventory-session.ts')]:{verifyInventoryRequest:async()=>({ok:false,status:503})},[resolve('app/lib/supabase-server.ts')]:{createInventorySupabaseClient:async()=>{throw Error('No network in tests');}}});
    const api=load('app/api/portal-search/route.ts');
    const get=(email='member@example.invalid',dept='fixture-department',q='Fixture')=>api.GET(new Request('https://fixture.invalid/api/portal-search?q='+encodeURIComponent(q),{headers:{'oai-authenticated-user-email':email,'x-department-id':dept}}));
    assert.equal((await api.GET(new Request('https://fixture.invalid/api/portal-search?q=Fixture'))).status,401);
    assert.deepEqual((await(await get()).json()).items.map(x=>x.id),['hydrant-h-active']);
    assert.deepEqual((await(await get('member@example.invalid','fixture-department','pershing hydrants 17')).json()).items.map(x=>x.id),['hydrant-h-number']);
    const wordOrder=await(await get('bobff353@gmail.com','fixture-department','training fixture')).json();assert.equal(wordOrder.items.filter(x=>x.type==='Training').length,1);
    const owner=await(await get('bobff353@gmail.com')).json();assert.equal(owner.items.filter(x=>x.type==='Training').length,1);assert.equal(owner.items.find(x=>x.type==='Training').record.trainingRecord,'own');
    assert.equal((await(await get('bobff353@gmail.com','other-department')).json()).items.find(x=>x.type==='Training').record.trainingRecord,'other');
    permissions=new Set();assert.deepEqual((await(await get()).json()).items,[]);
    permissions=new Set(['inventory.view']);const failed=await(await get()).json();assert.deepEqual(failed.items,[]);assert.deepEqual(failed.unavailable,['Equipment']);
    assert.equal((await get('member@example.invalid','fixture-department','a'.repeat(81))).status,400);
    assert.deepEqual((await(await get('member@example.invalid','fixture-department','F')).json()).items,[]);
  }finally{await h.close();}
});
