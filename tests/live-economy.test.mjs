import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { privatePacketResponse } from '../app/lib/private-packet-response.ts';
import { createConditionalJsonReader } from '../app/conditional-json-reader.ts';
import { synchronizedSlide } from '../app/board-sync-clock.ts';

const source = path => readFileSync(path, 'utf8');
function compileRoute(path, mocks) {
  const compiledModule = {exports:{}};
  vm.runInNewContext(ts.transpileModule(source(path), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {
    module:compiledModule,exports:compiledModule.exports,require:id=>{assert.ok(id in mocks,id);return mocks[id];},Request,Response,URL,console,
  });
  return compiledModule.exports;
}
test('bundled board rechecks all original scopes; unchanged content sends no payload',async()=>{
  const checks=[],state={call:'FIRST',denied:false,failed:false}; let stamp=0;
  const handler = kind => async request => {
    checks.push({kind,scope:new URL(request.url).searchParams.get('scope'),department:request.headers.get('x-department-id')});
    if(state.denied&&kind==='fleet')return Response.json({error:'Denied'},{status:403});
    if(state.failed&&kind==='duties')return Response.json({error:'Unavailable'},{status:503});
    return Response.json(kind==='dashboard'?{asOf:String(++stamp),activeCalls:[{reportNumber:state.call}]}:{items:[kind]});
  };
  const api=compileRoute('app/api/live-operations/route.ts',{
    '../dashboard/route':{GET:handler('dashboard')},'../daily-duties/route':{GET:handler('duties')},'../suite-context/route':{GET:handler('fleet')},
    '../../lib/private-packet-response':{privatePacketResponse},
    '../../lib/inventory-session':{verifyInventoryRequest:async()=>({ok:true,context:{grants:['operations_board.view']}})},
  });
  const request=revision=>new Request('https://fixture.invalid/api/live-operations',{headers:{'x-department-id':'fixture',...(revision?{'x-content-revision':revision}:{})}});
  const first=await api.GET(request());assert.equal(first.status,200);
  const revision=first.headers.get('x-content-revision');assert.ok(revision);
  const second=await api.GET(request(revision));assert.equal(second.status,204);assert.equal(await second.text(),'');
  assert.equal(checks.length,6);assert.ok(checks.every(check=>check.scope==='live-operations'&&check.department==='fixture'));
  state.call='NEW';const changed=await api.GET(request(revision));assert.equal(changed.status,200);assert.equal((await changed.json()).dashboard.payload.activeCalls[0].reportNumber,'NEW');
  state.denied=true;const denied=await api.GET(request(revision));assert.equal(denied.status,403);assert.doesNotMatch(await denied.text(),/FIRST|NEW|items/);
  state.denied=false;state.failed=true;const failed=await api.GET(request(revision));assert.equal(failed.status,200);assert.equal(failed.headers.get('x-content-revision'),null);assert.equal((await failed.json()).duties.status,503);
});

test('conditional reader reuses only confirmed content; denial/error never become cached success',async()=>{
  const calls=[];let status=200,payload={call:'ONE'};
  const reader=createConditionalJsonReader(async(url,init)=>{
    const request=new Request('https://fixture.invalid'+url,init);calls.push(request);
    if(status!==200)return new Response(status===204?null:JSON.stringify({error:'Denied'}),{status});
    return privatePacketResponse(request,payload);
  });
  assert.deepEqual(await (await reader.read('/api/example')).json(),payload);
  assert.deepEqual(await (await reader.read('/api/example')).json(),payload);
  assert.ok(calls[1].headers.get('x-content-revision'));
  payload={call:'TWO'};assert.deepEqual(await (await reader.read('/api/example')).json(),payload);
  status=403;assert.equal((await reader.read('/api/example')).status,403);
  status=204;await assert.rejects(reader.read('/api/example'),/no saved packet/);
  assert.equal(calls.at(-1).headers.get('x-content-revision'),null);
});

test('aborted or cleared reads cannot populate a later user/component packet',async()=>{
  let resolve;const reader=createConditionalJsonReader(()=>new Promise(done=>{resolve=done;}));
  const pending=reader.read('/api/example');reader.clear();resolve(Response.json({private:'old'},{headers:{'x-content-revision':'old'}}));
  await assert.rejects(pending,/canceled/);
  const controller=new AbortController();const aborted=reader.read('/api/example',{signal:controller.signal});controller.abort();resolve(Response.json({private:'old'}));await assert.rejects(aborted,/canceled/);
});

test('all TVs derive the same rotations from time, without a network timer',()=>{
  for(const duration of [8000,10000,12000]) for(const now of [0,59999,60000,Date.parse('2026-11-01T07:00:00Z')]) {
    assert.equal(synchronizedSlide(now,duration,7),Math.floor(now/duration)%7);
  }
  for(const file of ['operations-board','chief-board-panel','staffing-rotation'])assert.match(source(`app/${file}.tsx`),/synchronizedSlide\(Date.now\(\)/);
  assert.doesNotMatch(source('app/board-sync-clock.ts'),/fetch\(/);
});

test('Home summaries require document access but do not read document bodies or history',async()=>{
  const sql=[];let allowed=true;
  const db={prepare(query){sql.push(query);return{first:async()=>({count:17})};}};
  const api=compileRoute('app/api/resources/route.ts',{'../../../db/bootstrap':{ensureDatabase:async()=>db},'../../server-permissions':{hasPermission:async()=>allowed}});
  const request=new Request('https://fixture.invalid/api/resources?type=policy&summary=1');
  assert.deepEqual(await (await api.GET(request)).json(),{count:17});assert.deepEqual(sql,['SELECT COUNT(*) count FROM policies']);
  allowed=false;assert.equal((await api.GET(request)).status,403);assert.equal(sql.length,1);
});

test('Inventory confirms unchanged packets only after fresh scoped reads; changes and errors stay visible',async()=>{
  const state={allowed:true,fail:false,name:'Fixture unit',reads:0};
  const db={from(table){
    const filters=[];
    const query={
      select(){return query;},eq(key,value){filters.push([key,value]);return query;},order(){return query;},range(){return query;},
      in(){return query;},neq(){return query;},not(){return query;},is(){return query;},limit(){return query;},
      then(resolve,reject){
        state.reads++;assert.ok(filters.some(([key,value])=>key==='department_id'&&value==='fixture'));
        return Promise.resolve({data:table==='inventory_apparatus_profiles'?[{id:'rig',name:state.name}]:[],error:state.fail?'Unavailable':null}).then(resolve,reject);
      },
    };return query;
  }};
  const api=compileRoute('app/api/operations/route.ts',{
    '../../lib/supabase-server':{createInventorySupabaseClient:async()=>db},'../../inventory-air-input':{},'../../inventory-service-schedule':{},
    '../../lib/private-packet-response':{privatePacketResponse},
    '../../lib/inventory-session':{verifyInventoryRequest:async()=>({ok:state.allowed,context:{department:{id:'fixture'},user:{email:'local@example.invalid'},role:'member'}}),sessionFailureResponse:()=>Response.json({error:'Denied'},{status:403})},
  });
  const request=revision=>new Request('https://fixture.invalid/api/operations',{headers:revision?{'x-content-revision':revision}:{}});
  const first=await api.GET(request());assert.equal(first.status,200);const revision=first.headers.get('x-content-revision');assert.ok(revision);
  const reads=state.reads;assert.equal((await api.GET(request(revision))).status,204);assert.equal(state.reads,reads*2);
  state.name='Changed fixture unit';const changed=await api.GET(request(revision));assert.equal(changed.status,200);assert.match(await changed.text(),/Changed fixture unit/);
  state.fail=true;assert.equal((await api.GET(request(revision))).status,503);
  state.allowed=false;const before=state.reads;assert.equal((await api.GET(request(revision))).status,403);assert.equal(state.reads,before);
  assert.match(source('app/inventory-operations.tsx'),/packetReader.current.read\('\/api\/operations'/);
});

test('poll safety, provider-cache freshness, and hidden noncritical panels retain their boundaries',()=>{
  assert.match(source('app/operations-board.tsx'),/fallbackMs: 30_000/);
  assert.match(source('app/respond.tsx'),/fallbackMs: 10_000/);
  assert.match(source('app/use-permissions.ts'),/setInterval\(refresh, 15000\)/);
  assert.match(source('app/inventory-operations.tsx'),/background && \(document.visibilityState === "hidden" \|\| !navigator.onLine\)/);
  assert.match(source('app/api/river-gauge/route.ts'),/next: \{ revalidate: 300 \}/);
  assert.doesNotMatch(source('app/api/river-gauge/route.ts'),/cacheEverything/);
  assert.match(source('app/chief-board-panel.tsx'),/fetch\("\/api\/river-gauge", \{ signal \}\)/);
});
