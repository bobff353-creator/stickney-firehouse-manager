import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizePayroll } from '../app/payroll-calculation.ts';
import { payrollExportRows } from '../app/payroll-export.ts';
import { buildPayrollDetails } from '../app/command-center-analytics.ts';

const employee = {name:'Fictional Member', rank:'Firefighter', regularRate:23, overtimeRate:34.5, holidayRate:34.5};
const rules = {overtimeThreshold:106, actingOfficerPremium:1, dpwMultiplier:1.5};
const entries = (values) => Object.entries(values).map(([category,hours])=>({category,hours}));
const pay = (values, member=employee, settings=rules) => summarizePayroll(member, entries(values), settings);

test('43 hours at 23 dollars is 989; six AO hours add exactly 6 dollars',()=>{
  assert.equal(pay({shift:43}).gross,989);
  const result=pay({shift:36,workDetail:7,actingOfficer:6});
  assert.equal(result.hours,43);
  assert.equal(result.gross,995);
  assert.deepEqual(result.lines.filter(line=>line.hours).map(line=>[line.key,line.amount]),[['regular',828],['workDetail',161],['actingOfficer',6]]);
});
test('Work Detail uses normal rate for every rank',()=>{
  for(const rank of ['Chief','Deputy Chief','Captain','Lieutenant','Firefighter','Temp Firefighter']) assert.equal(pay({workDetail:7},{...employee,rank}).gross,161);
});
test('39 hours at 20 dollars is 780, including three straight-time detail hours',()=>{
  const result=pay({shift:36,workDetail:3},{...employee,rank:'Temp Firefighter',regularRate:20});
  assert.equal(result.hours,39);
  assert.equal(result.gross,780);
  assert.equal(result.actingHours,0);
});
test('only overtime hours get 1.5 times; threshold hours are not paid twice',()=>{
  assert.equal(pay({shift:106}).gross,2438);
  const result=pay({shift:110});
  assert.equal(result.regularHours,106);
  assert.equal(result.overtimeHours,4);
  assert.equal(result.gross,2576);
});
test('holiday and DPW use base times 1.5, AO uses actual AO rate once',()=>{
  assert.equal(pay({holiday:8}).gross,276);
  assert.equal(pay({dpw:8}).gross,276);
  assert.equal(pay({actingOfficer:6},employee,{...rules,actingOfficerPremium:2.5}).gross,15);
  assert.equal(pay({actingOfficer:6},employee,{...rules,actingOfficerPremium:0}).gross,0);
});
test('DPW employee never receives stacked overtime or holiday premiums',()=>{
  const result=pay({shift:120,holiday:8,workDetail:7,dpw:3,actingOfficer:6},{...employee,isDpw:1});
  assert.equal(result.hours,138);
  assert.equal(result.dpwHours,138);
  assert.equal(result.overtimeHours,0);
  assert.equal(result.holidayHours,0);
  assert.equal(result.gross,4767); // 138 * 23 * 1.5 + 6
});
test('manual and Daily Log DPW combine once without triggering overtime',()=>{
  const result=pay({dailyLogDpw:100,dpw:20,shift:10});
  assert.equal(result.dpwHours,120);
  assert.equal(result.overtimeHours,0);
  assert.equal(result.gross,4370);
});
test('premiums derive from the base rate, avoiding stale rates and double multipliers',()=>{
  const wrongPremiums={...employee,overtimeRate:100,holidayRate:200};
  assert.equal(pay({shift:110,holiday:8,dpw:8},wrongPremiums,{...rules,dpwMultiplier:2.25}).gross,3128);
  assert.equal(pay({holiday:3},{...employee,regularRate:23.01}).gross,103.55);
});
test('decimal hours retain hundredths, and zero threshold is not replaced by 106',()=>{
  const result=summarizePayroll(employee,[{category:'shift',hours:.1},{category:'shift',hours:.2}],rules);
  assert.equal(result.hours,.3);
  assert.equal(result.gross,6.9);
  assert.equal(pay({shift:2},employee,{...rules,overtimeThreshold:0}).gross,69);
});
test('display, every export row, and analytics reconcile across rates and mixed categories',()=>{
  for(const regularRate of [20,23,23.01,27.56,28.94,29.72,36.4]) for(const isDpw of [false,true]) for(const shift of [0,43,106,106.25,123.1]) {
    const member={...employee,regularRate,isDpw};
    const input=entries({shift,drill:1.25,callback:2,workDetail:7.1,holiday:3.25,dpw:4.5,actingOfficer:6.1});
    const result=summarizePayroll(member,input,rules);
    const rows=payrollExportRows(member,input,106,1.5,1);
    for(const row of rows) assert.equal(Math.round((Number(row[9])*Number(row[10])+1e-8)*100),Math.round(Number(row[11])*100));
    assert.equal(rows.reduce((sum,row)=>sum+Math.round(Number(row[11])*100),0),Math.round(result.gross*100));
    const analytics=buildPayrollDetails(input.map((entry,index)=>({...entry,employeeId:'fixture',periodStart:'2026-09-11',date:`2026-09-${11+index}`,payScaleId:'fixture',...member})),[],rules);
    assert.equal(analytics.reduce((sum,row)=>sum+Math.round(row.cost*100),0),Math.round(result.gross*100));
    assert.equal(Number(analytics.reduce((sum,row)=>sum+row.overtimeHours,0).toFixed(2)),result.overtimeHours);
  }
});
test('analytics use the same period-effective rate as payroll and carry cents consistently',()=>{
  const input=[.01,.01,.01].map((hours,i)=>({...employee,employeeId:'fixture',payScaleId:'fixture',periodStart:'2026-09-11',date:`2026-09-${11+i}`,category:'shift',hours}));
  const history=[{payScaleId:'fixture',effectiveDate:'2026-09-11',regularRate:23.01,overtimeRate:34.52,holidayRate:34.52},{payScaleId:'fixture',effectiveDate:'2026-09-26',regularRate:99,overtimeRate:148.5,holidayRate:148.5}];
  const rows=buildPayrollDetails(input,history,rules);
  assert.equal(rows.reduce((sum,row)=>sum+Math.round(row.cost*100),0),69);
});
