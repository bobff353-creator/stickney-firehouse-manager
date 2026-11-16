import test from 'node:test';
import assert from 'node:assert/strict';
import {trainingModules} from './helpers/training-modules.mjs';
const load=trainingModules(),model=load('app/fire-inspections/model.ts'),{followUpReview}=load('app/fire-inspections/follow-up-review.ts');
const parent=()=>({id:'qa-original-visit',kind:'inspection',version:3,archived:false,data:{...model.emptyInspection(),status:'Completed',repeatMonths:6,nextDueDate:'2027-03-23',reinspectionDecision:'Schedule',followUpDate:'2026-12-23',reinspectionTime:'09:00'}});
const children=p=>['routine','reinspection'].map(type=>model.followUpRecord(p,type,type==='routine'?p.data.nextDueDate:p.data.followUpDate));

test('matching follow-ups and separately booked routine appointments need no date reconciliation',()=>{
 const p=parent(),records=children(p);records[0].data.scheduledDate='2027-03-25';records[0].data.scheduledTime='14:00';records[0].data.status='Scheduled';
 const before=JSON.stringify([p,records]);assert.deepEqual(followUpReview(p,records),[]);assert.equal(JSON.stringify([p,records]),before);
 assert.deepEqual(followUpReview({...p,data:{...p.data,status:'Draft'}},records),[]);assert.deepEqual(followUpReview(p,[]),[]);
});

test('reissued date and appointment-time differences retain canonical follow-ups for explicit review',()=>{
 const p=parent(),records=children(p);p.data.nextDueDate='2027-04-23';p.data.reinspectionTime='10:30';const before=JSON.stringify([p,records]),review=followUpReview(p,records);
 assert.equal(review.length,2);assert.deepEqual(review[0],{type:'routine',id:records[0].id,existingDate:'2027-03-23',requestedDate:'2027-04-23',existingTime:'',requestedTime:'',status:'Needs scheduling',archived:false,requested:true});
 assert.equal(review[1].existingTime,'09:00');assert.equal(review[1].requestedTime,'10:30');assert.equal(JSON.stringify([p,records]),before);
});

test('turning off requested follow-ups does not silently cancel, archive or delete the saved visit',()=>{
 const p=parent(),records=children(p);p.data.repeatMonths=0;p.data.reinspectionDecision='Not needed';const before=JSON.stringify(records),review=followUpReview(p,records);
 assert.equal(review.length,2);assert(review.every(item=>!item.requested&&item.requestedDate===''));assert.equal(JSON.stringify(records),before);
 records[0].archived=true;records[1].data.status='Canceled';p.data.repeatMonths=6;p.data.reinspectionDecision='Schedule';assert.equal(followUpReview(p,records).length,2);
});

test('review uses only the direct generated child and does not mislabel unrelated visits',()=>{
 const p=parent(),records=children(p);p.data.nextDueDate='2027-04-23';records[0].data.parentId='unrelated-parent';assert.deepEqual(followUpReview(p,records),[]);
 records[0].data.parentId=p.id;records[0].id='a-separate-visit';assert.deepEqual(followUpReview(p,records),[]);
});
