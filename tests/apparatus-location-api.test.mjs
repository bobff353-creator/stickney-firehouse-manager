import './helpers/location-route-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {locationRouteFixture} from './helpers/location-route-fixture.mjs';
test('actual setup API, permission resolver, SQL adapter, ingest and snapshot complete a round trip',async()=>{
 const f=await locationRouteFixture();try{
  const pair=await f.routes.POST(f.request(undefined,{action:'pair',apparatusId:'test-engine',deviceName:'Fixture Windows',senderKind:'windows'}));assert.equal(pair.status,200);const result=await pair.json();assert.ok(result.setup.token);assert.equal(result.unit,'TEST E');
  const snapshot=await f.routes.GET(f.request());assert.equal(snapshot.status,200);const before=await snapshot.json();assert.equal(before.units.length,2);assert.equal(before.canManage,true);assert.ok(before.topic);assert.doesNotMatch(JSON.stringify(before),/token_hash|paired_by/);
  const response=await f.ingest.POST(f.request('/api/apparatus-locations/ingest',{latitude:41.8189,longitude:-87.7734,accuracy:10,measuredAt:new Date().toISOString(),moving:true,apparatusId:'test-car'},{authorization:'Bearer '+result.setup.token}));assert.equal(response.status,200);assert.equal((await response.json()).accepted,true);
  const after=await(await f.routes.GET(f.request())).json();assert.equal(after.units.find(unit=>unit.apparatusId==='test-engine').latitude,41.8189);assert.equal(after.units.find(unit=>unit.apparatusId==='test-car').latitude,null);
  assert.match(snapshot.headers.get('cache-control'),/private, no-store/);
 }finally{await f.pg.close();}
});
test('member can view but cannot pair; explicit member denial and incorrect department are enforced',async()=>{
 const f=await locationRouteFixture();try{
  const member={'oai-authenticated-user-email':'member@fixture.invalid'};
  const visible=await f.routes.GET(f.request(undefined,undefined,member));assert.equal(visible.status,200);assert.equal((await visible.json()).canManage,false);
  assert.equal((await f.routes.POST(f.request(undefined,{action:'pair',apparatusId:'test-engine',deviceName:'No authority',senderKind:'browser'},member))).status,403);
  await f.pg.exec("INSERT INTO firehouse.employee_permission_overrides VALUES('member','field_preplans.view','deny')");assert.equal((await f.routes.GET(f.request(undefined,undefined,member))).status,403);
  assert.equal((await f.routes.GET(f.request(undefined,undefined,{'x-department-id':'00000000-0000-4000-8000-000000000099'}))).status,403);
  assert.equal((await f.routes.GET(f.request(undefined,undefined,{'x-authenticated-user-id':''}))).status,403);
 }finally{await f.pg.close();}
});
test('browser pairing uses a protected credential, requires same origin, and rejects expired fixes without writes',async()=>{
 const f=await locationRouteFixture();try{
  const pair=await f.routes.POST(f.request(undefined,{action:'pair',apparatusId:'test-engine',deviceName:'Fixture browser',senderKind:'browser'}));assert.equal(pair.status,200);assert.match(pair.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Strict/);assert.equal((await pair.json()).setup,undefined);
  const cookie=pair.headers.get('set-cookie').split(';')[0];const before=f.counters.queries;
  const bad={latitude:41.8,longitude:-87.7,accuracy:10,measuredAt:'2020-01-01T00:00:00Z',moving:false};
  assert.equal((await f.ingest.POST(f.request('/api/apparatus-locations/ingest',bad,{cookie}))).status,422);assert.equal(f.counters.queries,before);
  assert.equal((await f.ingest.POST(f.request('/api/apparatus-locations/ingest',bad,{cookie,origin:'https://example.invalid'}))).status,401);
  assert.equal((await f.routes.POST(f.request(undefined,{action:'revoke',apparatusId:'test-engine'},{origin:'https://example.invalid'}))).status,403);
 }finally{await f.pg.close();}
});
