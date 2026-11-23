import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync('app/inventory-operations.tsx','utf8');
function harness(response){
 const original={id:'entry',check_id:'check',section:'pack',equipment_id:'linked-equipment',asset_number:'123',result:'pending'};
 const state={data:{scbaEntries:[original,{id:'other',result:'pending'}]},requests:[],error:'',busy:''};
 const scope={data:state.data,itemSavePending:{current:false},mutationPending:{current:false},itemSaveGeneration:{current:0},value:(row,key)=>String(row[key]??''),setData:fn=>state.data=fn(state.data),setBusy:v=>state.busy=v,setError:v=>state.error=v,setMessage:()=>{},setSaveReceipt:()=>{},setLastSyncedAt:()=>{},AbortSignal,fetch:async(url,options)=>{state.requests.push({url,...options});return response();}};
 const body=source.slice(source.indexOf('  async function recordScbaEntry('),source.indexOf('  async function uploadEvidence('));
 const js=ts.transpileModule(body+'\nreturn recordScbaEntry;', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 return {state,scope,save:new Function(...Object.keys(scope),js)(...Object.values(scope))};
}
test('air-pack save finishes with one confirmed POST, retains linked fields and does not reload inventory',async()=>{
 let release;const wait=new Promise(resolve=>release=resolve);
 const h=harness(async()=>{await wait;return Response.json({scbaEntry:{id:'entry',check_id:'check',result:'pass',psi:4500,checked_at:'2026-11-23T12:00:00Z'}});});
 const saving=h.save('scba-entry',{action:'record_scba_entry',entryId:'entry',result:'pass'});
 assert.equal(h.state.busy,'scba-entry');assert.equal(h.scope.itemSavePending.current,true);
 assert.equal(await h.save('scba-entry',{entryId:'entry'}),false);
 release();assert.equal(await saving,true);
 assert.equal(h.state.requests.length,1);assert.equal(h.state.requests[0].method,'POST');
 assert.equal(h.state.data.scbaEntries[0].result,'pass');assert.equal(h.state.data.scbaEntries[0].equipment_id,'linked-equipment');
 assert.equal(h.state.data.scbaEntries[1].result,'pending');assert.equal(h.scope.itemSaveGeneration.current,2);assert.equal(h.state.busy,'');
});
test('missing, wrong-check or rejected save confirmation never marks an air-pack entry saved',async()=>{
 for(const result of [{},{scbaEntry:{id:'entry',check_id:'other-check',result:'pass',checked_at:'now'}},{error:'Access denied'}]){
  const h=harness(()=>Response.json(result,{status:result.error?403:200}));
  assert.equal(await h.save('scba-entry',{entryId:'entry',result:'pass'}),false);
  assert.equal(h.state.data.scbaEntries[0].result,'pending');assert.ok(h.state.error);assert.equal(h.scope.itemSavePending.current,false);
 }
});
test('a timed-out air-pack confirmation keeps the result pending and gives recovery guidance',async()=>{
 const h=harness(()=>{throw new DOMException('Timed out','TimeoutError');});
 assert.equal(await h.save('scba-entry',{entryId:'entry',result:'pass'}),false);
 assert.equal(h.state.data.scbaEntries[0].result,'pending');
 assert.match(h.state.error,/Refresh crew progress before retrying; the server may have saved/);
});
