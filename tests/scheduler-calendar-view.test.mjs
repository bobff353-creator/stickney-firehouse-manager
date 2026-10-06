import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../app/scheduler-calendar-view.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { calendarDayShifts, calendarTimeOverlaps, calendarShiftText } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const morning = {startTime:'06:00', endTime:'12:00'}, afternoon = {startTime:'12:00', endTime:'18:00'}, night = {startTime:'18:00', endTime:'06:00'};
const shifts = [morning, afternoon, night, night].map((range, i) => ({id:`shift-${i}`, ...range}));
const entries = shifts.map(shift => ({id:shift.id, shiftTypeId:shift.id}));
const slots = shifts.map((shift, i) => ({id:`slot-${i}`, entryId:shift.id, employeeId:i === 3 ? 'other' : 'me', ...shift}));

test('All times shows morning, afternoon and overnight own assignments together', () => {
  const before = JSON.stringify({entries, shifts, slots});
  const shown = calendarDayShifts(entries, shifts, slots, 'me', false, null);
  assert.deepEqual(shown.map(row => row.entry.id), ['shift-0','shift-1','shift-2']);
  assert.equal(JSON.stringify({entries, shifts, slots}), before);
});
test('time selection preserves multiple shifts in the same window', () => {
  assert.deepEqual(calendarDayShifts(entries, shifts, slots, 'me', true, night).map(row => row.entry.id), ['shift-2','shift-3']);
  assert.deepEqual(calendarDayShifts(entries, shifts, slots, 'me', false, night).map(row => row.entry.id), ['shift-2']);
  assert.deepEqual(calendarDayShifts(entries, shifts, slots, null, false, null), []);
});
test('filter uses actual assignment overrides instead of the template time', () => {
  const override = [{...slots[0], startTime:'12:00', endTime:'18:00'}];
  assert.deepEqual(calendarDayShifts(entries, shifts, override, 'me', false, morning), []);
  assert.equal(calendarDayShifts(entries, shifts, override, 'me', false, afternoon)[0].entry.id, 'shift-0');
});
test('partial work, exact boundaries, 24-hour and midnight work overlap correctly', () => {
  assert.equal(calendarTimeOverlaps({startTime:'08:00',endTime:'13:00'}, morning), true);
  assert.equal(calendarTimeOverlaps({startTime:'08:00',endTime:'13:00'}, afternoon), true);
  assert.equal(calendarTimeOverlaps(afternoon, morning), false);
  assert.equal(calendarTimeOverlaps(night, morning), false);
  assert.equal(calendarTimeOverlaps({startTime:'0000',endTime:'0600'}, night), true);
  for (const window of [morning, afternoon, night]) assert.equal(calendarTimeOverlaps({startTime:'06:00',endTime:'06:00'}, window), true);
  assert.equal(calendarTimeOverlaps({startTime:'99:00',endTime:'12:00'}, morning), false);
});
test('empty built shifts appear in department view but never as personal assignments', () => {
  assert.equal(calendarDayShifts(entries, shifts, [], 'me', true, morning).length, 1);
  assert.deepEqual(calendarDayShifts(entries, shifts, [], 'me', false, null), []);
});
test('calendar badge foreground meets normal text contrast on every saved shift color', () => {
  const luminance = hex => hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  for(const color of ['#ef3340','#2d3744','#f0a51a','#3182bd','#22a55b','#805ad5','#ed8936','#888888','#ffffff']) {
    const a=luminance(color),b=luminance(calendarShiftText(color));
    assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5, color);
  }
});
