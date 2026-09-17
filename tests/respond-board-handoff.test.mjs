import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { defaultRespondDeviceSettings, RESPOND_ALERT_DURATION_SECONDS, shouldOpenBoardRespondAlert } from '../app/respond-device.ts';

const read = path => readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
const board = read('app/operations-board.tsx');
const shell = read('app/payroll-app.tsx');
const respond = read('app/respond.tsx');
const visiblePages = ['Operations Board', 'Respond'];
const call = (reportNumber, respondingUnits = '1204') => ({ reportNumber, respondingUnits });

test('Live Operations automatically opens Respond in standard and TV-capable device modes', () => {
  for (const mode of ['standard', 'operations-alert']) {
    assert.equal(shouldOpenBoardRespondAlert('Operations Board', visiblePages, { ...defaultRespondDeviceSettings, mode }, call('NEW')), true);
  }
  assert.equal(RESPOND_ALERT_DURATION_SECONDS, 90);
});

test('automatic handoff requires both permissions and never interrupts another workspace', () => {
  for (const page of ['Daily Log', 'Payroll', 'Field Preplans', 'Respond', 'Employees', 'Scheduling']) {
    assert.equal(shouldOpenBoardRespondAlert(page, visiblePages, defaultRespondDeviceSettings, call('NEW')), false);
  }
  for (const allowed of [[], ['Operations Board'], ['Respond']]) {
    assert.equal(shouldOpenBoardRespondAlert('Operations Board', allowed, defaultRespondDeviceSettings, call('NEW')), false);
  }
  assert.equal(shouldOpenBoardRespondAlert('Operations Board', visiblePages, defaultRespondDeviceSettings, call('  ')), false);
});

test('assigned apparatus handoffs preserve exact CAD unit matching', () => {
  const settings = { ...defaultRespondDeviceSettings, mode: 'apparatus', apparatus: '1204' };
  assert.equal(shouldOpenBoardRespondAlert('Operations Board', visiblePages, settings, call('NEW', '1201 / 1204')), true);
  for (const units of ['12040', 'E1204', '1205', '']) {
    assert.equal(shouldOpenBoardRespondAlert('Operations Board', visiblePages, settings, call('NEW', units)), false);
  }
});

// Execute the production detection block, including its real first-load baseline
// and deduplication. No live incident, database write, or push notification.
const detection = board.slice(board.indexOf('      const incomingIds ='), board.indexOf('      const committed =', board.indexOf('      const incomingIds =')));
assert.ok(detection.includes('seenCallIdsRef.current = incomingIds;'));
const detect = new Function('result', 'seenCallIdsRef', 'alertEnabledRef', 'onNewActiveCallRef', 'playAlert',
  ts.transpileModule(detection, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText);

test('initial active calls and ordinary CAD edits never trigger or repeat the takeover', () => {
  const seen = { current: null }, sound = { current: false }, received = [];
  const callback = { current: item => received.push(item.reportNumber) };
  const load = activeCalls => detect({ activeCalls }, seen, sound, callback, () => assert.fail('Sound is off'));
  load([call('OLD')]);
  assert.deepEqual(received, []);
  load([call('NEW'), call('OLD')]);
  assert.deepEqual(received, ['NEW'], 'sound off does not suppress the handoff');
  load([{ ...call('NEW'), notes: 'Updated CAD notes' }, call('OLD')]);
  load([]);
  load([call('NEW')]);
  assert.deepEqual(received, ['NEW'], 'an already seen report cannot repeatedly restart the timer');
});

test('a batch offers all new reports and leaves the newest eligible apparatus call selected', () => {
  const settings = { ...defaultRespondDeviceSettings, mode: 'apparatus', apparatus: '1204' };
  const received = [];
  let selected = '', sounds = 0;
  const callback = { current: item => {
    received.push(item.reportNumber);
    if (shouldOpenBoardRespondAlert('Operations Board', visiblePages, settings, item)) selected = item.reportNumber;
  } };
  detect({ activeCalls: [call('OTHER-RIG', '1205'), call('NEW-ELIGIBLE'), call('OLDER-ELIGIBLE')] }, { current: new Set() }, { current: true }, callback, () => { sounds++; });
  assert.deepEqual(received, ['OLDER-ELIGIBLE', 'NEW-ELIGIBLE', 'OTHER-RIG']);
  assert.equal(selected, 'NEW-ELIGIBLE');
  assert.equal(sounds, 1);
});

const timerStart = shell.indexOf('  useEffect(() => {\n    if (!respondAlertCallId) return;');
const timerBlock = shell.slice(timerStart, shell.indexOf('  }, [respondAlertCallId]);', timerStart) + '  }, [respondAlertCallId]);'.length);
assert.ok(timerStart > 0 && timerBlock.includes('clearInterval'));
const runTimer = new Function('respondAlertCallId', 'RESPOND_ALERT_DURATION_SECONDS', 'Date', 'window', 'setRespondAlertSeconds', 'setRespondAlertCallId', 'useEffect', timerBlock);

function timerHarness() {
  let now = 1000, cleanup, tick, seconds = 90, selected = '';
  const start = id => {
    cleanup?.();
    selected = id;
    runTimer(id, RESPOND_ALERT_DURATION_SECONDS, { now: () => now }, {
      setInterval: (callback, ms) => { assert.equal(ms, 1000); tick = callback; return callback; },
      clearInterval: callback => { if (tick === callback) tick = undefined; },
    }, value => { seconds = value; }, value => { selected = value; }, effect => { cleanup = effect(); });
  };
  return { start, advance: ms => { now += ms; tick?.(); }, get seconds() { return seconds; }, get selected() { return selected; } };
}

test('Respond returns after exactly 90 seconds, including delayed background timer callbacks', () => {
  const timer = timerHarness();
  timer.start('NEW');
  timer.advance(89_000);
  assert.equal(timer.seconds, 1);
  assert.equal(timer.selected, 'NEW');
  timer.advance(1000);
  assert.equal(timer.seconds, 0);
  assert.equal(timer.selected, '');
  timer.start('NEXT');
  timer.advance(120_000);
  assert.equal(timer.selected, '', 'a sleeping TV does not extend the alert on wake');
});

test('a distinct new call gets a fresh 90 seconds; Return now cancels the previous timer', () => {
  const timer = timerHarness();
  timer.start('FIRST');
  timer.advance(60_000);
  timer.start('SECOND');
  timer.advance(30_000);
  assert.equal(timer.selected, 'SECOND');
  assert.equal(timer.seconds, 60);
  timer.advance(60_000);
  assert.equal(timer.selected, '');
  timer.start('THIRD');
  timer.advance(10_000);
  timer.start('');
  timer.advance(100_000);
  assert.equal(timer.seconds, 80, 'cleanup removed the dismissed alert timer');
  assert.equal(timer.selected, '');
});

test('the actual alert opens its own report and keeps the board mounted for later incoming calls', () => {
  assert.match(shell, /shouldOpenBoardRespondAlert\(activeNav, visibleNav, respondDeviceSettings, call\)/);
  assert.match(shell, /<Respond key=\{respondAlertCallId\} initialReportNumber=\{respondAlertCallId\} apparatus=\{respondDeviceSettings.mode === "apparatus" \? respondDeviceSettings.apparatus : ""\}/);
  assert.match(respond, /\[selectedReportNumber, setSelectedReportNumber\] = useState\(\(\) => initialReportNumber \|\|/);
  assert.match(shell, /onClick=\{\(\) => setRespondAlertCallId\(""\)\}>Return now/);
  assert.match(shell, /activeNav === "Operations Board" && visibleNav.includes\("Operations Board"\) && <OperationsBoard/);
  assert.match(shell, /respondAlertCallId && activeNav === "Operations Board" && visibleNav.includes\("Operations Board"\) && visibleNav.includes\("Respond"\)/);
  assert.match(board, /document.documentElement.requestFullscreen\(\)/, 'TV fullscreen includes the overlay, not just the board');
});
