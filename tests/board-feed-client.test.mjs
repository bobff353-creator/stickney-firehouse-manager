import './helpers/feed-test-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const {createBoardFeedClient,savedFeedLabel}=await import('../app/board-feeds-client.ts');
const {assembleFeeds}=await import('../app/lib/board-feed-reader.ts');
const {feedGroups,nextFeedSlot}=await import('../app/lib/feed-schedule.ts');
function harness(){
 let now=Date.parse('2026-09-12T05:01:00Z'),id=0,visible=true,online=true,fail=false;
 const tasks=new Map(),storage=new Map(),requests=[];
 const env={now:()=>now,active:()=>visible,online:()=>online,restore:g=>storage.get(g)??null,persist:(g,v)=>storage.set(g,v),
  setTimer:(fn,delay)=>{tasks.set(++id,{fn,at:now+delay});return id;},clearTimer:id=>tasks.delete(id),
  request:async(group)=>{requests.push({group,at:now});if(fail)throw Error('Offline');return assembleFeeds(feedGroups[group],feedGroups[group].map(source=>({source,payload:{source,items:[]},last_success_at:new Date(now-60_000).toISOString(),last_attempt_at:new Date(now-60_000).toISOString(),attempted_slot:new Date(Math.floor(now/900_000)*900_000).toISOString(),next_scheduled_at:new Date(nextFeedSlot(source,now)).toISOString(),status:'ok'})),now);}
 };
 async function advance(ms){const end=now+ms;let loops=0;for(;;){const entry=[...tasks].filter(([,task])=>task.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!entry)break;if(++loops>5000)throw Error('Timer storm');tasks.delete(entry[0]);now=entry[1].at;entry[1].fn();await new Promise(r=>setImmediate(r));}now=end;await new Promise(r=>setImmediate(r));}
 return{env,requests,storage,tasks,advance,setHidden:v=>visible=!v,setOnline:v=>online=v,setFail:v=>fail=v};
}
test('multiple mounted boards share two initial cached reads and one scheduler; refresh restores saved results',async()=>{
 const h=harness(),client=createBoardFeedClient(h.env);
 const stops=Array.from({length:10},()=>client.subscribe(()=>{},true));await h.advance(0);
 assert.equal(h.requests.length,2);assert.equal(h.tasks.size,1);
 await h.advance(60_000);assert.equal(h.requests.length,2);
 stops.forEach(stop=>stop());assert.equal(h.tasks.size,0);
 const remount=createBoardFeedClient(h.env),stop=remount.subscribe(()=>{},true);await h.advance(0);
 assert.equal(h.requests.length,2,'navigation/page refresh reused saved results');assert.ok(remount.snapshot().feeds.weather.data);stop();
});
test('steady informational request cadence is about 98 reads/day, not 8,928',async()=>{
 const h=harness(),client=createBoardFeedClient(h.env),stop=client.subscribe(()=>{},true);
 await h.advance(86_400_000-1);
 assert.equal(h.requests.filter(r=>r.group==='weather').length,96);
 assert.equal(h.requests.filter(r=>r.group==='bulletins').length,3,'initial load plus two scheduled reads');
 assert.equal(h.requests.length,99);stop();
});
test('hidden ordinary tabs pause, TV boards continue, and reconnect does not duplicate reads',async()=>{
 const h=harness(),client=createBoardFeedClient(h.env);h.setHidden(true);
 const ordinary=client.subscribe(()=>{});await h.advance(60_000);assert.equal(h.requests.length,0);
 const tv=client.subscribe(()=>{},true);await h.advance(0);assert.equal(h.requests.length,2);
 client.resume();client.resume();await h.advance(0);assert.equal(h.requests.length,2);
 tv();await h.advance(900_000);assert.equal(h.requests.length,2);
 h.setHidden(false);client.resume();await h.advance(0);assert.equal(h.requests.length,3);
 h.setOnline(false);client.resume();await h.advance(900_000);assert.equal(h.requests.length,3);
 h.setOnline(true);client.resume();client.resume();await h.advance(0);assert.equal(h.requests.length,4);ordinary();
});
test('failed cache reads retain payload and timestamp but cannot imply new confirmation',async()=>{
 const h=harness(),client=createBoardFeedClient(h.env),stop=client.subscribe(()=>{},true);await h.advance(0);
 const before=client.snapshot().feeds.weather;h.setFail(true);await h.advance(900_000);
 assert.deepEqual(client.snapshot().feeds.weather,before);assert.equal(client.snapshot().unconfirmed.weather,true);
 assert.match(savedFeedLabel(before,true,h.env.now()),/^Last saved/);
 await h.advance(300_000);assert.equal(h.requests.filter(r=>r.group==='weather').length,3);
 h.setFail(false);await h.advance(300_000);assert.equal(client.snapshot().unconfirmed.weather,false);stop();
});
test('concurrent slow reads do not overlap, and unmount aborts the read',async()=>{
 const h=harness();let signals=[];h.env.request=async(_group,signal)=>{signals.push(signal);await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))));};
 const client=createBoardFeedClient(h.env),stop=client.subscribe(()=>{},true);await h.advance(0);assert.equal(signals.length,2);
 client.resume();await h.advance(900_000);assert.equal(signals.length,2);stop();assert.ok(signals.every(signal=>signal.aborted));await h.advance(0);assert.equal(h.tasks.size,0);
});

test('published training invalidates only shared bulletins; offline/reconnect retains data and deduplicates',async()=>{
 const h=harness(),client=createBoardFeedClient(h.env),stops=[client.subscribe(()=>{},true),client.subscribe(()=>{},true)];await h.advance(0);
 client.invalidateBulletins();client.invalidateBulletins();await h.advance(0);assert.equal(h.requests.length,3);assert.equal(h.requests.at(-1).group,'bulletins');
 h.setOnline(false);client.invalidateBulletins();await h.advance(60_000);assert.equal(h.requests.length,3);assert.ok(client.snapshot().feeds.training_ifsi.data);
 h.setOnline(true);client.resume();client.resume();await h.advance(0);assert.equal(h.requests.length,4);stops.forEach(stop=>stop());assert.equal(h.tasks.size,0);
});
