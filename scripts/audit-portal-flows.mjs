import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const cli = process.env.PORTAL_AUDIT_BROWSER;
if (!cli) throw Error('Set PORTAL_AUDIT_BROWSER.');
const output = resolve('outputs/portal-flows'); mkdirSync(output, { recursive: true });
const run = (...args) => execFileSync(process.execPath, [cli, '--session', 'portal-flows', ...args], { encoding: 'utf8', timeout: 30000 }).trim();
function js(code) { let value = JSON.parse(run('eval', `JSON.stringify(${code})`)); return typeof value === 'string' ? JSON.parse(value) : value; }
const open = page => { run('open', `http://127.0.0.1:4181/portal-audit.html?display=portal&${page}`); run('wait', '--load', 'networkidle'); };
function click(selector) { js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'center',behavior:'instant'});return true})()`); run('click', selector); }
function textButton(text, scope = 'document') { js(`(()=>{const e=[...${scope}.querySelectorAll('button')].find(e=>e.getClientRects().length&&e.textContent.trim()===${JSON.stringify(text)});if(!e)throw Error('Missing button '+${JSON.stringify(text)});e.click();return true})()`); }
const results = [];
function capture(name, width) {
  const state = js(`({errors:window.portalAudit.errors,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,writes:window.portalAudit.writes()})`);
  assert.equal(state.errors.length, 0, `${name}: runtime errors`); assert.ok(state.scrollWidth <= width + 1, `${name}: page overflow`);
  run('screenshot', resolve(output, `${width}-${name}.png`)); results.push({ name, ...state }); writeFileSync(resolve(output, 'results.json'), JSON.stringify(results, null, 2)); console.log(`${width} ${name}: passed`);
}
for (const width of [390, 768]) {
  run('set', 'viewport', String(width), width === 390 ? '844' : '1024');
  open('page=dashboard');
  click('.chief-quick-access button:nth-child(3)'); run('wait', '.scheduler');
  assert.ok(js(`document.querySelector('.workspace-wayfinding').textContent.includes('Back to Home')`));
  textButton('← Back to Home'); run('wait', '.role-dashboard');
  capture('forward-and-back', width);
  click('.global-search-trigger'); run('fill', '.global-search-input input', 'Fictional second');
  run('wait', '.global-search-results button'); click('.global-search-results button'); run('wait', '.policy-reader');
  assert.ok(js(`document.querySelector('.policy-reader').textContent.includes('Second fictional policy selected correctly')`));
  textButton('← Back to policies'); assert.ok(js(`document.querySelector('.policy-toc').getClientRects().length > 0`));
  js(`(()=>{const b=[...document.querySelectorAll('.policy-toc button')].find(e=>e.textContent.includes('Fictional first'));b.click();return true})()`);
  assert.ok(js(`document.querySelector('.policy-reader').textContent.includes('Not department guidance')`));
  capture('search-opens-exact-policy-and-list-return', width);
  textButton('Edit'); run('fill', '.resource-form textarea', 'Fictional retained edit');
  js(`(()=>{window.portalAudit.setFailWrite(true);return true})()`);
  textButton('Save Policy'); run('wait', '.resource-page .error-banner');
  assert.equal(js(`document.querySelector('.resource-form textarea').value`), 'Fictional retained edit');
  capture('policy-save-failure-retains-work', width);
  textButton('Save Policy'); run('wait', '.phone-message');
  assert.equal(js(`document.querySelector('.resource-form')===null`), true);
  capture('policy-save-retry', width);
  open('page=employees'); run('fill', '.portal-roster-search input', 'Officer');
  assert.equal(js(`document.querySelectorAll('.employee-roster-card tbody tr').length`), 1);
  click('.employee-roster-card .edit-employee'); run('fill', '.employee-profile-form input[autocomplete="family-name"]', 'Changed');
  js(`(()=>{window.confirm=()=>false;return true})()`); textButton('Cancel · Back to roster');
  assert.ok(js(`Boolean(document.querySelector('.employee-profile-form'))`));
  js(`(()=>{window.portalAudit.setFailWrite(true);return true})()`);
  textButton('Save Changes'); run('wait', '.employee-profile-form .error-banner');
  assert.equal(js(`document.querySelector('.employee-profile-form input[autocomplete="family-name"]').value`), 'Changed');
  capture('employee-failure-and-cancel-protection', width);
  textButton('Save Changes'); run('wait', '.toast');
  assert.equal(js(`document.querySelector('.employee-profile-form')===null`), true);
  capture('employee-retry', width);
  open('page=phone-numbers'); textButton('Admin Edit'); textButton('Remove');
  js(`(()=>{window.portalAudit.setFailWrite(true);return true})()`); textButton('Remove Contact'); run('wait', '.phone-page .error-banner');
  assert.equal(js(`document.querySelectorAll('.phone-entry').length`), 1);
  assert.ok(!js(`document.querySelector('.phone-message')?.textContent || ''`).includes('Contact removed'));
  capture('failed-delete-is-not-success', width);
  textButton('Remove'); textButton('Remove Contact'); run('wait', '.phone-message');
  assert.equal(js(`document.querySelectorAll('.phone-entry').length`), 0);
  capture('delete-retry', width);
  open('page=timesheets');
  assert.equal(js(`[...document.querySelectorAll('.entry-grid tbody tr')].filter(e=>e.getClientRects().length).length`), 1);
  // Native date widgets vary by platform; dispatch the browser's date value change.
  js(`(()=>{const e=document.querySelector('.timesheet-phone-day input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'2026-09-15');e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  assert.ok(js(`[...document.querySelectorAll('.entry-grid tbody tr')].find(e=>e.getClientRects().length).textContent.includes('Sep 15')`));
  textButton('Show whole period'); assert.equal(js(`[...document.querySelectorAll('.entry-grid tbody tr')].filter(e=>e.getClientRects().length).length`), 15);
  textButton('Show selected day');
  capture('day-and-full-period-toggle', width);
  open('page=dashboard&role=member');
  assert.ok(!js(`document.querySelector('.chief-quick-access').textContent.includes('Daily Log')`));
  assert.ok(!js(`document.querySelector('.footer-links').textContent.includes('Important phone numbers')`));
  run('fill', '.portal-task-directory input', 'payroll');
  assert.ok(!js(`[...document.querySelectorAll('.portal-task-groups button strong')].some(e=>e.textContent.trim()==='Payroll →')`));
  capture('member-permitted-paths-only', width);
}
console.log(`Passed ${results.length} workflow states.`);
