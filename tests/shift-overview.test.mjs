import test from 'node:test';
import assert from 'node:assert/strict';
import { shiftOverview, shiftPacketStale } from '../app/shift-overview.ts';
import { crewCommands } from '../app/crew-commands.ts';
import { portalNeedsPayroll } from '../app/portal-data-needs.ts';
import { portalPageFromSearch } from '../app/portal-navigation.ts';

const pages = ['Dashboard','Scheduling','Inventory','Daily Log','Payroll','Respond'];
const packet = (changes = {}) => ({
  asOf: '2026-10-05T13:00:00Z', date: '2026-10-05', currentShift: 'morning', staffingSource: 'daily_log',
  onDuty: [], officerInCharge: 'Test officer', staffing: {filled:4,required:4,complete:true},
  equipmentIssues: [], checksDue:0, fleet: [{id:'fixture-unit',name:'Test apparatus',status:'in_service'}],
  fleetIssuesAvailable:true, approvals:{logs:0,payroll:0}, nextShift:null, activeCalls:[], previousShift:null, ...changes,
});

test('Today works without payroll and retains the existing home URL', () => {
  assert.equal(portalNeedsPayroll('Dashboard'), false);
  assert.equal(portalNeedsPayroll('Daily Log'), true);
  assert.equal(portalNeedsPayroll('Payroll'), true);
  assert.equal(portalPageFromSearch('?page=dashboard'), 'Dashboard');
  assert.equal(portalPageFromSearch('?page=today'), 'Dashboard');
});
test('unknown or empty fleet, checks and defects never yield an all-clear', () => {
  for (const changes of [{fleet:null},{fleet:[]},{fleet:[{id:'u',name:'Unknown',status:'unknown'}]},{checksDue:null},{fleetIssuesAvailable:false}]) {
    const overview = shiftOverview(packet(changes), pages);
    assert.equal(overview.state,'unknown');
    assert.ok(overview.parts.some(part=>part.state==='unknown'));
  }
  assert.equal(shiftOverview(packet(), pages).state,'ready');
  assert.equal(shiftOverview(packet(), ['Dashboard','Scheduling']).state,'unknown');
});
test('readiness percentages have an explicit denominator and reject invalid staffing', () => {
  const half=shiftOverview(packet({staffing:{filled:2,required:4,complete:false},fleet:[{id:'a',name:'A',status:'in_service'},{id:'b',name:'B',status:'out_of_service'}]}),pages);
  assert.equal(half.parts.find(part=>part.id==='staffing').percent,50);
  assert.equal(half.parts.find(part=>part.id==='fleet').percent,50);
  assert.equal(half.state,'attention');
  for(const required of [0,-1,NaN,Infinity]) assert.equal(shiftOverview(packet({staffing:{filled:4,required,complete:true}}),pages).parts[0].state,'unknown');
});
test('Inbox sorts critical defects first and keeps stable source IDs and task routes', () => {
  const overview=shiftOverview(packet({checksDue:2,approvals:{logs:1,payroll:2},fleet:[{id:'a',name:'A',status:'out_of_service'}],equipmentIssues:[{id:'defect',item:'Broken tool',status:'failed · high priority',detail:'Saved note'}]}),pages);
  assert.deepEqual(overview.items.slice(0,2).map(item=>item.severity),['critical','critical']);
  assert.ok(overview.items.some(item=>item.id==='issue-defect'&&item.record.adminTask==='service'));
  assert.equal(overview.items.filter(item=>item.id==='checks').length,1);
  assert.equal(overview.items.at(-1).id,'payroll');
});
test('the projection never exposes items or component details for unavailable modules', () => {
  const limited=shiftOverview(packet({checksDue:2,approvals:{logs:1,payroll:2},equipmentIssues:[{id:'private',item:'Secret',status:'critical',detail:'Hidden'}]}),['Dashboard']);
  assert.deepEqual(limited.items,[]);
  assert.deepEqual(limited.parts.map(part=>part.id),['staffing']);
  assert.doesNotMatch(JSON.stringify(limited),/Secret|Hidden|payroll/);
});
test('stale, failed, malformed and future timestamps cannot show current readiness', () => {
  const now=Date.parse('2026-10-05T13:01:00Z');
  assert.equal(shiftPacketStale(packet(),now,false),false);
  assert.equal(shiftPacketStale(packet(),now,true),true);
  assert.equal(shiftPacketStale(packet(),now+121000,false),true);
  assert.equal(shiftPacketStale(null,now,false),true);
  assert.equal(shiftPacketStale({asOf:'not a date'},now,false),true);
  assert.equal(shiftPacketStale({asOf:'2026-10-06T13:00:00Z'},now,false),true);
});
test('task commands require page grants and action grants; no payroll fallback grants', () => {
  assert.deepEqual(crewCommands([],[]),[]);
  assert.equal(crewCommands(['Inventory'],['inventory.view']).some(command=>command.id==='check'),false);
  assert.equal(crewCommands(['Inventory'],['inventory.check']).some(command=>command.id==='check'),true);
  assert.equal(crewCommands(['Daily Log'],['daily_log.view']).some(command=>command.id==='log'),false);
  assert.equal(crewCommands(['Daily Log'],['daily_log.manage']).some(command=>command.id==='log'),true);
  assert.equal(crewCommands(['Dashboard'],[]).length,1);
});
