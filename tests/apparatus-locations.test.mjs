import './helpers/feed-test-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {locationTestDatabase,pairTestDevice,ingestTestFix,department,user,otherUser} from './helpers/apparatus-location-db.mjs';
const {validLocationFix,shouldSendLocation,locationAgeLabel,mergeLocation}=await import('../app/apparatus-location-domain.ts');
const {createApparatusLocationClient}=await import('../app/apparatus-location-client.ts');
const now=Date.parse('2026-09-12T12:00:10Z');
const fix=(at=now,extra={})=>({latitude:41.8189,longitude:-87.7734,accuracy:10,measuredAt:new Date(at).toISOString(),moving:false,...extra});
test('only fresh, accurate numeric positions are eligible; network/default/old fixes cannot be shown live',()=>{
 assert.equal(validLocationFix(fix(),now),true);
 for(const change of [{latitude:null},{latitude:''},{latitude:NaN},{longitude:200},{accuracy:500},{accuracy:0},{moving:'true'},{measuredAt:new Date(now-31000).toISOString()},{measuredAt:new Date(now+6000).toISOString()}])assert.equal(validLocationFix(fix(now,change),now),false);
});
test('adaptive sender does not multiply stationary writes and moves immediately after its minimum spacing',()=>{
 const previous=fix();assert.equal(shouldSendLocation(previous,null,0,false,now),true);
 assert.equal(shouldSendLocation(fix(now+119000),previous,now,false,now+119000),false);
 assert.equal(shouldSendLocation(fix(now+120000),previous,now,false,now+120000),true);
 assert.equal(shouldSendLocation(fix(now+5000,{moving:true}),previous,now,false,now+5000),true);
 assert.equal(shouldSendLocation(fix(now+5000,{moving:true}),fix(now,{moving:true}),now,false,now+5000),false);
 assert.equal(shouldSendLocation(fix(now+5000,{moving:true}),fix(now,{moving:true}),now,true,now+5000),true);
 let last=fix(),sent=now,count=1;for(let time=now+1000;time<now+86400000;time+=1000){const candidate=fix(time);if(shouldSendLocation(candidate,last,sent,false,time)){last=candidate;sent=time;count++;}}assert.equal(count,720,'stationary 24-hour simulation, initial fix included');
});
test('atomic ingest is scoped to the paired vehicle; rejected/no-op fixes send no notifications',async()=>{
 const pg=await locationTestDatabase();try{
  await pairTestDevice(pg);const accepted=await ingestTestFix(pg,fix(),new Date(now).toISOString());assert.equal(accepted.accepted,true);
  assert.equal((await pg.query('SELECT count(*)::int n FROM realtime.messages')).rows[0].n,2);
  assert.equal((await ingestTestFix(pg,fix(now+1000),new Date(now+1000).toISOString())).reason,'rate_limited');
  assert.equal((await ingestTestFix(pg,fix(),new Date(now+10000).toISOString())).reason,'old_fix');
  for(const value of [fix(now+10000,{accuracy:999}),fix(now+10000,{latitude:null}),fix(now+10000,{moving:null}),{}])assert.equal((await ingestTestFix(pg,value,new Date(now+10000).toISOString())).reason,'invalid_fix');
  assert.equal((await ingestTestFix(pg,fix(now+10000),new Date(now+10000).toISOString(),'b'.repeat(64))).reason,'device_revoked');
  assert.equal((await pg.query('SELECT count(*)::int n FROM realtime.messages')).rows[0].n,2);
  const [row]=(await pg.query('SELECT * FROM firehouse.apparatus_trackers')).rows;assert.equal(row.sequence,1);assert.equal(row.apparatus_id,'test-engine');
  const payloads=(await pg.query('SELECT payload FROM realtime.messages')).rows;assert.doesNotMatch(JSON.stringify(payloads),/token_hash|paired_by|aaaaaa/);
  await pg.exec("SET test.fail_broadcast='true'");
  await assert.rejects(ingestTestFix(pg,fix(now+15000),new Date(now+15000).toISOString()),/notification was not queued/);
  assert.equal((await pg.query('SELECT sequence FROM firehouse.apparatus_trackers')).rows[0].sequence,1,'failed notification rolls back the position');
 }finally{await pg.close();}
});
test('replacement, disable, expiry and retirement revoke device writes; concurrent senders serialize',async()=>{
 const pg=await locationTestDatabase();try{
  await pairTestDevice(pg);const results=await Promise.all(Array.from({length:8},()=>ingestTestFix(pg,fix(),new Date(now).toISOString())));assert.equal(results.filter(result=>result.accepted).length,1);
  await pg.query('UPDATE firehouse.apparatus_trackers SET token_hash=$1,device_id=gen_random_uuid(),sequence=sequence+1',['b'.repeat(64)]);
  assert.equal((await ingestTestFix(pg,fix(now+10000),new Date(now+10000).toISOString())).reason,'device_revoked');
  assert.equal((await ingestTestFix(pg,fix(now+10000),new Date(now+10000).toISOString(),'b'.repeat(64))).accepted,true);
  await pg.exec("UPDATE firehouse.fleet_apparatus SET retired_at='2026-09-12'");assert.equal((await ingestTestFix(pg,fix(now+20000),new Date(now+20000).toISOString(),'b'.repeat(64))).reason,'device_revoked');
  await pg.exec("UPDATE firehouse.fleet_apparatus SET retired_at=NULL;UPDATE firehouse.apparatus_trackers SET expires_at='2020-01-01'");assert.equal((await ingestTestFix(pg,fix(now+20000),new Date(now+20000).toISOString(),'b'.repeat(64))).reason,'device_revoked');
 }finally{await pg.close();}
});
test('direct data and sending are denied; private receiver leases belong only to their authorized user and topic',async()=>{
 const pg=await locationTestDatabase();try{
  await pairTestDevice(pg);const topic=(await pg.query('SELECT firehouse.apparatus_location_topic($1) topic',[department])).rows[0].topic;
  await pg.query("INSERT INTO firehouse.apparatus_location_view_leases VALUES($1,$2,$3,clock_timestamp()+interval '1 minute')",[department,user,topic]);
  await pg.query("SELECT set_config('request.user',$1,false),set_config('request.topic',$2,false)",[user,topic]);
  await pg.exec('SET ROLE authenticated');
  assert.equal((await pg.query('SELECT * FROM realtime.messages')).rows.length,1);
  await assert.rejects(pg.query('SELECT * FROM firehouse.apparatus_trackers'),/permission denied/);
  await assert.rejects(pg.query("SELECT firehouse.ingest_apparatus_location('a','b')"),/permission denied/);
  await assert.rejects(pg.query("UPDATE firehouse.apparatus_location_view_leases SET expires_at=now()+interval '1 year'"),/permission denied/);
  await pg.query("SELECT set_config('request.user',$1,false)",[otherUser]);assert.equal((await pg.query('SELECT * FROM realtime.messages')).rows.length,0);assert.equal((await pg.query('SELECT * FROM firehouse.apparatus_location_view_leases')).rows.length,0);
  await pg.exec('RESET ROLE');await pg.exec("UPDATE firehouse.apparatus_location_view_leases SET expires_at=now()-interval '1 second'");await pg.query("SELECT set_config('request.user',$1,false)",[user]);await pg.exec('SET ROLE authenticated');assert.equal((await pg.query('SELECT * FROM realtime.messages')).rows.length,0);
  await pg.exec('RESET ROLE');await pg.exec('SET enable_seqscan=off');const plans=await pg.query("EXPLAIN SELECT apparatus_id FROM firehouse.apparatus_trackers WHERE token_hash='"+'a'.repeat(64)+"'");assert.match(JSON.stringify(plans.rows),/token_hash_key/);
  assert.equal((await pg.query("SELECT count(*)::int n FROM pg_proc WHERE pronamespace='firehouse'::regnamespace AND prosecdef")).rows[0].n,0);
 }finally{await pg.close();}
});
const sampleUnit={apparatusId:'test-engine',unit:'TEST E',name:'Fixture',fleetStatus:'in_service',deviceId:'fixture',deviceName:'Fixture',senderKind:'browser',enabled:true,latitude:41.8,longitude:-87.7,accuracy:10,fixAt:new Date(now).toISOString(),receivedAt:new Date(now).toISOString(),moving:true,sequence:1};
test('last-known labels age without server writes and old socket messages never rewind a position',()=>{
 assert.match(locationAgeLabel(sampleUnit,now+10000,true),/^Updated/);assert.match(locationAgeLabel(sampleUnit,now+31000,true),/^Last known/);assert.match(locationAgeLabel(sampleUnit,now+1000,false),/^Last known/);
 assert.deepEqual(mergeLocation([sampleUnit],{...sampleUnit,sequence:0}),[sampleUnit]);assert.deepEqual(mergeLocation([sampleUnit],{...sampleUnit,apparatusId:'other'}),[sampleUnit]);
});
function clientHarness(){
 let clock=now,reads=0,visible=true,denied=false,unsubscribes=0,listener,connected;let socketUnit=sampleUnit;
 const timers=new Map();let nextId=0;
 const client=createApparatusLocationClient({now:()=>clock,visible:()=>visible,timer:(fn,ms)=>{const id=++nextId;timers.set(id,{fn,at:clock+ms});return id;},clear:id=>timers.delete(id),
 read:async()=>{reads++;if(denied)throw Error('403');return{departmentId:department,userId:user,canManage:true,units:[socketUnit],topic:'topic:'+Math.floor(clock/60000),expiresAt:new Date((Math.floor(clock/60000)+1)*60000).toISOString(),serverTime:new Date(clock).toISOString()};},
 connect:(topic,fn,status)=>{listener=fn;connected=status;status(true);return()=>{unsubscribes++;};}});
 return {client,timers,get reads(){return reads;},get unsubscribes(){return unsubscribes;},push:unit=>{socketUnit=unit;listener(unit);},disconnect:()=>connected(false),reconnect:()=>connected(true),hide:()=>{visible=false;client.visibility();},deny:()=>{denied=true;},advance:async ms=>{clock+=ms;for(const [id,t]of [...timers])if(t.at<=clock){timers.delete(id);t.fn();}await new Promise(r=>setImmediate(r));}};
}
test('ten viewers in one browser share a stream, snapshot and timer; denied renewal clears locations',async()=>{
 const h=clientHarness(),stops=Array.from({length:10},()=>h.client.subscribe(()=>{},true));await h.advance(0);assert.equal(h.reads,1);assert.equal(h.timers.size,1);
 await h.advance(1000);assert.equal(h.reads,2,'one post-subscription catch-up');h.push({...sampleUnit,sequence:2,latitude:41.9});assert.equal(h.client.getSnapshot().units[0].latitude,41.9);
 h.disconnect();h.reconnect();await h.advance(1000);assert.equal(h.reads,3,'rejoining also closes the missed-update gap');
 h.deny();await h.advance(60000);assert.equal(h.client.getSnapshot().units.length,0);assert.equal(h.client.getSnapshot().connected,false);stops.forEach(stop=>stop());assert.equal(h.timers.size,0);
});
test('hidden ordinary tabs pause, designated monitors remain subscribed, and closed components clean up',async()=>{
 const h=clientHarness();const stop=h.client.subscribe(()=>{});await h.advance(0);h.hide();assert.equal(h.timers.size,0);assert.equal(h.client.getSnapshot().connected,false);stop();
 const always=clientHarness();const close=always.client.subscribe(()=>{},true);await always.advance(0);always.hide();await always.advance(0);assert.equal(always.client.getSnapshot().connected,true);close();assert.equal(always.timers.size,0);
});
test('integration keeps call polling, limits the auth bypass to signed POST and has no public GPS cache',()=>{
 const respond=readFileSync(new URL('../app/respond.tsx',import.meta.url),'utf8');assert.match(respond,/setInterval\(\(\) => void load\(\), 10000\)/);assert.match(respond,/useApparatusLocations/);
 const proxy=readFileSync(new URL('../proxy.ts',import.meta.url),'utf8');assert.match(proxy,/request\.method === "POST"[\s\S]*signedWebhookPaths/);assert.match(proxy,/requestHeaders\.set\("x-authenticated-user-id", user.id\)/);
 const ingest=readFileSync(new URL('../app/api/apparatus-locations/ingest/route.ts',import.meta.url),'utf8');assert.match(ingest,/validLocationFix/);assert.match(ingest,/createHash\('sha256'\)/);
 const setup=readFileSync(new URL('../app/api/apparatus-locations/route.ts',import.meta.url),'utf8');assert.match(setup,/canManage/);assert.match(setup,/HttpOnly; Secure; SameSite=Strict/);assert.doesNotMatch(setup,/ensureDatabase/);
});
