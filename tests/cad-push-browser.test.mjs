import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function workerFixture(shared=new Map(), storageFails=false) {
 const handlers=new Map(),shown=[];
 const caches={async open(name){if(storageFails)throw Error('Fixture storage blocked'); if(!shared.has(name))shared.set(name,new Map());const rows=shared.get(name);return{
   match:async key=>rows.get(key),put:async(key,value)=>{rows.set(key,value);},keys:async()=>Array.from(rows.keys()),delete:async key=>rows.delete(key),
 };},keys:async()=>Array.from(shared.keys()),delete:async key=>shared.delete(key)};
 let failDisplay=false,routineWait=null;
 const context={caches,Response,URL,console,self:{location:{origin:'https://fixture.invalid'},registration:{async showNotification(title,options){if(failDisplay)throw Error('Fixture display failed');if(options.data.kind==='scheduler'&&routineWait)await routineWait;shown.push({title,options});}},addEventListener:(name,fn)=>handlers.set(name,fn),skipWaiting(){},clients:{claim:async()=>{}}}};
 vm.runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),context);
 return{shared,shown,setRoutineWait:value=>{routineWait=value;},setFail:value=>{failDisplay=value;},async push(eventId,kind='cad'){let work;handlers.get('push')({data:{json:()=>({eventId,kind,title:'LOCAL TEST',tag:'fixture-'+eventId})},waitUntil:p=>{work=p;}});return work;},async activate(){let work;handlers.get('activate')({waitUntil:p=>{work=p;}});return work;}};
}

test('a stalled scheduling notification cannot delay CAD; receipts and duplicate queues are separate',async()=>{
 const f=workerFixture(),id='00000000-0000-4000-8000-000000000001';let release;
 f.setRoutineWait(new Promise(resolve=>{release=resolve;}));const routine=f.push(id,'scheduler');
 await f.push(id);assert.equal(f.shown.length,1);assert.equal(f.shown[0].options.data.kind,'cad');
 release();await routine;await f.push(id,'scheduler');assert.equal(f.shown.length,2);
 assert.equal(f.shared.get('stickney-cad-receipts-v1').size,1);assert.equal(f.shared.get('stickney-scheduler-receipts-v1').size,1);
 await f.activate();assert.equal(f.shared.get('stickney-scheduler-receipts-v1').size,1);
});
test('device receipt suppresses overlapping and restarted-worker duplicate delivery',async()=>{
 const f=workerFixture(),id='00000000-0000-4000-8000-000000000001';
 await Promise.all([f.push(id),f.push(id),f.push(id)]);assert.equal(f.shown.length,1);assert.equal(f.shown[0].options.renotify,false);
 const restarted=workerFixture(f.shared);await restarted.activate();await restarted.push(id);assert.equal(restarted.shown.length,0);
});
test('failed display does not mark a receipt and blocked storage does not suppress alerts',async()=>{
 const f=workerFixture(),id='00000000-0000-4000-8000-000000000002';
 f.setFail(true);await assert.rejects(f.push(id),/display failed/);f.setFail(false);await f.push(id);assert.equal(f.shown.length,1);
 const blocked=workerFixture(new Map(),true);await blocked.push(id);assert.equal(blocked.shown.length,1);
});
test('device receipt cache is bounded and personal tests without event IDs remain repeatable',async()=>{
 const f=workerFixture();for(let n=0;n<205;n++)await f.push('00000000-0000-4000-8000-'+String(n).padStart(12,'0'));
 assert.equal(f.shared.get('stickney-cad-receipts-v1').size,200);
 await f.push(undefined);await f.push(undefined);assert.equal(f.shown.length,207);
});
test('nonessential poller pauses hidden tabs, deduplicates overlapping refreshes, reconnects and disposes',async()=>{
 const documentListeners=new Map(),windowListeners=new Map(),timers=new Map();let timerId=0;
 const document={hidden:false,addEventListener:(n,f)=>documentListeners.set(n,f),removeEventListener:n=>documentListeners.delete(n)};
 const window={setTimeout:f=>{timers.set(++timerId,f);return timerId;},setInterval:f=>{timers.set(++timerId,f);return timerId;},clearTimeout:id=>timers.delete(id),clearInterval:id=>timers.delete(id),addEventListener:(n,f)=>windowListeners.set(n,f),removeEventListener:n=>windowListeners.delete(n)};
 const compiledModule={exports:{}};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../app/visible-poller.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:compiledModule,exports:compiledModule.exports,window,document,AbortController});
 let requests=0,resolve;const signals=[];
 const poller=compiledModule.exports.startVisiblePolling(async signal=>{requests++;signals.push(signal);await new Promise(r=>{resolve=r;});});
 const first=poller.refresh();await poller.refresh();assert.equal(requests,1);
 document.hidden=true;documentListeners.get('visibilitychange')();assert.equal(signals[0].aborted,true);await poller.refresh();assert.equal(requests,1);
 resolve();await first;document.hidden=false;documentListeners.get('visibilitychange')();assert.equal(requests,2);
 resolve();await new Promise(setImmediate);windowListeners.get('online')();assert.equal(requests,3);
 poller.stop();assert.equal(signals[2].aborted,true);resolve();await poller.refresh();assert.equal(requests,3);
 assert.equal(timers.size,0);assert.equal(documentListeners.size,0);assert.equal(windowListeners.size,0);
});
test('TV board does not mount hidden SmartAlerts; live polling and permission refresh remain unchanged',()=>{
 const source=readFileSync(new URL('../app/payroll-app.tsx',import.meta.url),'utf8');
 assert.match(source,/!tvMode && <SmartAlerts/);
 assert.match(readFileSync(new URL('../app/operations-board.tsx',import.meta.url),'utf8'),/setInterval\(\(\) => void load\(\), 30000\)/);
 assert.match(readFileSync(new URL('../app/respond.tsx',import.meta.url),'utf8'),/10000/);
});
