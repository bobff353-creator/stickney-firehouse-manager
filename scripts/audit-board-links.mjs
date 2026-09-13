// Real UI -> local HTTP route -> actual store -> isolated PostgreSQL, no live writes.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, openSync, closeSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const cli = process.env.PORTAL_AUDIT_BROWSER;
if (!cli) throw Error('Set PORTAL_AUDIT_BROWSER to the native agent-browser executable.');
const output = resolve('outputs/board-links'); mkdirSync(output, { recursive: true });
let command = 0;
function run(...args) {
  const file = resolve(output, `command-${++command}.txt`), errors = resolve(output, `command-${command}-error.txt`);
  const fd = openSync(file, 'w'), ef = openSync(errors, 'w');
  try { execFileSync(cli, ['--session', 'board-links', ...args], { timeout: 40000, windowsHide: true, stdio: ['ignore', fd, ef] }); }
  catch (error) { console.error(readFileSync(errors, 'utf8')); throw error; }
  finally { closeSync(fd); closeSync(ef); }
  return readFileSync(file, 'utf8').trim();
}
const js = code => { const result = JSON.parse(run('eval', `(async()=>JSON.stringify(${code}))()`)); return typeof result === 'string' ? JSON.parse(result) : result; };
const waitFor = (condition, checks = 100) => run('eval', `(async()=>{for(let i=0;i<${checks};i++){if(${condition})return 'ready';await new Promise(r=>setTimeout(r,100));}throw Error('Condition not met');})()`);
const base = 'http://127.0.0.1:4192/tests/fixtures/board-feeds-audit.html?links';
const results = [];
function check() {
  const state = js(`({errors:window.boardFeedAudit.errors,overlay:!!document.querySelector('vite-error-overlay,[data-nextjs-dialog]'),width:innerWidth,scrollWidth:document.documentElement.scrollWidth})`);
  assert.deepEqual(state.errors, []); assert.equal(state.overlay, false); assert.ok(state.scrollWidth <= state.width + 1, JSON.stringify(state)); return state;
}
const button = name => { run('find', 'role', 'button', 'click', '--name', name); run('snapshot', '-i'); };
try {
  for (const [width, height] of [[390,844],[768,1024],[1213,666]]) {
    run('set', 'viewport', String(width), String(height)); run('open', base); run('snapshot', '-i');
    waitFor(`document.querySelector('button')?.textContent.includes('Edit news')`);
    button('Edit news & training links'); waitFor(`document.querySelector('dialog input') && !document.querySelector('dialog input').matches(':disabled')`);
    run('select', 'dialog select', 'news'); run('snapshot', '-i');
    const before = js(`await (await fetch('/api/board-links')).json()`);
    button('+ Add link');
    run('fill', 'dialog fieldset fieldset:last-of-type input[placeholder="What members will open"]', `Preview ${width} resource`);
    run('fill', 'dialog fieldset fieldset:last-of-type input[type=url]', `https://example.org/resource-${width}`);
    run('fill', 'dialog fieldset fieldset:last-of-type input[placeholder="Why this link is useful"]', 'Local preview — not a real department resource');
    run('snapshot', '-i');
    assert.equal(js(`(await (await fetch('/api/board-links')).json()).settings.revision`), before.settings.revision, 'typing must not save');
    button('Preview member view');
    assert.ok(js(`document.querySelector('dialog').textContent.includes('Preview ${width} resource')`));
    run('screenshot', resolve(output, `${width}-preview.png`));
    button('Back to editing'); run('screenshot', resolve(output, `${width}-editor.png`));
    const geometry = js(`(()=>{const d=document.querySelector('dialog').getBoundingClientRect(),f=document.querySelector('dialog footer').getBoundingClientRect();return {left:d.left,right:d.right,top:d.top,bottom:d.bottom,footerBottom:f.bottom};})()`);
    assert.ok(geometry.left >= 0 && geometry.right <= width + 1 && geometry.top >= 0 && geometry.footerBottom <= height + 1, JSON.stringify(geometry));
    button('Save links'); waitFor(`!document.querySelector('dialog')`);
    run('snapshot', '-i'); assert.ok(js(`document.querySelector('.rotating-panel').textContent.includes('Preview ${width} resource')`));
    const after = js(`await (await fetch('/api/board-links')).json()`); assert.notEqual(after.settings.revision, before.settings.revision);
    // Reopen -> record survived -> delete in draft -> persist only on Save.
    button('Edit news & training links'); waitFor(`document.querySelector('dialog input') && !document.querySelector('dialog input').matches(':disabled')`);
    assert.ok(js(`[...document.querySelectorAll('dialog input')].some(e=>e.value==='Preview ${width} resource')`));
    button('Remove link 2'); button('Save links'); waitFor(`!document.querySelector('dialog')`);
    assert.equal(js(`(await (await fetch('/api/board-links')).json()).settings.sections.news.links.length`), 1);
    results.push({ width, height, saveReopenDelete: true, ...check() });
  }
  // Two mounted boards receive the same committed change without a new polling loop.
  run('open', base+'&count=2'); run('snapshot', '-i'); waitFor(`document.querySelectorAll('.board-display-controls > button').length===2`);
  run('click', 'main:first-of-type .board-display-controls > button:first-child'); run('snapshot', '-i');
  waitFor(`document.querySelector('dialog input') && !document.querySelector('dialog input').matches(':disabled')`);
  const sharedTitle = `Preview shared IFSI links ${Date.now()}`;
  run('select','dialog select','ifsi'); run('snapshot','-i'); run('find','label','Section heading','fill',sharedTitle);
  button('Save links'); waitFor(`!document.querySelector('dialog')`);
  waitFor(`[...document.querySelectorAll('select option')].filter(e=>e.textContent===${JSON.stringify(sharedTitle)}).length===2`);
  check(); results.push({ twoBoardsUpdated: true });
  // Simulated DB failure retains the editor and draft and never claims saved.
  run('open', base); run('snapshot','-i'); waitFor(`document.querySelector('.board-display-controls > button')`);
  button('Edit news & training links'); waitFor(`document.querySelector('dialog input') && !document.querySelector('dialog input').matches(':disabled')`);
  run('find','label','Section heading','fill','Unsaved failure draft'); run('eval', `fetch('/__links-fail-next')`);
  const revision = js(`(await (await fetch('/api/board-links')).json()).settings.revision`);
  button('Save links'); waitFor(`document.querySelector('dialog [role=alert]')`);
  assert.ok(js(`[...document.querySelectorAll('dialog input')].some(e=>e.value==='Unsaved failure draft')`));
  assert.equal(js(`(await (await fetch('/api/board-links')).json()).settings.revision`),revision);
  run('screenshot', resolve(output, 'failed-save.png')); results.push({ failedSaveRetainsDraft: true });
  run('eval', `window.dispatchEvent(new Event('offline'))`);run('snapshot','-i');
  assert.ok(js(`document.querySelector('dialog button[type=submit]').disabled`));
  run('eval', `window.dispatchEvent(new Event('online'))`);
  waitFor(`!document.querySelector('dialog button[type=submit]').disabled`);
  assert.ok(js(`[...document.querySelectorAll('dialog input')].some(e=>e.value==='Unsaved failure draft')`));
  run('eval', `window.boardFeedAudit.incoming=true`);
  waitFor(`window.boardFeedAudit.alerts===1`,350);
  assert.ok(js(`document.querySelector('dialog') && document.querySelector('.active-call-summary').textContent.includes('SIMULATED CALL')`));
  results.push({ offlineDisablesSave: true, reconnectPreservesDraft: true, incomingCallWhileEditing: true });
  run('open', base+'&member'); run('snapshot','-i'); waitFor(`document.querySelector('.board-clock')`);
  assert.equal(js(`[...document.querySelectorAll('button')].filter(e=>/Edit links|Edit news/.test(e.textContent)).length`),0);
  assert.equal(js(`(await fetch('/api/board-links',{method:'PUT',body:'{}'})).status`),403); check();
  results.push({ memberCannotEdit: true });
  run('set','viewport','1920','1080');run('open',base+'&tv');run('snapshot','-i');waitFor(`document.querySelector('.tv-display')`);
  run('eval',`(async()=>{await new Promise(r=>setTimeout(r,26000));return true;})()`);run('snapshot','-i');check();run('screenshot',resolve(output,'tv.png'));
  writeFileSync(resolve(output,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({passed:true,results}));
} catch(error) { try{run('screenshot',resolve(output,'failure.png'));}catch{} throw error; }
finally { run('close'); }
