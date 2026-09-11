import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { portalPages, pageSlug } from '../app/portal-navigation.ts';
const cli = process.env.PORTAL_AUDIT_BROWSER;
if (!cli) throw Error('Set PORTAL_AUDIT_BROWSER to agent-browser CLI.');
const output = resolve(`outputs/portal-usability${process.env.PORTAL_AUDIT_SUFFIX || ''}`);
mkdirSync(output, { recursive: true });
const run = (...args) => execFileSync(process.execPath, [cli, '--session', 'portal-audit', ...args], { encoding: 'utf8', timeout: 30000 }).trim();
function evaluate(js) { let value = JSON.parse(run('eval', `JSON.stringify(${js})`)); return typeof value === 'string' ? JSON.parse(value) : value; }
const pages = process.env.PORTAL_AUDIT_PAGES?.split('|') || portalPages.filter(page => page !== 'Inventory');
const widths = (process.env.PORTAL_AUDIT_WIDTHS || '390,768,1280').split(',').map(Number);
const roles = (process.env.PORTAL_AUDIT_ROLES || 'admin').split(',');
const results = [];
for (const role of roles) for (const width of widths) {
  run('set', 'viewport', String(width), process.env.PORTAL_AUDIT_HEIGHT || (width >= 768 ? '1024' : '844'));
  for (const page of pages) {
    run('open', `http://127.0.0.1:4181/portal-audit.html?role=${role}&page=${pageSlug(page)}&display=portal${process.env.PORTAL_AUDIT_FAILURE ? '&failure=all' : ''}`);
    run('wait', '--load', 'networkidle');
    const state = evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,errors:window.portalAudit.errors,unavailable:[...window.portalAudit.unknown],heading:document.querySelector('.topbar-context strong')?.textContent,text:document.querySelector('#portal-workspace')?.innerText.slice(0,400),overflow:[...document.querySelectorAll('#portal-workspace button,#portal-workspace input,#portal-workspace select,#portal-workspace textarea')].filter(e=>{const r=e.getBoundingClientRect();if(!e.getClientRects().length||e.closest('.table-wrap,.editable-mabas-scroll,.field-map,.command-board-map'))return false;return r.left < -1 || r.right > innerWidth+1}).map(e=>({tag:e.tagName,text:(e.textContent||e.getAttribute('aria-label')||e.getAttribute('placeholder')||'').slice(0,90),left:Math.round(e.getBoundingClientRect().left),right:Math.round(e.getBoundingClientRect().right)})),writes:window.portalAudit.writes()})`);
    results.push({ page, role, ...state });
    writeFileSync(resolve(output, 'results.json'), JSON.stringify(results, null, 2));
    run('screenshot', resolve(output, `${role}-${width}-${pageSlug(page)}.png`));
    console.log(`${role} ${width} ${page}: ${state.errors.length} errors, ${state.overflow.length} outside controls, ${state.scrollWidth}px`);
  }
}
const failures = results.filter(row => row.errors.length || row.scrollWidth > row.width + 1 || row.overflow.length || row.writes);
console.log(JSON.stringify({ states: results.length, failures: failures.map(({ page, role, width, errors, overflow }) => ({ page, role, width, errors, overflow })) }));
if (failures.length) process.exitCode = 1;
