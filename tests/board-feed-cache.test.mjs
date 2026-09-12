import './helpers/feed-test-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const { nextFeedSlot, isFeedDue, feedSources, feedGroups } = await import('../app/lib/feed-schedule.ts');
const { refreshBoardFeeds } = await import('../app/lib/board-feed-refresh.ts');
const { assembleFeeds, createFeedReader } = await import('../app/lib/board-feed-reader.ts');
const migration=readFileSync(new URL('../supabase/migrations/20260912104034_shared_board_feed_cache.sql',import.meta.url),'utf8');
const iso=ms=>new Date(ms).toISOString();
test('Chicago 6 AM/6 PM and daily training handle both DST transitions and year rollover',()=>{
  for(const [at,expected] of [
    ['2026-03-07T13:00:00Z','2026-03-08T11:00:00.000Z'],
    ['2026-10-31T12:00:00Z','2026-11-01T12:00:00.000Z'],
    ['2026-12-31T13:00:00Z','2027-01-01T12:00:00.000Z'],
  ]) assert.equal(iso(nextFeedSlot('training_ifsi',Date.parse(at))),expected);
  assert.equal(iso(nextFeedSlot('usfa',Date.parse('2026-09-12T11:00:00Z'))),'2026-09-12T23:00:00.000Z');
  assert.equal(iso(nextFeedSlot('usfa',Date.parse('2026-01-12T12:00:00Z'))),'2026-01-13T00:00:00.000Z');
  assert.equal(isFeedDue('training_ifsi',Date.parse('2026-09-12T23:00:00Z')),false);
  assert.equal(isFeedDue('usfa',Date.parse('2026-09-12T11:15:00Z')),false);
  assert.equal(isFeedDue('usfa',Date.parse('2026-09-12T12:00:00Z')),false);
});
async function setup(){const pg=new PGlite();await pg.exec('CREATE SCHEMA firehouse; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');await pg.exec(migration);return pg;}
const claim=async(pg,source,at)=>(await pg.query('SELECT firehouse.claim_board_feed($1,$2) token',[source,at])).rows[0].token;
const finish=async(pg,source,token,payload)=>(await pg.query('SELECT firehouse.finish_board_feed($1,$2,$3) saved',[source,token,payload===null?null:Buffer.from(JSON.stringify(payload)).toString('base64')])).rows[0].saved;
test('real PostgreSQL claims one worker per slot; saves atomically; failures and crashes retain last data',async()=>{
 const pg=await setup();try{
  const claims=await Promise.all(Array.from({length:10},()=>claim(pg,'weather','2026-09-12T11:00:00Z')));
  const token=claims.find(Boolean);assert.equal(claims.filter(Boolean).length,1);
  assert.equal(await finish(pg,'weather',token,{days:[{high:72}],text:'Quotes; SET /* text */ — retained'}),true);
  const before=(await pg.query('SELECT payload,last_success_at FROM firehouse.board_feed_cache')).rows[0];
  const second=await claim(pg,'weather','2026-09-12T11:15:00Z');
  assert.equal(await finish(pg,'weather',token,{days:[]}),false,'older worker cannot overwrite next slot');
  await finish(pg,'weather',second,null);
  const failed=(await pg.query('SELECT payload,last_success_at,status FROM firehouse.board_feed_cache')).rows[0];
  assert.deepEqual(failed.payload,before.payload);assert.equal(String(failed.last_success_at),String(before.last_success_at));assert.equal(failed.status,'error');
  assert.equal(await claim(pg,'weather','2026-09-12T11:19:00Z'),null,'no retry after failed attempt');
  const crashed=await claim(pg,'weather','2026-09-12T11:30:00Z');assert.ok(crashed);
  assert.equal(await claim(pg,'weather','2026-09-12T11:31:00Z'),null,'a restarted worker cannot retry a consumed slot');
  assert.ok(await claim(pg,'weather','2026-09-12T11:45:00Z'));
  for(const role of ['anon','authenticated','service_role']) {
    await pg.exec(`SET ROLE ${role}`);
    await assert.rejects(pg.query('SELECT * FROM firehouse.board_feed_cache'),/permission denied/);
    await assert.rejects(pg.query("SELECT firehouse.claim_board_feed('weather')"),/permission denied/);
    await pg.exec('RESET ROLE');
  }
  assert.equal((await pg.query("SELECT count(*)::int n FROM pg_proc WHERE pronamespace='firehouse'::regnamespace AND prosecdef")).rows[0].n,0);
  const plan=await pg.query("EXPLAIN SELECT payload FROM firehouse.board_feed_cache WHERE source='weather'");
  assert.match(JSON.stringify(plan.rows),/board_feed_cache_pkey/);
 }finally{await pg.close();}
});
test('database schedule matches application schedule in winter, summer, DST and midnight',async()=>{
 const pg=await setup();try{for(const source of feedSources)for(const at of ['2026-03-08T07:59:00Z','2026-03-08T11:00:00Z','2026-11-01T06:30:00Z','2026-11-01T12:00:00Z','2026-01-12T23:59:00Z','2026-09-12T23:59:00Z']){
  const row=(await pg.query('SELECT firehouse.next_board_feed_slot($1,$2) next',[source,at])).rows[0];
  assert.equal(iso(Date.parse(row.next)),iso(nextFeedSlot(source,Date.parse(at))),source+at);
  const token=await claim(pg,source,at);if(!isFeedDue(source,Date.parse(at)))assert.equal(token,null);
 }}finally{await pg.close();}
});
test('10 viewers plus repeated cron delivery do not multiply external retrievals',async()=>{
 const pg=await setup();try{
  const now=Date.parse('2026-09-12T11:00:00Z'),counts=Object.fromEntries(feedSources.map(s=>[s,0]));
  const store={claim:s=>claim(pg,s,iso(now)),finish:(...args)=>finish(pg,...args)};
  const loaders=Object.fromEntries(feedSources.map(s=>[s,async()=>{counts[s]++;return {source:s,items:[]};}]));
  await Promise.all(Array.from({length:10},()=>refreshBoardFeeds(store,loaders,now)));
  assert.deepEqual(Object.values(counts),[1,1,1,1,1,1]);
  let reads=0;const reader=createFeedReader(async()=>{reads++;return (await pg.query('SELECT * FROM firehouse.board_feed_cache')).rows;},()=>now+60_000);
  await Promise.all(Array.from({length:10},()=>reader(feedGroups.bulletins)));
  assert.equal(reads,1);assert.deepEqual(Object.values(counts),[1,1,1,1,1,1]);
 }finally{await pg.close();}
});
test('unavailable database never triggers an external fetch, and slow training does not hold weather persistence',async()=>{
 let calls=0;const loaders=Object.fromEntries(feedSources.map(s=>[s,async()=>{calls++;return {};} ]));
 await refreshBoardFeeds({claim:async()=>{throw Error('offline');},finish:async()=>true},loaders,Date.parse('2026-09-12T11:00:00Z'));assert.equal(calls,0);
 let release;const slow=new Promise(r=>release=r),saved=[];
 const work=refreshBoardFeeds({claim:async s=>s,finish:async(s)=>{saved.push(s);return true;}},{...loaders,training_ifsi:async()=>{await slow;return{};}},Date.parse('2026-09-12T11:00:00Z'));
 await new Promise(r=>setImmediate(r));assert.ok(saved.includes('weather'));assert.ok(!saved.includes('training_ifsi'));release();await work;
});
test('readers show last saved data and original timestamps after failure; no-data waits for cron',()=>{
 const now=Date.parse('2026-09-12T11:01:00Z');
 const row={source:'weather',payload:{days:[{high:72}]},last_success_at:'2026-09-12T10:45:00Z',last_attempt_at:'2026-09-12T11:00:00Z',attempted_slot:'2026-09-12T11:00:00Z',next_scheduled_at:'2026-09-12T11:15:00Z',status:'error'};
 const value=assembleFeeds(['weather'],[row],now);
 assert.equal(value.feeds.weather.status,'stale');assert.equal(value.feeds.weather.lastSuccessAt,row.last_success_at);assert.deepEqual(value.feeds.weather.data,row.payload);
 assert.equal(value.nextCheckAt,'2026-09-12T11:16:00.000Z');
 const pending=assembleFeeds(['weather'],[],now);assert.equal(pending.nextCheckAt,'2026-09-12T11:01:30.000Z');assert.equal(pending.feeds.weather.data,null);
});

test('durable claims enforce exact global per-day budgets on normal, 23-hour and 25-hour Chicago days',async()=>{
 const pg=await setup();try{
  for(const [start,end,weather] of [['2026-03-08T06:00:00Z','2026-03-09T05:00:00Z',92],['2026-09-12T05:00:00Z','2026-09-13T05:00:00Z',96],['2026-11-01T05:00:00Z','2026-11-02T06:00:00Z',100]]){
   const counts=Object.fromEntries(feedSources.map(source=>[source,0]));
   for(let now=Date.parse(start);now<Date.parse(end);now+=900_000) for(const source of feedSources){
    if(await claim(pg,source,iso(now)))counts[source]++;
    assert.equal(await claim(pg,source,iso(now)),null,'duplicate scheduler delivery');
   }
   assert.deepEqual(counts,{weather,close_calls:2,usfa:2,training_romeoville:1,training_ifsi:1,training_nipsta:1});
  }
 }finally{await pg.close();}
});
