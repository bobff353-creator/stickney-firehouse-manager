import assert from 'node:assert/strict';
import test from 'node:test';
import { equipmentDueForCheck, weeklyRecurrenceInput, weeklyRecurrenceLabel } from '../app/inventory-check-recurrence.ts';

const run = {check_types:['weekly'],weekly_recurrence:'first_third_saturday'};
const date = day => new Date(`${day}T18:00:00Z`);

test('weekly trailer run appears only on the first and third Saturdays, including five-Saturday months',()=>{
  for(const day of ['2026-08-01','2026-08-15','2026-10-03','2026-10-17','2026-11-07','2026-11-21']) assert.equal(equipmentDueForCheck(run,'weekly',date(day)),true,day);
  for(const day of ['2026-08-08','2026-08-22','2026-08-29','2026-10-10','2026-10-24','2026-10-31','2026-11-01','2026-11-14','2026-11-28']) assert.equal(equipmentDueForCheck(run,'weekly',date(day)),false,day);
});
test('recurrence uses Chicago dates across UTC midnight and daylight-saving offsets',()=>{
  assert.equal(equipmentDueForCheck(run,'weekly',new Date('2026-10-05T04:59:00Z')),true);
  assert.equal(equipmentDueForCheck(run,'weekly',new Date('2026-10-05T05:00:00Z')),false);
  assert.equal(equipmentDueForCheck(run,'weekly',new Date('2026-11-09T05:59:00Z')),true);
  assert.equal(equipmentDueForCheck(run,'weekly',new Date('2026-11-09T06:00:00Z')),false);
});
test('starting a weekly check early or a day late cannot omit the run due in that cycle',()=>{
 for(const day of ['2026-11-02','2026-11-06','2026-11-08','2026-11-16','2026-11-20','2026-11-22','2026-12-28']) assert.equal(equipmentDueForCheck(run,'weekly',date(day)),true,day);
 for(const day of ['2026-11-09','2026-11-15','2026-11-23','2026-12-27']) assert.equal(equipmentDueForCheck(run,'weekly',date(day)),false,day);
});
test('existing weekly items and other check types retain their ordinary behavior',()=>{
  const at=date('2026-11-14');
  assert.equal(equipmentDueForCheck({check_types:['weekly']},'weekly',at),true);
  assert.equal(equipmentDueForCheck({check_types:['weekly'],weekly_recurrence:'every_week'},'weekly',at),true);
  assert.equal(equipmentDueForCheck({...run,check_types:['daily','weekly']},'daily',at),true);
  assert.equal(equipmentDueForCheck(run,'daily',at),false);
  assert.equal(equipmentDueForCheck({},'weekly',at),false);
});
test('frequency input rejects unsupported values without silently making a run mandatory every week',()=>{
  for(const value of ['every_week','first_third_saturday']) assert.equal(weeklyRecurrenceInput(value),value);
  for(const value of [undefined,null,'monthly','',{},1]) assert.throws(()=>weeklyRecurrenceInput(value),/Choose every week/);
  assert.match(weeklyRecurrenceLabel('first_third_saturday'),/first and third Saturdays/);
  assert.equal(weeklyRecurrenceLabel('every_week'),'');
});
