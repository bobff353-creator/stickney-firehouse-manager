import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../app/daily-log-workflow.ts', import.meta.url), 'utf8');
const operational = readFileSync(new URL('../app/operational-day.ts', import.meta.url), 'utf8');
function compile(text, require = () => {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, { exports, require, Date, Intl });
  return exports;
}
const helpers = compile(source, () => compile(operational));
const entry = { id: 'test-1', at: '2026-09-16T13:10:00.000Z', category: 'Equipment issue', status: 'Open', text: 'Fixture only\nNeeds follow-up.' };

test('notes preserve legacy text exactly, including whitespace, with no migration', () => {
  for (const legacy of ['', 'Original officer notes.', 'Original notes.\n\nSecond paragraph.\n']) {
    const stored = helpers.writeLogNotes(legacy, [entry]);
    const parsed = helpers.readLogNotes(stored);
    assert.equal(parsed.text, legacy);
    assert.equal(JSON.stringify(parsed.entries), JSON.stringify([entry]));
    assert.equal(helpers.writeLogNotes(legacy, []), legacy);
  }
});
test('multiple note entries and resolved status survive storage round trips', () => {
  const entries = [entry, { ...entry, id: 'test-2', category: 'Handoff item', status: 'Resolved' }];
  const parsed = helpers.readLogNotes(helpers.writeLogNotes('Legacy', entries));
  assert.equal(parsed.text, 'Legacy');
  assert.equal(JSON.stringify(parsed.entries), JSON.stringify(entries));
});
test('malformed entry blocks remain readable plain text and embedded delimiters cannot truncate a note', () => {
  const malformed = '--- Log entry x ---\nRecorded: bad\nCategory: Equipment issue\nStatus: Open\nkeep me\n--- End log entry ---';
  assert.equal(helpers.readLogNotes(malformed).text, malformed);
  const stored = helpers.writeLogNotes('', [{ ...entry, text: 'before\n--- End log entry ---\nafter' }]);
  assert.match(helpers.readLogNotes(stored).entries[0].text, /before[\s\S]*after/);
});
test('completed calls require a valid recorded return time, including midnight', () => {
  for (const timeIn of ['0000', '00:00', '23:59', '1140']) assert.equal(helpers.callIsComplete({ timeIn }), true);
  for (const timeIn of ['', '2', '2500', '1260']) assert.equal(helpers.callIsComplete({ timeIn }), false);
});
test('shift expansion follows Central time across day boundaries and DST', () => {
  assert.equal(helpers.currentLogShift(new Date('2026-09-16T10:59:00Z')), 'overnight');
  assert.equal(helpers.currentLogShift(new Date('2026-09-16T11:00:00Z')), 'morning');
  assert.equal(helpers.currentLogShift(new Date('2026-09-16T17:00:00Z')), 'afternoon');
  assert.equal(helpers.currentLogShift(new Date('2026-09-16T23:00:00Z')), 'overnight');
  assert.equal(helpers.currentLogShift(new Date('2026-12-16T12:00:00Z')), 'morning');
});
test('log workflow retains navigation, locks, save conflict protection, and explicit call editing', () => {
  const component = readFileSync(new URL('../app/daily-log.tsx', import.meta.url), 'utf8');
  assert.match(component, /useUnsavedWork\(dirty, saving\)/);
  assert.match(component, /expectedVersion: savedVersions.current.get\(logDate\)/);
  assert.match(component, /callIsComplete\(existing\) && !editingCalls.includes\(id\)/);
  assert.match(component, /setRemoveCall\(call\)/);
  assert.match(component, /disabled=\{Boolean\(call.timeIn\)/);
  assert.match(component, /Saved to server/);
  assert.match(component, /Saving is not officer sign-off/);
  assert.match(component, /Required check status is unavailable—not confirmed complete/);
  assert.doesNotMatch(component, /while \(callRows.length < 2\)/);
});
