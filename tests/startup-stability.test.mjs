import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { definitiveAuthFailure, boundedAuthRead } from '../app/auth-failure-policy.ts';
import { portalNeedsPayroll } from '../app/portal-data-needs.ts';

test('independent operational pages do not require payroll data', () => {
  for (const page of ['Field Preplans','Scheduling','Inventory','Respond','Operations Board','Permissions','Test View','Policies','Command Center','Work Details']) assert.equal(portalNeedsPayroll(page), false, page);
  for (const page of ['Dashboard','Payroll','Timesheets','My Timesheet','Employees','Rates & Rules','Daily Log']) assert.equal(portalNeedsPayroll(page), true, page);
});

test('only definitive auth failures expire a login; outages remain retryable', () => {
  for (const error of [{status:401},{status:403},{name:'AuthSessionMissingError'},{status:400,code:'refresh_token_not_found'},{code:'session_expired'}]) assert.equal(definitiveAuthFailure(error),true);
  for (const error of [{status:503},{status:500},{status:429},new TypeError('Failed to fetch'),new Error('interrupted'),null]) assert.equal(definitiveAuthFailure(error),false);
});

test('stalled identity checks have a bounded recovery path', async () => {
  assert.equal(await boundedAuthRead(Promise.resolve('verified'),20),'verified');
  await assert.rejects(boundedAuthRead(new Promise(()=>{}),5),/could not be verified/);
});

test('six mounted permission consumers use one timer, hidden tabs pause, and cleanup resets identity', async () => {
  const saved={fetch:globalThis.fetch,window:globalThis.window,document:globalThis.document,BroadcastChannel:globalThis.BroadcastChannel};
  const effects=[],subscriptions=[],timers=new Map();let id=0,requests=0,channels=0;
  const w=Object.assign(new EventTarget(),{setInterval(fn,ms){assert.equal(ms,15000);timers.set(++id,fn);return id;},clearInterval(i){timers.delete(i);}});
  const d=Object.assign(new EventTarget(),{visibilityState:'visible'});
  globalThis.window=w;globalThis.document=d;globalThis.BroadcastChannel=class{constructor(){channels++;}close(){channels--;}};
  globalThis.fetch=async()=>{requests++;return Response.json({viewerPermissions:['inventory.view'],identity:'fixture:member',confirmation:{required:false}});};
  const module={exports:{}};
  new Function('require','module','exports',ts.transpileModule(fs.readFileSync('app/use-permissions.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>{assert.equal(name,'react');return{useEffect(fn){effects.push(fn);},useSyncExternalStore(sub,snapshot){subscriptions.push(sub);return snapshot();}};},module,module.exports);
  const hooks=module.exports,cleanups=[];
  try {
    for(let i=0;i<6;i++){hooks.usePermissions();const off=subscriptions.at(-1)(()=>{}),stop=effects.at(-1)();cleanups.push(()=>{stop();off();});await new Promise(r=>setImmediate(r));}
    assert.equal(requests,1);assert.equal(timers.size,1);assert.equal(channels,1);
    d.visibilityState='hidden';[...timers.values()][0]();await new Promise(r=>setImmediate(r));assert.equal(requests,1);
    d.visibilityState='visible';d.dispatchEvent(new Event('visibilitychange'));await new Promise(r=>setImmediate(r));assert.equal(requests,2);
    w.dispatchEvent(new Event('offline'));assert.equal(hooks.usePermissions().verified,false);
    w.dispatchEvent(new Event('online'));await new Promise(r=>setImmediate(r));assert.equal(requests,3);
    cleanups.splice(0).forEach(fn=>fn());assert.equal(timers.size,0);assert.equal(channels,0);assert.equal(hooks.usePermissions().identity,'');
  } finally {cleanups.forEach(fn=>fn());Object.assign(globalThis,saved);}
});

test('call detection remains eager and polling intervals are unchanged', () => {
  const portal=fs.readFileSync('app/payroll-app.tsx','utf8');
  assert.match(portal,/import Respond from "\.\/respond"/);assert.match(portal,/import OperationsBoard from "\.\/operations-board"/);
  assert.match(portal,/const FieldPreplans = dynamic/);assert.match(portal,/const StationScheduler = dynamic/);
  assert.match(fs.readFileSync('app/respond.tsx','utf8'),/setInterval\(\(\) => void load\(\), 10000\)/);
});

test('Inventory shares concurrent background reads but fetches anew after a save', async () => {
  const source=fs.readFileSync('app/inventory-operations.tsx','utf8');
  const block=source.slice(source.indexOf('  const load = useCallback('),source.indexOf('  }, [initialApparatusId, onRecords]);')+'  }, [initialApparatusId, onRecords]);'.length);
  assert.match(block,/fresh = false/);
  const code=ts.transpileModule(block,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  let shown=null;const replies=[],records=[];
  const ref=current=>({current});
  const env={useCallback:fn=>fn,document:{visibilityState:'visible'},navigator:{onLine:true},
    itemSavePending:ref(false),itemSaveGeneration:ref(0),readPending:ref(null),readController:ref(null),readerMounted:ref(true),
    initialApparatusId:'fixture',setLoading(){},setAccessRequired(){},setData(data){shown=data;},setViewerEmployeeId(){},setEmployees(){},setSelectedApparatusId(){},setLastSyncedAt(){},setRefreshError(){},onRecords:r=>records.push(r),
    fetch:async url=>url==='/api/operations'?await new Promise(resolve=>replies.push(resolve)):Response.json({}),
  };
  const load=new Function(...Object.keys(env),code+';return load;')(...Object.values(env));
  const first=load({background:true});const duplicate=load({background:true});assert.equal(replies.length,1);
  const afterSave=load({background:true,fresh:true});assert.equal(replies.length,1);
  replies[0](Response.json({configured:true,equipment:[{id:'old'}]}));await first;await duplicate;await new Promise(resolve=>setImmediate(resolve));
  assert.equal(shown,null,'A pre-save response replaced the saved preview');assert.equal(replies.length,2);
  replies[1](Response.json({configured:true,equipment:[{id:'saved'}]}));assert.equal(await afterSave,true);assert.equal(shown.equipment[0].id,'saved');assert.equal(records.length,1);
  env.document.visibilityState='hidden';assert.equal(await load({background:true}),false);assert.equal(replies.length,2);
  env.document.visibilityState='visible';const closing=load({background:true});env.readerMounted.current=false;env.readController.current.abort();replies[2](Response.json({configured:true,equipment:[{id:'late'}]}));await closing;assert.equal(shown.equipment[0].id,'saved');
});
