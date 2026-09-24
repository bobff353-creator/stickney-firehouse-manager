import assert from 'node:assert/strict';
import test from 'node:test';
import { payrollExportRows } from '../app/payroll-export.ts';
const employee={name:'Fictional Member',rank:'Firefighter',regularRate:23,overtimeRate:34.5,holidayRate:34.5};

test('export separates regular, overtime, and AO, without duplicating source hours',()=>{
 const rows=payrollExportRows(employee,[{category:'shift',hours:123},{category:'actingOfficer',hours:42}],106,1.5);
 assert.deepEqual(rows.map(row=>row.slice(9)),[[106,'23.00','2438.00'],[17,'34.50','586.50'],[42,'1.00','42.00']]);
 assert.equal(rows.reduce((sum,row)=>sum+Number(row[2]),0),123);
});
test('work detail and AO each show their own actual rate and pay',()=>{
 const rows=payrollExportRows(employee,[{category:'shift',hours:36},{category:'workDetail',hours:7},{category:'actingOfficer',hours:6}],106,1.5);
 assert.deepEqual(rows.map(row=>row.slice(9)),[[36,'23.00','828.00'],[7,'23.00','161.00'],[6,'1.00','6.00']]);
});
test('DPW and holiday rows reconcile hours times rate; DPW never gets another premium',()=>{
 const rows=payrollExportRows({...employee,isDpw:true},[{category:'shift',hours:120},{category:'holiday',hours:8},{category:'actingOfficer',hours:4}],106,1.5);
 assert.deepEqual(rows.map(row=>row.slice(9)),[[128,'34.50','4416.00'],[4,'1.00','4.00']]);
 assert.equal(rows[0][8],128);
});
