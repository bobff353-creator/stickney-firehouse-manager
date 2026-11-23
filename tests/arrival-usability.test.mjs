import test from 'node:test';
import assert from 'node:assert/strict';
import {blankPlan} from '../app/arrival/lib/preplan.ts';
import {recordEditingDraft,draftProgressLabel,preplanReturn} from '../app/arrival/lib/usability.ts';
test('editing a missing detail uses the current working or device copy without changing published data or IDs',()=>{
 const record={id:'fixture',revision:7,working:{...blankPlan(),name:'Working name',contactName:'Current contact'},published:{...blankPlan(),name:'Approved name'}};
 const before=structuredClone(record),local={id:'fixture',revision:6,kind:'quick',data:{...record.working,name:'Unsaved device name',step:5}};
 const result=recordEditingDraft(record,local,'Electrical shutoff');
 assert.equal(result.id,'fixture');assert.equal(result.revision,6);assert.equal(result.kind,'full');assert.equal(result.data.step,3);assert.equal(result.data.name,'Unsaved device name');
 result.data.systems.gas.location='Local edit';assert.deepEqual(record,before);assert.notEqual(local.data.systems.gas.location,'Local edit');
 assert.equal(recordEditingDraft(record,{...local,id:'foreign'},'A-side photo').data.name,'Working name');
 assert.equal(recordEditingDraft(record,undefined,'D-side photo').data.step,4);
});
test('draft resume labels distinguish full six-step work from quick three-step drafts and special editors',()=>{
 const draft={id:'fixture',revision:2,data:{...blankPlan(),step:4}};
 assert.equal(draftProgressLabel({...draft,kind:'full'}),'Full preplan · step 5 of 6');
 assert.equal(draftProgressLabel({...draft,kind:'quick'}),'Quick preplan · step 2 of 3');
 assert.equal(draftProgressLabel({...draft,kind:'photos'}),'Photos & plans');
 assert.equal(draftProgressLabel({...draft,kind:'details'}),'Building measurements & details');
});
test('record Back preserves the review queue or map task instead of dropping the user into another list',()=>{
 assert.deepEqual(preplanReturn('review'),{page:'review',label:'Back to review queue'});
 assert.deepEqual(preplanReturn('overview'),{page:'overview',label:'Back to overview'});
 assert.deepEqual(preplanReturn('preplans'),{page:'preplans',label:'Back to preplans'});
});
