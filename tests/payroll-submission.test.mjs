import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSubmission, reconcileSubmission, recordedEntries, employeeGrossCents, payDates, payPeriodEnd } from '../app/payroll-submission.ts';
import { adjustmentExportRows, submittedExportRows, payrollCsv } from '../app/payroll-submission-export.ts';

const employee = { id:'fixture-a', name:'Fictional Member A', rank:'Firefighter', regularRate:20, overtimeRate:30, holidayRate:30, isDpw:0, payScaleId:'ff' };
const other = {...employee,id:'fixture-b',name:'Fictional Member B'};
const entry = (id,employeeId,workDate,category,hours)=>({id,employeeId,workDate,category,hours});
const assignment = (id, employeeId, workDate, startTime='06:00',endTime='12:00')=>({id,employeeId,workDate,startTime,endTime,role:'Officer/AO',status:'assigned'});
export function fictionalSources() {
  const period='2026-09-11';
  return {version:1,period,status:'draft',employees:[employee,other],settings:{overtimeThreshold:106,dpwMultiplier:1.5,actingOfficerPremium:1},entries:[entry('recorded','fixture-a','2026-09-23','shift',6),entry('cb','fixture-a','2026-09-24','callback',2)],schedule:[assignment('slot24','fixture-a','2026-09-24'),assignment('slot25','fixture-a','2026-09-25')],logs:payDates(period).map(logDate=>({logDate,updatedBy:'Test reviewer'})),staffing:[],approvals:payDates(period).flatMap(logDate=>['morning','afternoon','overnight'].map(shiftKey=>({logDate,shiftKey,signOutAt:'2026-09-27T00:00:00Z'})))};
}
const saved = document=>({id:'snapshot',period:document.period,document,createdBy:'test@example.test',createdAt:'2026-09-24T17:00:00Z'});
test('cutoffs use recorded hours and schedule once, never invent AO or extra-work hours',()=>{
  const source=fictionalSources();
  source.entries.push(entry('existing24','fixture-a','2026-09-24','shift',6));
  const {document,blockers}=buildSubmission(source,'2026-09-23','2026-09-23');
  assert.deepEqual(blockers,[]);
  assert.equal(document.entries.reduce((s,e)=>s+e.hours,0),18);
  assert.equal(document.entries.filter(e=>e.basis==='schedule-estimate').length,2);
  assert.ok(document.entries.every(e=>e.category==='shift'));
  assert.equal(document.grossCents,36000);
  assert.equal(source.entries.length,3,'source records untouched');
});
test('duplicate saved entries and overlapping schedule slots block, not double pay or silently merge',()=>{
  const source=fictionalSources();
  source.schedule.push({...source.schedule[0],id:'overlap'});
  assert.ok(buildSubmission(source,'2026-09-23','2026-09-23').blockers.some(b=>b.includes('Overlapping')));
  assert.throws(()=>recordedEntries([source.entries[0],{...source.entries[0],id:'duplicate'}]),/duplicate/);
});
test('missing logs, schedule, employee mappings and rates cannot become guessed values',()=>{
  const source=fictionalSources();source.logs=[];source.schedule=[];source.employees[0]={...employee,regularRate:NaN};
  source.entries.push(entry('unknown','missing','2026-09-23','shift',6));
  const result=buildSubmission(source,'2026-09-23','2026-09-23');
  for(const text of ['no saved Daily Log','no assigned schedule','invalid configured pay rates','unmatched employee']) assert.ok(result.blockers.some(b=>b.includes(text)),text);
});
test('late trade yields paired +/- and a late callback with original dates; retry has no remaining difference',()=>{
  const source=fictionalSources(), submission=saved(buildSubmission(source,'2026-09-23','2026-09-23').document);
  source.entries.push(entry('actual24','fixture-b','2026-09-24','shift',6),entry('actual25','fixture-a','2026-09-25','shift',6));
  const result=reconcileSubmission(submission,source,[],'2026-09-26');
  assert.deepEqual(result.blockers,[]);
  assert.equal(result.candidates.find(c=>c.employeeId==='fixture-a').deltaCents,-8000);
  assert.equal(result.candidates.find(c=>c.employeeId==='fixture-b').deltaCents,12000);
  assert.ok(result.candidates.every(c=>c.changes.every(x=>x.workDate.startsWith('2026-09-'))));
  const ledger=result.candidates.map((a,i)=>({...a,id:`approved-${i}`}));
  assert.equal(reconcileSubmission(submission,source,ledger,'2026-10-11').candidates.length,0);
  source.entries.push(entry('latercb','fixture-b','2026-09-25','callback',2));
  const next=reconcileSubmission(submission,source,ledger,'2026-10-11');
  assert.equal(next.candidates.length,1);assert.equal(next.candidates[0].deltaCents,4000);assert.equal(next.candidates[0].sequence,2);
});
test('missing handoff cannot authorize a negative correction',()=>{
  const source=fictionalSources(), submission=saved(buildSubmission(source,'2026-09-23','2026-09-23').document);
  source.approvals=[];
  assert.equal(reconcileSubmission(submission,source,[],'2026-09-26').blockers.length,45);
});
test('original-period overtime and frozen rates are used, not next-period hours or new rates',()=>{
  const source=fictionalSources(); source.entries=[entry('base','fixture-a','2026-09-23','shift',6)];source.settings.overtimeThreshold=10;
  const submission=saved(buildSubmission(source,'2026-09-23','2026-09-23').document);
  source.employees=source.employees.map(e=>({...e,regularRate:99,overtimeRate:150}));
  source.settings={overtimeThreshold:999,dpwMultiplier:4,actingOfficerPremium:9};
  source.entries=[entry('base','fixture-a','2026-09-23','shift',6),entry('x24','fixture-a','2026-09-24','shift',6),entry('x25','fixture-a','2026-09-25','shift',8)];
  const change=reconcileSubmission(submission,source,[],'2026-09-26').candidates[0];
  assert.equal(change.deltaCents,6000);
});
test('zero-dollar reclassification is auditable once and later reversals remain possible',()=>{
  const source=fictionalSources();source.entries=[entry('base','fixture-a','2026-09-23','shift',6)];
  const submission=saved(buildSubmission(source,'2026-09-25','2026-09-25').document);
  source.entries=[entry('base','fixture-a','2026-09-23','drill',6)];
  const adjustment=reconcileSubmission(submission,source,[],'2026-09-26').candidates[0];
  assert.equal(adjustment.deltaCents,0);
  assert.equal(reconcileSubmission(submission,source,[adjustment],'2026-10-11').candidates.length,0);
  source.entries=[entry('base','fixture-a','2026-09-23','shift',6)];
  assert.equal(reconcileSubmission(submission,source,[adjustment],'2026-10-11').candidates[0].sequence,2);
});
test('overnight period boundary preserves operational work date, holidays and DPW rules',()=>{
  const source=fictionalSources();source.period='2026-12-11';source.entries=[];source.logs=payDates(source.period).map(logDate=>({logDate,updatedBy:'reviewer'}));
  source.schedule=[assignment('eve','fixture-a','2026-12-24','18:00','06:00'),assignment('christmas','fixture-a','2026-12-25','18:00','06:00')];
  const d=buildSubmission(source,'2026-12-23','2026-12-23').document;
  assert.deepEqual(d.entries.map(e=>[e.workDate,e.category,e.hours]),[['2026-12-24','holiday',12],['2026-12-25','holiday',12]]);
  assert.equal(d.grossCents,72000);
  source.employees=[{...employee,isDpw:1},other];
  assert.equal(buildSubmission(source,'2026-12-23','2026-12-23').document.entries[0].category,'dpw');
});
test('DPW manual and log components combine intentionally while same-category duplicates reject',()=>{
  assert.equal(recordedEntries([entry('a','fixture-a','2026-09-23','dpw',2),entry('b','fixture-a','2026-09-23','dailyLogDpw',6)])[0].hours,8);
});
test('exports include original dates, distinct adjustment dollars and protect spreadsheet formulas',()=>{
  const d=buildSubmission(fictionalSources(),'2026-09-23','2026-09-23').document;
  const adjustment={id:'a',employeeName:'=BAD()',sourcePeriod:'2026-08-26',targetPeriod:d.period,deltaCents:-12000,changes:[{workDate:'2026-09-10',category:'shift',submittedHours:6,actualHours:0}]};
  d.incoming=[adjustment];d.grossCents-=12000;
  const rows=submittedExportRows(d);
  assert.ok(rows.some(r=>r.includes('2026-09-10 shift')));
  assert.ok(payrollCsv(rows).includes("'=BAD()"));
  assert.ok(payrollCsv(rows).includes('"-120.00"'), 'negative adjustments remain numeric in spreadsheet imports');
  assert.equal(adjustmentExportRows([adjustment]).at(-1).at(-1),'-120.00');
  assert.equal(employeeGrossCents(employee,d.entries,d.settings),36000);
});
test('period dates handle short February and invalid cutoffs',()=>{
  assert.equal(payPeriodEnd('2027-02-26'),'2027-03-10');
  assert.throws(()=>payPeriodEnd('2026-13-11'));
  assert.throws(()=>buildSubmission(fictionalSources(),'2026-09-26','2026-09-23'));
});
