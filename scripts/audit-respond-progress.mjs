import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const cli = process.env.PORTAL_AUDIT_BROWSER;
if (!cli) throw Error('Set PORTAL_AUDIT_BROWSER to the agent-browser executable.');
const output = resolve('outputs/respond-progress');
mkdirSync(output, { recursive: true });
const run = (...args) => execFileSync(cli, ['--session', 'respond-progress', ...args], { encoding: 'utf8', timeout: 55000 }).trim();
const js = expression => { const value = JSON.parse(run('eval', `JSON.stringify(${expression})`)); return typeof value === 'string' ? JSON.parse(value) : value; };
const snapshot = () => run('snapshot', '-i');
const wait = expression => run('wait', '--fn', `Boolean(${expression})`);
const click = selector => {
  const textSelector = selector.match(/^(.*):text-is\("(.*)"\)$/);
  const target = textSelector ? `[...document.querySelectorAll(${JSON.stringify(textSelector[1])})].find(element=>element.textContent===${JSON.stringify(textSelector[2])})` : `document.querySelector(${JSON.stringify(selector)})`;
  js(`(()=>{(${target}).scrollIntoView({block:'center',behavior:'instant'});return true})()`);
  if (textSelector) run('find', 'role', 'button', 'click', '--name', textSelector[2]);
  else run('click', selector);
  snapshot();
};
const panel = '.respond-progress-panel';
const ready = () => wait(`document.querySelector('${panel} button:not(:disabled)')`);
const choose = unit => { run('select', '[aria-label="Preview device"]', unit); snapshot(); };
const refresh = patch => { js(`Object.assign(window.progressAudit,${JSON.stringify(patch)}) && true`); click('button:text-is("Refresh fixture")'); };
const state = () => js(`(()=>({text:document.querySelector('${panel}')?.innerText||'',buttons:[...document.querySelectorAll('${panel} button')].map(b=>({text:b.textContent,disabled:b.disabled})),overflow:document.documentElement.scrollWidth>innerWidth,errors:window.progressAudit.errors,writes:window.progressAudit.writes,overlay:!!document.querySelector('vite-error-overlay,[data-nextjs-dialog]'),storage:JSON.parse(localStorage.getItem('stickney-respond-progress-v2')||'{}')}))()`);
const results = [];
function check(name, predicate) { const value = state(); assert.deepEqual(value.errors, [], name); assert.equal(value.writes, 0, name); assert.equal(value.overlay, false, name); assert.equal(value.overflow, false, name); assert.ok(predicate(value), name); results.push({ name, ...value }); console.log(`PASS ${name}`); }
const base = 'http://127.0.0.1:4196/tests/fixtures/respond-progress.html';
try {
  for (const width of process.argv.includes('--from-tablet') ? [768, 390] : [1518, 768, 390]) {
    run('set', 'viewport', String(width), '666'); run('open', base); snapshot();
    js(`localStorage.removeItem('stickney-respond-progress-v2') || true`);
    wait('document.querySelector(".respond-field-toolbar")');
    if (!(width === 768 && process.argv.includes('--remaining-interactions'))) check(`${width}: department view has no progress controls`, value => !value.text);
    choose('1204'); ready();
    if (!(width === 768 && process.argv.includes('--remaining-interactions'))) check(`${width}: assigned unit and call shown`, value => value.text.includes('UNIT 1204 · CALL FIXTURE-100') && value.buttons.length === 3);
    click(`${panel} button:text-is("Acknowledged")`);
    check(`${width}: only selected unit/call saved`, value => value.buttons[0].text === 'En route' && value.storage['["fixture-a","FIXTURE-100","1204"]'].status === 'acknowledged' && Object.keys(value.storage).length === 1);
    choose('1205'); ready();
    check(`${width}: another unit starts independently`, value => value.text.includes('UNIT 1205') && value.buttons[0].text === 'Acknowledged');
    choose('1204'); ready();
    check(`${width}: selected unit restores its step`, value => value.buttons[0].text === 'En route');
    js(`document.querySelector('${panel}').scrollIntoView({block:'center',behavior:'instant'}) || true`);
    run('screenshot', resolve(output, `${width}-assigned.png`));
    choose('1208'); wait(`!document.querySelector('${panel}')`);
    check(`${width}: unassigned unit has no progress controls`, value => !value.text);
  }
  run('open', `${base}?unit=1204`); snapshot(); ready();
  check('reload restores only current unit progress', value => value.buttons[0].text === 'En route');
  refresh({ reportNumber: 'FIXTURE-200' }); wait(`document.querySelector('${panel}')?.innerText.includes('CALL FIXTURE-200')`); ready();
  check('new call does not inherit the old call step', value => value.buttons[0].text === 'Acknowledged');
  refresh({ departmentId: 'fixture-b', reportNumber: 'FIXTURE-100' }); wait(`document.querySelector('${panel}')?.innerText.includes('CALL FIXTURE-100')`); ready();
  check('another department cannot inherit saved progress', value => value.buttons[0].text === 'Acknowledged');
  js('window.progressAudit.failStorage(true) || true'); click(`${panel} button:text-is("Acknowledged")`);
  check('failed save is reported and does not advance', value => value.text.includes('Progress was not saved') && value.buttons[0].text === 'Acknowledged');
  js('window.progressAudit.failStorage(false) || true'); click(`${panel} button:text-is("Acknowledged")`);
  check('save succeeds after storage recovery', value => value.buttons[0].text === 'En route');
  refresh({ failed: true }); wait(`document.querySelector('${panel}')?.innerText.includes('Progress changes paused')`);
  check('failed live check disables progress changes', value => value.buttons.every(button => button.disabled));
  refresh({ failed: false }); ready();
  check('reconnect restores current unit controls', value => value.buttons[0].text === 'En route');
  refresh({ assigned: '1205' }); wait(`!document.querySelector('${panel}')`);
  check('assignment removal hides controls', value => !value.text);
  refresh({ assigned: '1204, 1205' }); ready();
  refresh({ hold: true }); wait('!!window.progressAudit.pending'); choose('1205');
  check('in-flight old-unit packet cannot expose new-unit controls', value => !value.text);
  js('(()=>{window.progressAudit.hold=false;window.progressAudit.pending();window.progressAudit.pending=null;return true})()');
  refresh({}); ready();
  check('new unit is independent after delayed previous request', value => value.text.includes('UNIT 1205') && value.buttons[0].text === 'Acknowledged');
  js(`(()=>{const key='["fixture-b","FIXTURE-100","1205"]';const all=JSON.parse(localStorage.getItem('stickney-respond-progress-v2')||'{}');all[key]={status:'on_scene',updatedAt:new Date().toISOString()};localStorage.setItem('stickney-respond-progress-v2',JSON.stringify(all));dispatchEvent(new StorageEvent('storage',{key:'stickney-respond-progress-v2'}));return true})()`);
  wait(`document.querySelector('${panel} button')?.textContent === 'Cleared scene'`);
  check('storage-event refresh uses the matching unit only', value => value.buttons[0].text === 'Cleared scene');
  refresh({ noCall: true }); wait('document.querySelector(".respond-overview-page")');
  check('ended call removes progress controls', value => !value.text);
  click('button:text-is("Toggle Respond")');
  const requests = js('window.progressAudit.requests.length');
  // One existing 10-second call-poll window verifies timer cleanup after unmount.
  run('wait', '10500'); assert.equal(js('window.progressAudit.requests.length'), requests);
  results.push({ name: 'unmount stops polling and progress listeners' });
  writeFileSync(resolve(output, 'results.json'), JSON.stringify(results, null, 2));
  console.log(`PASS ${results.length} browser scenarios`);
} catch (error) {
  run('screenshot', resolve(output, 'failure.png'));
  throw error;
} finally { run('close'); }
