import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../app/daily-log.tsx', import.meta.url), 'utf8');
const requestSource = readFileSync(new URL('../app/daily-log-save-request.ts', import.meta.url), 'utf8');
const compile = input => ts.transpileModule(input, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const start = source.indexOf('const saveLog = useCallback(');
const end = source.indexOf('\n  useEffect(', start);
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const ok = version => ({ response: { ok: true, status: 200 }, result: { saveVersion: version } });

function harness(request = async () => ok(2)) {
  const state = {}, drafts = new Map(), requests = [];
  const scope = {
    Error, Date, Map, JSON, Number, Object, useCallback: fn => fn,
    loaded: { current: true }, autosaveAuthorized: { current: true },
    saveInFlight: { current: false }, saveAgain: { current: false },
    saveRetryRequired: { current: false },
    loadRequest: { current: 1 }, editVersion: { current: 0 },
    savedVersions: { current: new Map([['2099-01-01', 0]]) },
    latestSave: { current: { logDate: '2099-01-01', staffing: [{ id: 'fixture', employeeId: 'fixture-member' }], calls: [], shiftNotes: 'Original' } },
    draftKey: date => date,
    window: { navigator: { onLine: true }, localStorage: { setItem: (key, value) => drafts.set(key, value), removeItem: key => drafts.delete(key) } },
    requestDailyLogSave: async (payload, slow) => { requests.push(payload); return request(payload, slow); },
    onPayrollSynced: () => { state.refreshes = (state.refreshes || 0) + 1; },
  };
  for (const [, name] of source.slice(start, end).matchAll(/\b(set[A-Z]\w*)\(/g)) scope[name] = value => { state[name] = value; };
  return { save: vm.runInNewContext(compile(source.slice(start, end)) + '\nsaveLog', scope), state, scope, requests, drafts };
}

test('confirm and debounce during an active save produce one transaction, not duplicates', async () => {
  const response = deferred(), h = harness(() => response.promise);
  const saving = h.save();
  await h.save(); await h.save(true);
  assert.equal(h.requests.length, 1);
  assert.equal(h.state.setDirty, true);
  response.resolve(ok(5)); await saving;
  assert.equal(h.requests.length, 1);
  assert.equal(h.state.setDirty, false);
  assert.equal(h.state.setSaving, false);
  assert.equal(h.drafts.size, 0);
  assert.equal(h.state.refreshes, 1);
});

test('edits made during saving are sent once afterward with the confirmed version', async () => {
  const response = deferred(), h = harness(() => h.requests.length === 1 ? response.promise : ok(7));
  const saving = h.save();
  h.scope.latestSave.current = { ...h.scope.latestSave.current, shiftNotes: 'Newer notes' };
  h.scope.editVersion.current++;
  await h.save(true);
  response.resolve(ok(5)); await saving;
  assert.equal(h.requests.length, 2);
  assert.equal(h.requests[1].expectedVersion, 5);
  assert.equal(h.requests[1].shiftNotes, 'Newer notes');
  assert.equal(h.scope.savedVersions.current.get('2099-01-01'), 7);
  assert.equal(h.state.setDirty, false);
});

test('offline schedule confirmation remains dirty and recoverable without a POST', async () => {
  const h = harness(); h.scope.window.navigator.onLine = false;
  await h.save();
  assert.equal(h.requests.length, 0);
  assert.equal(h.state.setDirty, true);
  assert.equal(h.state.setDeviceDraftSaved, true);
  assert.match(h.state.setMessage, /Offline/);
  assert.equal(h.state.setSaving, false);
});

test('connection loss after a save retains newer edits against the new base version', async () => {
  const response = deferred(), h = harness(() => response.promise);
  const saving = h.save();
  h.scope.latestSave.current = { ...h.scope.latestSave.current, shiftNotes: 'Unsynced notes' };
  h.scope.editVersion.current++;
  h.scope.window.navigator.onLine = false;
  response.resolve(ok(5)); await saving;
  const draft = JSON.parse(h.drafts.get('2099-01-01'));
  assert.equal(draft.expectedVersion, 5);
  assert.equal(draft.shiftNotes, 'Unsynced notes');
  assert.equal(h.state.setDirty, true);
  assert.match(h.state.setMessage, /waiting to sync/);
  assert.equal(h.state.refreshes, undefined);
});

test('error, missing receipt and timeout keep the draft and release the saving state', async () => {
  for (const request of [
    async () => { throw new Error('Server did not confirm'); },
    async () => ({ response: { ok: false, status: 500 }, result: { error: 'Server did not confirm' } }),
    async () => ok(undefined), async () => ok(-1),
  ]) {
    const h = harness(request); await h.save();
    assert.equal(h.state.setDirty, true);
    assert.equal(h.state.setSaving, false);
    assert.equal(h.state.setSaveError, true);
    assert.equal(h.scope.saveRetryRequired.current, true);
    assert.equal(h.drafts.size, 1);
    assert.equal(h.state.setLastSynced, undefined);
    assert.equal(h.scope.savedVersions.current.get('2099-01-01'), 0);
  }
});

test('retry can recover, but a version conflict never overwrites the saved log', async () => {
  let failure = true;
  const h = harness(async () => { if (failure) throw new Error('Temporary'); return ok(3); });
  await h.save(); failure = false; await h.save();
  assert.equal(h.state.setSaveError, false);
  assert.equal(h.state.setDirty, false);
  const conflict = harness(async () => ({ response: { ok: false, status: 409 }, result: { error: 'Reload and review' } }));
  await conflict.save(); await conflict.save();
  assert.equal(conflict.requests.length, 1);
  assert.equal(conflict.scope.autosaveAuthorized.current, false);
  assert.equal(conflict.state.setSaveConflict, true);
  assert.equal(conflict.drafts.size, 1);
});

test('a late failure for another date cannot change the new date status', async () => {
  const response = deferred(), h = harness(() => response.promise);
  const saving = h.save();
  h.scope.loadRequest.current++;
  h.scope.latestSave.current = { ...h.scope.latestSave.current, logDate: '2099-01-02' };
  response.resolve({ response: { ok: false, status: 500 }, result: { error: 'Old date error' } });
  await saving;
  assert.equal(h.state.setSaveError, false);
  assert.notEqual(h.state.setMessage, 'Old date error');
  assert.equal(h.drafts.size, 1);
});

test('slow warning and deadline cover both the request and response body and clean up timers', async () => {
  for (const stallBody of [false, true]) {
    const timers = new Map(); let signal; let slow = false; let id = 0;
    const scope = { exports: {}, Error, AbortController, Promise, JSON,
      setTimeout: (fn, delay) => { timers.set(++id, { fn, delay }); return id; }, clearTimeout: id => timers.delete(id),
      fetch: async (_url, options) => { signal = options.signal; return stallBody ? { json: () => new Promise(() => {}) } : new Promise(() => {}); },
    };
    vm.runInNewContext(compile(requestSource), scope);
    const pending = scope.exports.requestDailyLogSave({}, () => { slow = true; });
    const rejection = assert.rejects(pending, /has not confirmed this save/);
    [...timers.values()].find(timer => timer.delay === 8000).fn();
    assert.equal(slow, true);
    [...timers.values()].find(timer => timer.delay === 30000).fn();
    await rejection;
    assert.equal(signal.aborted, true);
    assert.equal(timers.size, 0);
  }
});

test('status separates schedule confirmation from saving and prevents repeated confirmation', () => {
  assert.match(source, /Staffing needs confirmation/);
  assert.match(source, /Scheduled staffing is not saved yet/);
  assert.match(source, /disabled=\{saving\} onClick=\{\(\) => void saveLog\(\)\}/);
  assert.match(source, /if \(!saveRetryRequired.current\) void saveLog\(true\)/);
});

test('unavailable recovery storage does not block a confirmed server save', async () => {
  const h = harness();
  h.scope.window.localStorage.setItem = () => { throw new Error('Storage full'); };
  await h.save();
  assert.equal(h.requests.length, 1);
  assert.equal(h.state.setDirty, false);
  assert.equal(h.state.setSaveError, false);
  assert.equal(h.state.setSaving, false);
});
