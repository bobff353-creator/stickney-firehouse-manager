import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { normalizeApparatusUnit, respondingUnitsIncludeUnit } from '../app/respond-device.ts';
import { privatePacketResponse } from '../app/lib/private-packet-response.ts';
import { nextOperationalDeadline } from '../app/operational-deadlines.ts';

const route = readFileSync('app/api/respond/route.ts', 'utf8');
const client = readFileSync('app/respond.tsx', 'utf8').replaceAll('\r\n', '\n');
const compile = source => ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const first = { reportNumber:'TEST-2',callType:'Fictional call two',address:'2 Preview Lane',respondingUnits:'1204',latitude:null,longitude:null };
const second = { reportNumber:'TEST-1',callType:'Fictional call one',address:'1 Preview Lane',respondingUnits:'1205',latitude:null,longitude:null };

function routeHarness() {
  const state = { calls:[first,second], daily:[], allowed:true, sql:[], receipts:[] };
  const db = {prepare(query) {
    state.sql.push(query);
    let args=[];
    const statement={bind(...values){args=values;return statement;},async run(){return {};},async first(){return null;},async all(){
      if(query.startsWith('SELECT event_type')) state.receipts.push(args[0]);
      return {results:query.startsWith('SELECT incident_id reportNumber,call_type')?state.calls:query.includes("WHERE log_date=? AND trim(time_out)")?state.daily:[]};
    }};
    return statement;
  }};
  const mocks={
    '../../lib/private-packet-response':{privatePacketResponse},
    '../../operational-deadlines':{nextOperationalDeadline},
    '../../../db/bootstrap':{ensureDatabase:async()=>db},'node:crypto':{createHash},
    '../../server-permissions':{hasPermission:async()=>state.allowed},
    '../../operational-day':{chicagoOperationalContext:()=>({operationalDate:'2026-09-15'})},
    '../../respond-device':{normalizeApparatusUnit,respondingUnitsIncludeUnit},
    '../../respond-match':{normalizeResponseAddress:value=>value,rankPreplanMatch:()=>null,distanceFeet:()=>0,suggestedStickneyBoxCard:()=>null},
    '../../preplans/domain':{},'../../preplans/profiles':{},'../../preplans/photo-illustrations':{},
  };
  const compiledModule={exports:{}};
  class Clock extends Date {static now(){return 60_000;}}
  vm.runInNewContext(compile(route),{module:compiledModule,exports:compiledModule.exports,require:id=>{assert.ok(id in mocks,id);return mocks[id];},Response,URL,Date:Clock,console,Error});
  const get=(query='',revision='',content='')=>compiledModule.exports.GET(new Request('https://example.invalid/api/respond'+query,{headers:{'x-department-id':'fixture-department',...(revision?{'x-respond-revision':revision}:{}),...(content?{'x-content-revision':content}:{})}}));
  return {state,get};
}

test('selected active report drives the complete packet and CAD notes without new database writes',async()=>{
  const {state,get}=routeHarness();
  const response=await get('?report=TEST-1');
  const body=await response.json();
  assert.equal(body.activeCall.reportNumber,'TEST-1');
  assert.deepEqual(body.activeCalls.map(call=>call.reportNumber),['TEST-2','TEST-1']);
  assert.deepEqual(state.receipts,['TEST-1']);
  assert.equal(body.selectionUnavailable,false);
  const writes=state.sql.filter(sql=>/^(UPDATE|INSERT|DELETE)/.test(sql));
  assert.equal(writes.length,1,'only the pre-existing cleared-call reconciliation runs');
  assert.match(writes[0],/^UPDATE dispatch_incidents SET active=0/);
});

test('apparatus filtering runs before selection and does not expose another unit call',async()=>{
  const {get}=routeHarness();
  const body=await (await get('?apparatus=1204&report=TEST-1')).json();
  assert.equal(body.activeCall.reportNumber,'TEST-2');
  assert.deepEqual(body.activeCalls.map(call=>call.reportNumber),['TEST-2']);
  assert.equal(body.selectionUnavailable,true);
  const empty=await (await get('?apparatus=1208&report=TEST-1')).json();
  assert.equal(empty.activeCall,null);
  assert.deepEqual(empty.activeCalls,[]);
});

test('selection and all active choices are in the revision; updates cannot disappear behind 204',async()=>{
  const {state,get}=routeHarness();
  const original=await get('?report=TEST-1');
  const revision=original.headers.get('x-respond-revision');
  assert.equal((await get('?report=TEST-1',revision)).status,204);
  assert.equal((await get('?report=TEST-2',revision)).status,200);
  state.calls=[{...first,reportNumber:'TEST-3'},first,second];
  const incoming=await get('?report=TEST-1',revision);
  assert.equal(incoming.status,200);
  assert.equal((await incoming.json()).activeCall.reportNumber,'TEST-1','chosen call stays selected');
  state.calls=[first];
  const cleared=await (await get('?report=TEST-1')).json();
  assert.equal(cleared.activeCall.reportNumber,'TEST-2');
  assert.equal(cleared.selectionUnavailable,true);
  assert.equal((await (await get()).json()).activeCall.reportNumber,'TEST-2','automatic chooses latest');
  state.allowed=false;
  assert.equal((await get('?report=TEST-1',revision)).status,403);
});

test('Daily Log fallback exposes the same scoped selection when CAD has no eligible calls',async()=>{
  const {state,get}=routeHarness();
  state.calls=[];state.daily=[first,second];
  assert.equal((await (await get('?report=TEST-1')).json()).activeCall.reportNumber,'TEST-1');
  assert.equal((await (await get('?apparatus=1204&report=TEST-1')).json()).activeCalls.length,1);
});

const loadBlock=client.slice(client.indexOf('  const load = useCallback('),client.indexOf('  const refreshLive = useCallback('));
assert.ok(loadBlock.includes('isCurrentRequest'));
const loadFactory=new Function('context',compile(`
  const {apparatus,selectedReportNumber,requestInFlight,lastPacketRevision,lastContentRevision,departmentIdRef,fetch,
    setData,setLastRefresh,setRespondSource,setCachedAt,setError,setSelectedReportNumber,setSelectionNotice,setNextChangeAt,reloadRequested,reloadTimer,
    setSelected,setSelectedHazmatId,setSelectedLevelId,setView,setShowAllAttachments,
    cacheRespondPacket,removeCachedRespondPacket,getCachedRespondPacket,clearCachedRespondPackets}=context;
  const useCallback=fn=>fn;
  const isCachedRespondData=value=>Boolean(value?.activeCall?.reportNumber && value?.preplan?.id);
  ${loadBlock}
  return load;
`));
function clientHarness() {
  const state={packets:[],errors:[],clearCount:0,cached:null,requests:[]};
  const context={apparatus:'',selectedReportNumber:'',requestInFlight:{current:null},lastPacketRevision:{current:{apparatus:'',reportNumber:'',revision:''}},departmentIdRef:{current:'fixture-department'},
    lastContentRevision:{current:{apparatus:'',reportNumber:'',revision:''}},
    setNextChangeAt:()=>{},reloadRequested:{current:false},reloadTimer:{current:null},
    setData:value=>state.packets.push(value),setError:value=>state.errors.push(value),
    setLastRefresh:()=>{},setRespondSource:()=>{},setCachedAt:()=>{},setSelectedReportNumber:()=>{},setSelectionNotice:()=>{},
    setSelected:()=>{},setSelectedHazmatId:()=>{},setSelectedLevelId:()=>{},setView:()=>{},setShowAllAttachments:()=>{},
    cacheRespondPacket:async()=>{},removeCachedRespondPacket:async()=>{},getCachedRespondPacket:async()=>state.cached,clearCachedRespondPackets:async()=>{state.clearCount++;},
    fetch:async(url,options)=>{state.requests.push({url,options});return new Response('{}');},
  };
  return {state,context};
}
const packet=reportNumber=>({departmentId:'fixture-department',activeCall:{reportNumber},preplan:{id:'plan-'+reportNumber}});

test('late responses from an earlier selection cannot overwrite the newer call',async()=>{
  const {state,context}=clientHarness();
  let resolveOld;
  const old=loadFactory({...context,selectedReportNumber:'OLD',fetch:()=>new Promise(resolve=>{resolveOld=resolve;})});
  const pending=old();
  const newer=loadFactory({...context,selectedReportNumber:'NEW',fetch:async()=>Response.json(packet('NEW'))});
  await newer();
  resolveOld(Response.json(packet('OLD')));
  await pending;
  assert.deepEqual(state.packets.map(item=>item?.activeCall?.reportNumber),['NEW']);
  assert.equal(context.requestInFlight.current,null);
});

test('selected-call failures never substitute a cached packet for another call',async()=>{
  const {state,context}=clientHarness();
  state.cached={payload:packet('OLD'),cachedAt:'2026-09-15'};
  await loadFactory({...context,selectedReportNumber:'NEW',fetch:async()=>{throw new Error('Offline');}})();
  assert.equal(state.packets.length,0);
  assert.match(state.errors.at(-1),/Offline/);
  await loadFactory({...context,selectedReportNumber:'OLD',fetch:async()=>{throw new Error('Offline');}})();
  assert.equal(state.packets.at(-1).activeCall.reportNumber,'OLD');
});

test('access denial clears private cached packets and never uses them as fallback',async()=>{
  const {state,context}=clientHarness();
  state.cached={payload:packet('OLD')};
  await loadFactory({...context,selectedReportNumber:'OLD',fetch:async()=>Response.json({error:'Access denied'},{status:403})})();
  assert.deepEqual(state.packets,[null]);
  assert.equal(state.clearCount,1);
  assert.match(state.errors.at(-1),/Access denied/);
});

test('request revision is scoped to apparatus and selected report, with rapid fallback',async()=>{
  const {state,context}=clientHarness();
  context.lastPacketRevision.current={apparatus:'1204',reportNumber:'OTHER',revision:'old'};
  await loadFactory({...context,apparatus:'1204',selectedReportNumber:'CALL & 1'})();
  assert.equal(state.requests[0].url,'/api/respond?apparatus=1204&report=CALL%20%26%201');
  assert.equal(state.requests[0].options.headers['x-respond-revision'],undefined);
  assert.match(client,/useOperationalUpdates\(\{ scope: 'respond',[^\n]*fallbackMs: 10_000/);
  assert.match(client,/setData\(null\);[\s\S]*setView\("cad"\)/);
});

test('Monitor View keeps an exit while a selected call is loading or fails',()=>{
  const transientViews=client.slice(client.indexOf('if (!data && !error)'),client.indexOf('if (!call)'));
  assert.equal((transientViews.match(/monitorMode && <button onClick=\{\(\) => void toggleMonitor\(\)\}>Exit Monitor<\/button>/g)||[]).length,2);
});

test('unchanged full validation advances the cheap revision without replacing the selected packet',async()=>{
  const {state,context}=clientHarness();
  context.lastPacketRevision.current={apparatus:'',reportNumber:'',revision:'old-query'};
  context.lastContentRevision.current={apparatus:'',reportNumber:'',revision:'same-content'};
  await loadFactory({...context,fetch:async()=>new Response(null,{status:204,headers:{'x-respond-revision':'new-query','x-content-revision':'same-content'}})})();
  assert.equal(context.lastPacketRevision.current.revision,'new-query');
  assert.equal(context.lastContentRevision.current.revision,'same-content');
  assert.equal(state.packets.length,0);
  await loadFactory(context)();
  assert.equal(state.requests.at(-1).options.headers['x-respond-revision'],'new-query');
});

test('full reference validation can confirm unchanged Respond content without resending the packet',async()=>{
  const {get,state}=routeHarness();const first=await get('?report=TEST-1');
  const content=first.headers.get('x-content-revision');assert.ok(content);state.sql.length=0;
  const unchanged=await get('?report=TEST-1','',content);assert.equal(unchanged.status,204);assert.equal(await unchanged.text(),'');
  assert.ok(state.sql.some(query=>query.includes('FROM field_preplans')),'reference data was still rechecked');
  state.calls=[...state.calls,{...second,reportNumber:'TEST-NEW'}];
  assert.equal((await get('?report=TEST-1','',content)).status,200,'new call choice invalidates unchanged packet');
});
