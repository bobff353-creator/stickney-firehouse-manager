import { execFileSync } from 'node:child_process';
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const cli = process.env.PORTAL_AUDIT_BROWSER;
if (!cli) throw Error('Set PORTAL_AUDIT_BROWSER to the agent-browser executable.');
const output = resolve('outputs/respond-hydrant-location');
mkdirSync(output, { recursive: true });
// File-backed output avoids a Windows browser child keeping CLI pipes open.
const run = (...args) => {
  const stdoutPath = resolve(output, 'browser-stdout.txt');
  const stderrPath = resolve(output, 'browser-stderr.txt');
  const stdout = openSync(stdoutPath, 'w');
  const stderr = openSync(stderrPath, 'w');
  try { execFileSync(cli, ['--session', 'hydrant-location', ...args], { stdio: ['ignore', stdout, stderr], timeout: 45000 }); }
  catch (error) { console.error(readFileSync(stderrPath, 'utf8')); throw error; }
  finally { closeSync(stdout); closeSync(stderr); }
  return readFileSync(stdoutPath, 'utf8').trim();
};
const js = expression => { const value = JSON.parse(run('eval', `JSON.stringify(${expression})`)); return typeof value === 'string' ? JSON.parse(value) : value; };
const results = [];
try {
  run('open', 'http://127.0.0.1:4196/tests/fixtures/respond-progress.html?hydrants=1');
  run('snapshot', '-i');
  run('wait', '.respond-hydrant-summary');
  for (const width of [360, 390, 768, 1213]) {
    run('set', 'viewport', String(width), '800');
    js(`document.querySelector('.respond-nearest-hydrants').scrollIntoView({block:'center',behavior:'instant'}) || true`);
    run('snapshot', '-i');
    const state = js(`({labels:[...document.querySelectorAll('.respond-hydrant-summary>b')].map(x=>x.textContent),details:[...document.querySelectorAll('.respond-hydrant-summary>small')].map(x=>x.textContent),overflow:document.documentElement.scrollWidth>innerWidth,errors:window.progressAudit.errors,writes:window.progressAudit.writes,overlay:!!document.querySelector('vite-error-overlay,[data-nextjs-dialog]')})`);
    assert.deepEqual(state.labels, ['Preview only — Oak Avenue at West Sample Street, northeast corner', 'Location not recorded', 'Preview only — south entrance']);
    assert.deepEqual(state.details, ['Hydrant 106 · 126 ft · in service', 'Hydrant 107 · 256 ft · out of service', '352 ft · unknown']);
    assert.deepEqual(state.errors, []);
    assert.equal(state.writes, 0);
    assert.equal(state.overflow, false);
    assert.equal(state.overlay, false);
    run('screenshot', resolve(output, `${width}.png`));
    results.push({ width, ...state });
    console.log(`PASS location-first labels and layout at ${width}px`);
  }
  run('find', 'role', 'button', 'click', '--name', 'Open preplans & hydrants');
  run('snapshot', '-i');
  assert.deepEqual(js('window.progressAudit.navigations'), ['Field Preplans']);
  js('window.progressAudit.hydrants=[]');
  run('find', 'role', 'button', 'click', '--name', 'Refresh fixture');
  run('snapshot', '-i');
  run('wait', '--fn', `document.querySelector('.respond-nearest-hydrants').textContent.includes('No verified hydrants')`);
  assert.equal(js('document.querySelectorAll(".respond-hydrant-summary").length'), 0);
  const requests = js('window.progressAudit.requests');
  assert.ok(requests.every(url => ['/api/respond', '/api/maps-config', '/api/apparatus-locations'].some(path => url.startsWith(path))));
  results.push({ name: 'Navigation, empty state and no extra API paths', requests });
  writeFileSync(resolve(output, 'results.json'), JSON.stringify(results, null, 2));
  console.log('PASS navigation, empty state and no extra API paths');
} finally {
  try { run('close'); } catch (error) { console.warn(`Browser cleanup: ${error.message}`); }
}
