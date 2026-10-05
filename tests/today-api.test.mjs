import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function routeFixture(permissions, failFleet = false) {
  const inventoryCalls = [];
  let queries = 0;
  const db = { prepare(sql) {
    queries++;
    return { bind() { return this; }, async run() {}, async first() { return sql.includes('pay_periods') ? {count:3} : {}; }, async all() {
      if (sql.includes('daily_log_staffing s')) return {results:[{employeeId:'crew',name:'Test Crew',rank:'Firefighter',timeIn:'0600',timeOut:'1800',actingOfficer:0}]};
      if (sql.includes('daily_log_approvals a')) return {results:[{shiftKey:'morning',officerName:'Test Officer',signInAt:'fixture',signInEquipment:JSON.stringify({Saw:{status:'Broken',detail:'Handoff private'}}),signInNote:'Private handoff'}]};
      if (sql.includes('SELECT report_number')) return {results:[{reportNumber:'fixture-call',timeOut:'0700',timeIn:'',callType:'Test incident',address:'Test location'}]};
      return {results:[]};
    }};
  }};
  const client = { from(table) {
    const row = { select() {return this;}, eq(key,value) {inventoryCalls.push([table,key,value]); return this;}, order() {return this;}, then(resolve,reject) {
      const result={data:table==='inventory_apparatus_profiles'?[{id:'u',name:'Test unit'}]:[{id:'u',status:'in_service'}],error:failFleet?{message:'fixture failure'}:null};
      return Promise.resolve(result).then(resolve,reject);
    }};
    return row;
  }};
  const exports = {};
  const dependencies = {
    '../../server-permissions': { permissionsForEmail: async()=>new Set(permissions), hasAnyPermission:async(_request,_db,required)=>required.some(value=>permissions.includes(value)) },
    '../../../db/bootstrap': {ensureDatabase:async()=>db},
    '../../dispatch-daily-log': {projectDispatchIntoDailyLog:async()=>{}},
    '../../department-schedule': {scheduleQueryDates:()=>[],scheduledStaffingForLog:()=>[]},
    '../../operational-day': {chicagoOperationalContext:()=>({operationalDate:'2026-10-05',calendarDate:'2026-10-05',minutes:420})},
    '../../lib/fleet-projections': {openFleetEquipmentIssues:async(_client,department)=>{inventoryCalls.push(['issues','department_id',department]);if(failFleet)throw Error('Fixture unavailable');return [{id:'issue',item:'Test defect',status:'high priority',detail:'Repair private'}];},pendingDailyFleetChecks:async()=>[{id:'check'}]},
    '../../lib/supabase-server': {createInventorySupabaseClient:async()=>client},
    '../../operational-deadlines': {nextOperationalDeadline:()=>null},
  };
  vm.runInNewContext(ts.transpileModule(readFileSync('app/api/dashboard/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Response,URL,console:{error(){}},require:name=>{assert.ok(name in dependencies,name);return dependencies[name];}});
  return {GET:exports.GET,inventoryCalls,queries:()=>queries};
}
const request = () => new Request('https://portal.test/api/dashboard?scope=today',{headers:{'oai-authenticated-user-email':'fixture@example.test','x-department-id':'department-fixture'}});

test('Today rejects absent dashboard access before any records are read', async()=>{
  for(const grants of [[],['operations_board.view'],['inventory.view']]) {
    const fixture=routeFixture(grants),response=await fixture.GET(request());
    assert.equal(response.status,403);
    assert.equal(fixture.queries(),0);
    assert.equal(fixture.inventoryCalls.length,0);
  }
});
test('server redacts log, fleet, payroll and response without module grants',async()=>{
  const fixture=routeFixture(['dashboard.view']),response=await fixture.GET(request()),data=await response.json();
  assert.equal(response.status,200);
  assert.match(response.headers.get('cache-control'),/private, no-store/);
  assert.equal(data.onDuty.length,1);
  assert.equal(data.fleet,null);assert.equal(data.checksDue,null);assert.equal(data.activeCalls,null);assert.equal(data.previousShift,null);
  assert.equal(data.approvals.logs,null);assert.equal(data.approvals.payroll,null);
  assert.equal(fixture.inventoryCalls.length,0);
  assert.doesNotMatch(JSON.stringify(data),/private|Test defect|Test incident|Test Officer/);
});
test('authorized sources are scoped to the verified department and omit full incident payloads',async()=>{
  const fixture=routeFixture(['dashboard.view','inventory.view','daily_log.view','payroll.manage','field_preplans.view']),response=await fixture.GET(request()),data=await response.json();
  assert.equal(response.status,200);assert.equal(data.fleet[0].id,'u');assert.equal(data.fleetIssuesAvailable,true);assert.equal(data.checksDue,1);
  assert.equal(data.equipmentIssues.length,2);assert.equal(data.approvals.payroll,3);assert.equal(data.activeCalls.length,1);
  assert.deepEqual(Object.keys(data.activeCalls[0]).sort(),['address','callType','reportNumber']);
  assert.ok(fixture.inventoryCalls.length>=3);
  for(const [,key,value] of fixture.inventoryCalls){assert.equal(key,'department_id');assert.equal(value,'department-fixture');}
});
test('failed fleet reads are unknown, not an empty operational all-clear',async()=>{
  const fixture=routeFixture(['dashboard.view','inventory.view'],true),data=await (await fixture.GET(request())).json();
  assert.equal(data.fleet,null);assert.equal(data.checksDue,null);assert.equal(data.fleetIssuesAvailable,false);
});
