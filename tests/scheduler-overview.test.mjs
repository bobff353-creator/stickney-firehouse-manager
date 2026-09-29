import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../app/scheduler-overview.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { staffingWeek, filterOpenPositions, scheduleDateOffset } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const slot = { id: 'one', entryDate: '2026-10-01', shiftTypeId: 'day', role: 'Engine Driver', status: 'open', employeeId: null, startTime: '06:00', isExtra: 0 };

test('extra staffing cannot hide a required vacancy; empty days are not fully staffed', () => {
  const slots = [slot, { ...slot, id: 'two', status: 'filled', employeeId: 'member' }, { ...slot, id: 'extra', status: 'filled', employeeId: 'other', isExtra: 1 }, { ...slot, id: 'open-extra', isExtra: 1 }];
  const original = JSON.stringify(slots);
  const days = staffingWeek([{ id: 'shift', entryDate: slot.entryDate }], slots, slot.entryDate);
  assert.deepEqual(days[0], { date: '2026-10-01', shifts: 1, required: 2, filled: 1, extraFilled: 1, extraOpen: 1, open: 1 });
  assert.equal(days[1].shifts, 0);
  assert.equal(days[1].required, 0);
  assert.equal(days.length, 7);
  assert.equal(JSON.stringify(slots), original);
});
test('missing member IDs are not counted as staffed; duplicate records do not inflate counts', () => {
  const bad = { ...slot, status: 'filled', employeeId: null };
  const days = staffingWeek([{ id: 'x', entryDate: slot.entryDate }, { id: 'x', entryDate: slot.entryDate }], [bad, bad], slot.entryDate);
  assert.equal(days[0].shifts, 1);
  assert.equal(days[0].required, 1);
  assert.equal(days[0].filled, 0);
  assert.equal(days[0].open, 1);
});
test('open position filters combine inclusive dates, roles and shift IDs without counting old or staffed records', () => {
  const rows = [slot, { ...slot, id: 'past', entryDate: '2026-09-30' }, { ...slot, id: 'later', entryDate: '2026-10-07' }, { ...slot, id: 'outside', entryDate: '2026-10-08' }, { ...slot, id: 'other-role', role: 'Officer/AO' }, { ...slot, id: 'other-shift', shiftTypeId: 'night' }, { ...slot, id: 'filled', status: 'filled', employeeId: 'x' }, { ...slot, id: 'inconsistent', employeeId: 'x' }];
  const filters = { from: '2026-10-01', through: '2026-10-07', role: 'Engine Driver', shiftTypeId: 'day' };
  assert.deepEqual(filterOpenPositions(rows, '2026-10-01', filters).map(row => row.id), ['one', 'later']);
  assert.equal(filterOpenPositions(rows, '2026-10-01', { ...filters, through: '2026-09-30' }).length, 0);
});
test('week navigation crosses month, year, leap-day and daylight-saving dates without dropping days', () => {
  assert.equal(scheduleDateOffset('2026-09-29', 6), '2026-10-05');
  assert.equal(scheduleDateOffset('2026-12-29', 7), '2027-01-05');
  assert.equal(scheduleDateOffset('2028-02-28', 1), '2028-02-29');
  assert.equal(scheduleDateOffset('2026-11-01', -1), '2026-10-31');
});
