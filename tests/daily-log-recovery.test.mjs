import assert from 'node:assert/strict';
import test from 'node:test';
import { backupLogRecovery, logDifferences, resolveLogDifferences } from '../app/daily-log-recovery.ts';
const staff = { id: 'a', shiftKey: 'morning', employeeId: 'member-a', timeIn: '06:00', timeOut: '12:00', actingOfficer: false };
const call = { id: 'call-a', reportNumber: 'TEST-1', timeOut: '0900', timeIn: '0930', respondingUnits: 'TEST', address: 'Fictional', callType: 'EMS' };
const saved = { staffing: [staff], calls: [call], shiftNotes: 'Saved notes' };
const choicesFor = (draft, server, side) => Object.fromEntries(logDifferences(draft, server).map(item => [item.key, side]));

test('identical contents ignore metadata, row order and empty editor placeholders', () => {
  const second = { ...staff, id: 'b' };
  assert.deepEqual(logDifferences({ ...saved, staffing: [second, { ...staff, sortOrder: 4, actingOfficer: 0 }, { ...staff, id: 'empty', employeeId: '' }], calls: [call, { ...call, id: 'empty', reportNumber: '', timeOut: '', timeIn: '', respondingUnits: '', address: '' }] }, { ...saved, staffing: [staff, second] }), []);
});
test('mixed field choices retain the saved call, selected time and all untouched rows', () => {
  const draft = { ...saved, staffing: [{ ...staff, timeIn: '06:15', timeOut: '11:45' }], calls: [{ ...call, address: 'Local address' }] };
  const server = { ...saved, staffing: [{ ...staff, timeOut: '12:15' }, { ...staff, id: 'server-only', employeeId: 'member-b' }] };
  const choices = choicesFor(draft, server, 'saved');
  const time = logDifferences(draft, server).find(item => item.field === 'timeIn');
  choices[time.key] = 'draft';
  const result = resolveLogDifferences(draft, server, choices);
  assert.equal(result.staffing[0].timeIn, '06:15');
  assert.equal(result.staffing[0].timeOut, '12:15');
  assert.equal(result.staffing[1].employeeId, 'member-b');
  assert.equal(result.calls[0].address, 'Fictional');
  assert.deepEqual(saved.staffing, [staff]);
});
test('no difference can be silently accepted without an explicit choice', () => {
  const draft = { ...saved, shiftNotes: 'Unsaved note' };
  assert.throws(() => resolveLogDifferences(draft, saved, {}), /Choose/);
  assert.throws(() => resolveLogDifferences(draft, saved, { shiftNotes: 'unknown' }), /Choose/);
});
test('local-only additions and saved-only removals need choices and preserve record IDs', () => {
  const draft = { staffing: [{ ...staff, id: 'local' }], calls: [], shiftNotes: '' };
  const result = resolveLogDifferences(draft, saved, choicesFor(draft, saved, 'draft'));
  assert.deepEqual(result, draft);
  assert.deepEqual(resolveLogDifferences(draft, saved, choicesFor(draft, saved, 'saved')), saved);
});
test('notes are preserved exactly, including timestamped entries', () => {
  const draft = { ...saved, shiftNotes: 'Line one\n\n--- Log entry test ---\nRecorded: 2026-09-23T20:00:00Z\nCategory: Handoff item\nStatus: Open\nCarry forward\n--- End log entry ---\n' };
  assert.equal(resolveLogDifferences(draft, saved, choicesFor(draft, saved, 'draft')).shiftNotes, draft.shiftNotes);
});
test('backup retains both original copies and versions before recovery', () => {
  const store = new Map();
  const draft = { ...saved, shiftNotes: 'My unsaved changes' };
  backupLogRecovery({ setItem: (key, value) => store.set(key, value) }, '2026-09-21', draft, 2, saved, 4);
  const backup = JSON.parse([...store.values()][0]);
  assert.equal(backup.shiftNotes, draft.shiftNotes);
  assert.equal(backup.expectedVersion, 2);
  assert.equal(backup.comparedWith.shiftNotes, saved.shiftNotes);
  assert.equal(backup.comparedWith.saveVersion, 4);
});
test('backup failure is reported, never treated as successful recovery', () => {
  assert.throws(() => backupLogRecovery({ setItem: () => { throw new Error('Storage full'); } }, '2026-09-21', saved, 2, saved, 4), /Storage full/);
});
