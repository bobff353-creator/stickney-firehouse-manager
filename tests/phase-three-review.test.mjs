import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleSafetyIssues, emptyScheduleSafetyRules, validateScheduleSafetyRules, scheduleWindow } from '../app/schedule-safety.ts';
import { payrollReviewIssues } from '../app/payroll-review.ts';
import { timekeepingReview, timekeepingReviewCsv, validatePayrollReference } from '../app/payroll-timekeeping-review.ts';
import { buildPayrollReference } from '../app/payroll-reference-export.ts';
import { withApprovedAdjustments } from '../app/payroll-submission-export.ts';
const members = [{ id: 'fictional-a', name: 'Local Fixture A', roles: '["FF/Attendant"]' }];
const slot = (id, date, from, through, other = {}) => ({ id, employeeId: members[0].id, entryDate: date, startTime: from, endTime: through, role: 'FF/Attendant', status: 'filled', ...other });
const row = (date, from, through, other = {}) => ({ employeeId: members[0].id, logDate: date, timeIn: from, timeOut: through, shiftKey: 'morning', ...other });
const rules = { minimumRestHours: 8, maximumContinuousHours: 24 };
test('review limits are unset by default and never invented or clamped', () => {
  assert.deepEqual(emptyScheduleSafetyRules(), { minimumRestHours: null, maximumContinuousHours: null });
  for (const n of [0, -1, Infinity, NaN, 72.25, '8', undefined, 0.1]) assert.throws(() => validateScheduleSafetyRules({ ...rules, minimumRestHours: n }));
  assert.deepEqual(validateScheduleSafetyRules({ minimumRestHours: 8.25, maximumContinuousHours: 48 }), { minimumRestHours: 8.25, maximumContinuousHours: 48 });
});
test('valid local clock ranges include overnight and exact 24-hour tours; malformed dates cannot pass', () => {
  assert.equal(scheduleWindow('2026-11-01','0600','0600').end - scheduleWindow('2026-11-01','0600','0600').start, 1440);
  assert.equal(scheduleWindow('2026-03-08','18:00','06:00').end - scheduleWindow('2026-03-08','18:00','06:00').start, 720);
  for (const [date, start, end] of [['2026-02-30','0600','1800'],['bad','0600','1800'],['2026-10-05','2460','1800']]) assert.equal(scheduleWindow(date,start,end), null);
});
test('overnight overlaps and qualifications flag canonical saved IDs without mutating records', () => {
  const slots = [slot('a','2026-10-05','18:00','06:00'),slot('b','2026-10-06','05:00','12:00',{role:'Engine Driver'})];
  const before = structuredClone(slots);
  const result = scheduleSafetyIssues(slots,members,emptyScheduleSafetyRules());
  assert.equal(result.filter(r => r.kind === 'overlap').length,1);
  assert.deepEqual(result.find(r => r.kind === 'overlap').slotIds,['a','b']);
  assert.equal(result.filter(r => r.kind === 'qualification').length,1);
  assert.deepEqual(slots,before);
});
test('adjacent tours combine for fatigue; overlapping roles never double count continuous hours', () => {
  const slots = [slot('a','2026-10-05','06:00','06:00'),slot('b','2026-10-06','06:00','12:00'),slot('c','2026-10-06','06:00','12:00')];
  const result = scheduleSafetyIssues(slots,members,rules);
  assert.equal(result.filter(r=>r.kind==='continuous').length,1);
  assert.match(result.find(r=>r.kind==='continuous').message,/30.00/);
  assert.equal(result.filter(r=>r.kind==='rest').length,0);
});
test('rest exactly at the limit is accepted; gaps compare against the latest overlapping end', () => {
  const slots = [slot('a','2026-10-05','06:00','18:00'),slot('b','2026-10-05','12:00','14:00'),slot('c','2026-10-06','02:00','06:00')];
  assert.equal(scheduleSafetyIssues(slots,members,rules).filter(r=>r.kind==='rest').length,0);
  slots[2].startTime='01:00';
  const rest = scheduleSafetyIssues(slots,members,rules).find(r=>r.kind==='rest');
  assert.deepEqual(rest.slotIds,['a','c']); assert.match(rest.message,/7.00/);
});
test('duplicates, open positions and out-of-range isolated flags are excluded', () => {
  const s = slot('a','2026-10-05','06:00','12:00');
  assert.deepEqual(scheduleSafetyIssues([s,s,slot('b','2026-10-05','06:00','12:00',{status:'open',employeeId:null})],members,rules),[]);
  assert.deepEqual(scheduleSafetyIssues([slot('bad','2026-10-04','xx','xx')],members,rules,'2026-10-05'),[]);
});
test('period boundary overnight attendance duplicates are flagged only inside the selected period', () => {
  const staffing = [row('2026-10-10','18:00','07:00',{shiftKey:'overnight'}),row('2026-10-11','06:00','12:00')];
  const issues = payrollReviewIssues([],staffing,{from:'2026-10-11',through:'2026-10-25'});
  assert.equal(issues.length,1); assert.match(issues[0],/^2026-10-11:.*across log dates/);
  assert.deepEqual(payrollReviewIssues([], [staffing[0],row('2026-10-11','07:00','12:00')],{from:'2026-10-11',through:'2026-10-25'}),[]);
});
test('overnight after-midnight rows anchor to the next calendar day; different members do not collide', () => {
  assert.match(payrollReviewIssues([], [row('2026-10-05','02:00','07:00',{shiftKey:'overnight'}),row('2026-10-06','06:00','12:00')]).join(' '),/across log dates/);
  assert.deepEqual(payrollReviewIssues([], [row('2026-10-05','06:00','12:00'),row('2026-10-05','06:00','12:00',{employeeId:'other'})]),[]);
});
test('attendance differences are review suggestions; pay overlays do not inflate duty hours', () => {
  const entries = [{employeeId:members[0].id,workDate:'2026-10-05',category:'shift',hours:6},{employeeId:members[0].id,workDate:'2026-10-05',category:'actingOfficer',hours:6},{employeeId:members[0].id,workDate:'2026-10-05',category:'callback',hours:4}];
  const attendance=[row('2026-10-05','06:00','12:00')];
  assert.deepEqual(timekeepingReview(members,entries,attendance,'2026-10-01','2026-10-10'),[]);
  entries[0].hours=5;
  assert.match(timekeepingReview(members,entries,attendance,'2026-10-01','2026-10-10')[0].message,/6.00.*5.00/);
  assert.equal(entries[0].hours,5);
});
test('review downloads retain all flags and neutralize spreadsheet formulas', () => {
  const csv = timekeepingReviewCsv(Array.from({length:101},(_,i)=>({employeeId:'a',employeeName:' =WEBSERVICE("bad")',date:'2026-10-05',message:`flag ${i}`})),'2026-10-01','2026-10-10');
  assert.match(csv,/' =WEBSERVICE/); assert.match(csv,/flag 100/); assert.match(csv,/no hours or approvals/);
});
const employee = { id:'fictional-a',name:'Fixture',rank:'Firefighter',regularRate:20,overtimeRate:30,holidayRate:30 };
const report = () => buildPayrollReference({startDate:'2026-10-01',endDate:'2026-10-10',status:'draft'},[{employee,entries:[{category:'shift',hours:6}]}],{overtimeThreshold:106,actingOfficerPremium:5,dpwMultiplier:1.5});
test('payroll export validation accepts valid actuals and negative approved carryovers', () => {
  assert.equal(validatePayrollReference(report()).gross,120);
  assert.equal(validatePayrollReference(withApprovedAdjustments(report(),[{id:'adjustment',employeeName:'Fixture',sourcePeriod:'2026-09-11',changes:[],deltaCents:-2500}])).gross,95);
});
test('nonfinite payroll and inconsistent totals cannot create an export', () => {
  for (const mutate of [r=>r.gross=NaN,r=>r.rows[0].cells[2]=Infinity,r=>r.rows[0].cells[r.headers.length-1]=121,r=>r.totals[r.totals.length-1]=121]) {
    const r=report(); mutate(r);
    assert.throws(()=>validatePayrollReference(r));
  }
});
