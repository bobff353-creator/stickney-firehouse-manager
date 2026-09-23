import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { backupLogRecovery, logDifferences } from '../app/daily-log-recovery.ts';
const source = readFileSync(new URL('../app/daily-log.tsx', import.meta.url), 'utf8');
const start = source.indexOf('async function applyReviewedChanges(');
const end = source.indexOf('\n  function changeLogDate', start);
const code = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const saved = { staffing: [], calls: [], shiftNotes: 'Server notes' };
const draft = { ...saved, shiftNotes: 'Unsaved note' };
function harness() {
  const state = {}, storage = new Map(), writes = [];
  const scope = {
    logDifferences, backupLogRecovery, Error, Date, JSON, Boolean,
    recoveryReview: { date: '2026-09-21', request: 3, draft, draftVersion: 2, saved, server: { log: { saveVersion: 5, locked: 0, adminUnlocked: 0, updatedAt: '2026-09-23T22:00:00Z' }, approvals: [] } },
    latestSave: { current: { ...draft, logDate: '2026-09-21' } }, loadRequest: { current: 3 },
    saveInFlight: { current: false }, savedVersions: { current: new Map([['2026-09-21', 2]]) },
    autosaveAuthorized: { current: false }, saveRetryRequired: { current: true }, editVersion: { current: 0 },
    parseSavedTime: value => new Date(value), draftKey: date => `sfd-daily-log-draft:${date}`,
    window: { localStorage: { setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } },
    saveLog: async () => writes.push({ ...scope.latestSave.current, expectedVersion: scope.savedVersions.current.get('2026-09-21') }),
  };
  for (const [, name] of source.slice(start, end).matchAll(/\b(set[A-Z]\w*)\(/g)) scope[name] = value => { state[name] = value; };
  return { apply: vm.runInNewContext(code + '\napplyReviewedChanges', scope), scope, state, storage, writes };
}
test('reviewed corrections save once against the reviewed version and back up both copies', async () => {
  const h = harness(); await h.apply(draft);
  assert.equal(h.writes.length, 1); assert.equal(h.writes[0].expectedVersion, 5);
  assert.equal(h.writes[0].shiftNotes, draft.shiftNotes);
  assert.equal(h.state.setSaveConflict, false);
  const backup = JSON.parse([...h.storage].find(([key]) => key.includes(':backup:'))[1]);
  assert.equal(backup.expectedVersion, 2); assert.equal(backup.shiftNotes, draft.shiftNotes);
  assert.equal(backup.comparedWith.shiftNotes, saved.shiftNotes);
});
test('choosing only saved values resumes editing without a write', async () => {
  const h = harness(); await h.apply(saved);
  assert.equal(h.writes.length, 0); assert.equal(h.state.setDirty, false);
  assert.equal(h.scope.autosaveAuthorized.current, true);
  assert.equal(h.scope.savedVersions.current.get('2026-09-21'), 5);
});
test('a changed date cannot apply an old review', async () => {
  const h = harness(); h.scope.loadRequest.current++;
  await h.apply(draft);
  assert.equal(h.writes.length, 0); assert.equal(h.storage.size, 0);
});
test('locked log rejects corrections before replacing or saving a draft', async () => {
  const h = harness(); h.scope.recoveryReview.server.log.locked = 1;
  await assert.rejects(h.apply(draft), /locked/);
  assert.equal(h.writes.length, 0); assert.equal(h.storage.size, 0);
  assert.equal(h.state.setSaveConflict, undefined);
});
test('failed backup leaves the original review and expected version intact', async () => {
  const h = harness(); h.scope.window.localStorage.setItem = () => { throw new Error('Full'); };
  await assert.rejects(h.apply(draft), /backup/);
  assert.equal(h.writes.length, 0);
  assert.equal(h.scope.savedVersions.current.get('2026-09-21'), 2);
  assert.equal(h.state.setRecoveryReview, undefined);
});
