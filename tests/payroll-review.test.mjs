import test from 'node:test';
import assert from 'node:assert/strict';
import { payrollReviewIssues } from '../app/payroll-review.ts';
const row=(timeIn,timeOut)=>({employeeId:'test',logDate:'2026-09-03',shiftKey:'afternoon',timeIn,timeOut});
test('overlapping duplicate tours are flagged without altering hours',()=>{
 const entries=[{workDate:'2026-09-03',category:'shift',hours:12}];
 assert.match(payrollReviewIssues(entries,[row('12:00','18:00'),row('12:00','18:00')]).join(' '),/overlapping/);
 assert.equal(entries[0].hours,12);
});
test('adjacent tours do not overlap',()=>assert.deepEqual(payrollReviewIssues([], [row('06:00','12:00'),row('12:00','18:00')]),[]));
test('noon-to-noon and excessive duty raise review flags',()=>{
 const result=payrollReviewIssues([{workDate:'2026-09-03',category:'shift',hours:30}],[row('12:00','12:00')]).join(' ');
 assert.match(result,/24/); assert.match(result,/identical/);
});
test('callback overlays are not mistaken for excessive duty',()=>assert.deepEqual(payrollReviewIssues([{workDate:'2026-09-03',category:'shift',hours:24},{workDate:'2026-09-03',category:'callback',hours:4}],[]),[]));
test('overnight tours and AO warnings',()=>{
 assert.deepEqual(payrollReviewIssues([],[{...row('18:00','06:00'),shiftKey:'overnight'}]),[]);
 assert.match(payrollReviewIssues([{workDate:'2026-09-03',category:'actingOfficer',hours:6}],[]).join(' '),/acting-officer/);
});
