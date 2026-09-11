// First-use and error paths. Actual components; blocked external calls and fictional data.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const cli = process.env.PORTAL_AUDIT_BROWSER;
if (!cli) throw Error('Set PORTAL_AUDIT_BROWSER.');
const output = resolve('outputs/portal-entry'); mkdirSync(output, { recursive: true });
const run = (...args) => execFileSync(process.execPath, [cli, '--session', 'portal-entry', ...args], { encoding: 'utf8', timeout: 30000 }).trim();
function js(code) { let value = JSON.parse(run('eval', `JSON.stringify(${code})`)); return typeof value === 'string' ? JSON.parse(value) : value; }
function open(query) { run('open', `http://127.0.0.1:4181/portal-audit.html?${query}`); run('wait', '--load', 'networkidle'); }
function button(text) { js(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.getClientRects().length&&e.textContent.trim()===${JSON.stringify(text)});if(!b)throw Error('Missing '+${JSON.stringify(text)});b.click();return true})()`); }
const results = [];
function capture(name, width, theme) {
  const state = js(`({errors:window.portalAudit.errors,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,writes:window.portalAudit.writes()})`);
  assert.equal(state.errors.length, 0, name); assert.ok(state.scrollWidth <= width + 1, `${name} overflow`);
  results.push({ name, theme, ...state }); writeFileSync(resolve(output, 'results.json'), JSON.stringify(results, null, 2));
  run('screenshot', resolve(output, `${theme}-${width}-${name}.png`)); console.log(`${theme} ${width} ${name}: passed`);
}
for (const width of [390, 768, 1280]) for (const theme of ['light', 'dark']) {
  run('set', 'viewport', String(width), width === 390 ? '844' : '1024'); run('set', 'media', theme);
  for (const screen of ['sign-in', 'reset-password', 'accept-invite']) {
    open(`screen=${screen}`); capture(screen, width, theme);
  }
  open('screen=sign-in');
  run('fill', 'input[type=email]', 'preview@example.invalid'); run('fill', 'input[type=password]', '1234');
  js('(()=>{window.portalAudit.setFailWrite(true);return true})()'); button('Sign in'); run('wait', '.login-message');
  assert.ok(js(`document.querySelector('.login-message').textContent.includes('connection was interrupted')`));
  assert.equal(js(`document.querySelector('input[type=email]').value`), 'preview@example.invalid');
  capture('failed-sign-in-can-retry', width, theme);
  button('New User — Create Login'); run('wait', '.login-reset-card');
  assert.ok(js(`document.querySelector('.login-reset-card').textContent.includes('Back to Sign In')`));
  capture('new-user-return-path', width, theme); button('Back to Sign In');
  open('page=timesheets&display=portal');
  assert.equal(js(`document.querySelector('.record-details-body').hidden`), true);
  run('click', '.record-details-toggle'); assert.equal(js(`document.querySelector('.record-details-body').hidden`), false);
  run('click', '.record-details-toggle');
  js(`(()=>{document.querySelector('.timesheet-card').scrollIntoView({block:'start'});return true})()`);
  capture('compact-timesheet-details', width, theme);
  open('page=command-board&active-command=1&display=portal'); run('wait', '.icb-stage-strip button');
  js(`(()=>{document.querySelector('.icb-stage-strip').scrollIntoView({block:'center'});return true})()`);
  run('click', '.icb-stage-strip button');
  assert.equal(js(`document.querySelector('.icb-stage-strip button').getAttribute('aria-pressed')`), 'true');
  assert.equal(js('window.portalAudit.writes()'), 0);
  capture('staged-unit-tap-selects', width, theme);
}
run('set', 'media', 'light');
console.log(`Passed ${results.length} first-use states.`);
