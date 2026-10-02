import './helpers/location-route-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {locationRouteFixture} from './helpers/location-route-fixture.mjs';
import {department,pairTestDevice} from './helpers/apparatus-location-db.mjs';

test('Fleet supplies unpaired apparatus without replacing legacy trackers or exposing another department',async()=>{
 const f=await locationRouteFixture();try{
  const tracker=await pairTestDevice(f.pg);
  await f.pg.exec(`INSERT INTO public.departments VALUES('00000000-0000-4000-8000-000000000099');
   INSERT INTO public.department_apparatus VALUES
   ('00000000-0000-4000-8000-000000000012','${department}','TEST NEW','Utility','in_service'),
   ('00000000-0000-4000-8000-000000000013','${department}','TEST RETIRED','Engine','retired'),
   ('00000000-0000-4000-8000-000000000014','00000000-0000-4000-8000-000000000099','OTHER UNIT','Engine','in_service');`);
  const response=await f.routes.GET(f.request());assert.equal(response.status,200);
  const {units}=await response.json();assert.equal(units.length,3);
  assert.equal(units.find(u=>u.unit==='TEST E').deviceId,tracker);
  const rig=units.find(u=>u.unit==='TEST NEW');assert.equal(rig.latitude,null);assert.equal(rig.deviceId,null);
  const pair=await f.routes.POST(f.request(undefined,{action:'pair',apparatusId:rig.apparatusId,deviceName:'New fixture rig',senderKind:'browser'}));assert.equal(pair.status,200);
  const after=await(await f.routes.GET(f.request())).json();assert.ok(after.units.find(u=>u.unit==='TEST NEW').deviceId);
  assert.equal(after.units.find(u=>u.unit==='TEST E').deviceId,tracker);
  const other=await f.routes.POST(f.request(undefined,{action:'pair',apparatusId:'00000000-0000-4000-8000-000000000014',deviceName:'Denied',senderKind:'browser'}));assert.equal(other.status,400);
 }finally{await f.pg.close();}
});
