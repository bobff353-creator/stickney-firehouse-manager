import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { buildPayrollReference, payrollReferenceCsv } from '../app/payroll-reference-export.ts';
import { createPayrollWorkbook, payrollExcelBytes } from '../app/payroll-excel.ts';
import { summarizePayroll } from '../app/payroll-calculation.ts';

const period = {startDate:'2026-09-11',endDate:'2026-09-25',status:'draft'};
const rules = {overtimeThreshold:106,dpwMultiplier:1.5,actingOfficerPremium:1};
const employee = {name:'Example, Jamie',rank:'Firefighter',regularRate:23,overtimeRate:34.5,holidayRate:34.5};
const member = (hours, overrides={}) => ({employee:{...employee,...overrides}, entries:Object.entries(hours).map(([category,hours])=>({category,hours}))});

test('reference layout combines straight-time detail and keeps AO separate',()=>{
 const report=buildPayrollReference(period,[member({shift:36,workDetail:7,actingOfficer:6})],rules);
 assert.deepEqual(report.headers,['Name','Rank','Shift','Drill','Work Detail','Call Back','Acting Officer','Holiday','Total','Rate','Pay']);
 assert.deepEqual(report.rows.map(row=>row.cells.slice(8)),[[43,23,989],[6,1,6]]);
 assert.equal(report.rows[1].cells[1],'Acting Officer');
 assert.equal(report.gross,995);
 assert.equal(report.workedHours,43);
 assert.deepEqual(report.totals.slice(8),['x','x',995]);
});

test('names sort alphabetically with premium rows directly below each employee',()=>{
 const report=buildPayrollReference(period,[member({shift:120,holiday:8,actingOfficer:4},{name:'Zulu, Alex'}),member({workDetail:3},{name:'Alpha, Alex',regularRate:20})],rules);
 assert.deepEqual(report.rows.map(row=>row.kind),['regular','regular','overtime','holiday','actingOfficer']);
 assert.equal(report.rows[0].cells[0],'Alpha, Alex');
 assert.deepEqual(report.rows[0].cells.slice(8),[3,20,60]);
});

test('DPW column appears only when used, never stacks premiums',()=>{
 const report=buildPayrollReference(period,[member({shift:120,holiday:8,actingOfficer:4},{isDpw:true})],rules);
 assert.equal(report.headers[8],'DPW');
 assert.deepEqual(report.rows.map(row=>row.kind),['dpw','actingOfficer']);
 assert.deepEqual(report.rows[0].cells.slice(8),[128,128,34.5,4416]);
 assert.equal(report.gross,4420);
});

test('reference output preserves cents across mixed rates, hours, and premiums',()=>{
 for(const regularRate of [20,23,23.01,23.5,27.56,28.94,29.72,36.4]) for(const isDpw of [false,true]) for(const shift of [0,.01,43,106.25,123.1]) {
  const input=member({shift,drill:.01,callback:2,workDetail:7.1,holiday:3.25,dpw:4.5,actingOfficer:6.1},{regularRate,isDpw});
  const report=buildPayrollReference(period,[input],rules);
  for(const {cells} of report.rows) {
   assert.equal(Math.round((Number(cells.at(-3))*Number(cells.at(-2))+1e-8)*100),Math.round(Number(cells.at(-1))*100));
  }
  assert.equal(report.rows.reduce((sum,row)=>sum+Math.round(Number(row.cells.at(-1))*100),0),Math.round(summarizePayroll(input.employee,input.entries,rules).gross*100));
 }
 const rounding=buildPayrollReference(period,[member({shift:.01,workDetail:.01},{regularRate:23.5})],rules);
 assert.equal(rounding.rows.length,2);
 assert.equal(rounding.gross,.48);
});

test('CSV has the same header, total, quoting and period without executable names',()=>{
 const report=buildPayrollReference({...period,startDate:'2026-08-26',endDate:'2026-09-10'},[member({shift:39},{name:'=Example, "Jamie"',regularRate:20})],rules);
 const csv=payrollReferenceCsv(report);
 assert.ok(csv.startsWith('\uFEFF"August 26, 2026 – September 10, 2026"'));
 assert.ok(csv.includes('"\'=Example, ""Jamie"""'));
 assert.ok(csv.includes('"39","20.00","780.00"'));
 assert.ok(csv.endsWith('"x","x","780.00"'));
});

test('Excel reopens with formulas, cached exact values, colors and print headings',async()=>{
 const report=buildPayrollReference(period,[member({shift:120,workDetail:7,holiday:8,actingOfficer:6,dpw:4})],rules);
 const bytes=await payrollExcelBytes(report);
 const book=new ExcelJS.Workbook();
 await book.xlsx.load(bytes);
 const sheet=book.getWorksheet('Payroll');
 assert.deepEqual(sheet.getRow(2).values.slice(1),report.headers);
 assert.equal(sheet.getCell('J3').value.formula,'ROUND(SUM(C3:I3),2)');
 assert.equal(sheet.getCell('L3').value.formula,'ROUND(J3*K3,2)');
 report.rows.forEach((row,index)=>{
  assert.equal(sheet.getCell(index+3,12).value.result,row.cells.at(-1));
  const expected={overtime:'FF00B0F0',actingOfficer:'FFFFFF00',holiday:'FF92D050',dpw:'FFE4D7F5'}[row.kind];
  if(expected) assert.equal(sheet.getCell(index+3,1).fill.fgColor.argb,expected);
 });
 assert.equal(sheet.getCell(sheet.rowCount,12).value.result,report.gross);
 assert.equal(sheet.views[0].ySplit,2);
 assert.equal(sheet.pageSetup.printTitlesRow,'1:2');
 assert.equal(sheet.pageSetup.orientation,'landscape');
 assert.equal(book.getWorksheet('Rates & notes').getCell('B3').value,'draft');
});

test('zero-hour employees and empty payrolls remain truthful and exportable',()=>{
 const zero=buildPayrollReference(period,[member({})],rules);
 assert.equal(zero.rows.length,1);
 assert.equal(zero.gross,0);
 const empty=buildPayrollReference(period,[],rules);
 const sheet=createPayrollWorkbook(empty).getWorksheet('Payroll');
 assert.equal(sheet.getCell(sheet.rowCount,11).value,0);
 assert.equal(empty.employeeCount,0);
});
