import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { autoDistribute, compareDistributionCandidates, scheduledDistributionHours, seniorityFromStartDate } from '../app/station-scheduler-logic.ts';

const legacyWeights={seniorityWeight:10,hoursWeight:0,customWeight:10,customLabel:'Old preference'};
const employee=(id,changes={})=>({employeeId:id,name:id,rank:'Firefighter',seniority:10,hours:0,crossTrained:false,...changes});
const shift=(id,changes={})=>({slotId:id,date:'2026-10-01',role:'FF/Attendant',hours:6,startTime:'06:00',endTime:'12:00',...changes});

test('availability and role eligibility are hard gates regardless of hours and rank',()=>{
  const result=autoDistribute([shift('s')],[employee('not-eligible',{rank:'Chief'}),employee('eligible',{hours:50})],legacyWeights,{s:['eligible']});
  assert.equal(result[0].employeeId,'eligible');
  assert.equal(autoDistribute([shift('s')],[employee('a')],legacyWeights,{}).length,0);
});
test('fewer scheduled hours always beat rank, seniority and cross-training weights',()=>{
  const junior=employee('junior',{hours:6,seniority:1});
  const senior=employee('senior',{hours:12,rank:'Chief',seniority:5000,crossTrained:true});
  assert.equal(autoDistribute([shift('s')],[senior,junior],legacyWeights,{s:['senior','junior']})[0].employeeId,'junior');
  assert.ok(compareDistributionCandidates(junior,senior)<0);
});
test('equal hours use rank, then earlier start date, then deterministic final ties',()=>{
  const today='2026-09-17';
  const lieutenant=employee('lt',{rank:'Lieutenant',seniority:seniorityFromStartDate('2000-01-01',today)});
  const captain=employee('captain',{rank:'Captain',seniority:seniorityFromStartDate('2020-01-01',today)});
  assert.ok(compareDistributionCandidates(captain,lieutenant)<0);
  const earlier=employee('earlier',{rank:'Captain',seniority:seniorityFromStartDate('2010-01-01',today)});
  assert.ok(compareDistributionCandidates(earlier,captain)<0);
  assert.ok(compareDistributionCandidates(captain,employee('unknown',{rank:'Captain',seniority:seniorityFromStartDate('',today)}))<0);
  assert.ok(compareDistributionCandidates(employee('a'),employee('b'))<0);
});
test('scheduled hours include recurring nights, merge duplicate roles and exclude dates outside chosen range',()=>{
  const booking=(date,startTime,endTime)=>({employeeId:'a',date,startTime,endTime});
  const hours=scheduledDistributionHours([
    booking('2026-09-30','06:00','18:00'),booking('2026-10-01','18:00','06:00'),
    booking('2026-10-01','18:00','06:00'),booking('2026-10-02','05:00','12:00'),
    booking('2026-11-01','06:00','18:00')
  ],'2026-10-01','2026-10-31');
  assert.equal(hours.get('a'),18);
  assert.throws(()=>scheduledDistributionHours([booking('2026-10-01','bad','12:00')],'2026-10-01','2026-10-31'),/invalid time/);
});
test('hours rebalance after every assignment without changing inputs or already booked members',()=>{
  const employees=[employee('a',{rank:'Captain'}),employee('b')];
  const slots=[shift('second',{date:'2026-10-02'}),shift('first')];
  const before=JSON.stringify({employees,slots});
  const result=autoDistribute(slots,employees,legacyWeights,{first:['a','b'],second:['a','b']});
  assert.deepEqual(result.map(x=>[x.slotId,x.employeeId]),[['first','a'],['second','b']]);
  assert.equal(JSON.stringify({employees,slots}),before);
});
test('fill the officer and driver roles before using multi-qualified members as attendants',()=>{
  const slots=[shift('ff'),shift('driver',{role:'Engine Driver'}),shift('officer',{role:'Officer/AO'})];
  const employees=[employee('officer',{rank:'Lieutenant'}),employee('driver'),employee('ff')];
  const result=autoDistribute(slots,employees,legacyWeights,{officer:['officer'],driver:['officer','driver'],ff:['officer','driver','ff']});
  assert.deepEqual(result.map(x=>[x.slotId,x.employeeId]),[['officer','officer'],['driver','driver'],['ff','ff']]);
});

test('the screen explains the enforced order instead of offering misleading weight controls',()=>{
  const ui=fs.readFileSync('app/station-scheduler.tsx','utf8');
  const screen=ui.slice(ui.indexOf('function DistributionScreen'),ui.indexOf('function RemindersScreen'));
  assert.ok(screen.indexOf('Fill the required role.')<screen.indexOf('Fewer scheduled hours first.'));
  assert.ok(screen.indexOf('Fewer scheduled hours first.')<screen.indexOf('Rank, then seniority.'));
  assert.ok(screen.includes('Saved recurring assignments stay unchanged.'));
  assert.ok(!screen.includes('Save weights'));
});
