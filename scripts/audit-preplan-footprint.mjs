import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const cli = process.env.PORTAL_AUDIT_BROWSER;
if (!cli) throw Error('Set PORTAL_AUDIT_BROWSER to the installed agent-browser JavaScript CLI.');
const output = resolve('outputs/preplan-footprint');
mkdirSync(output, { recursive: true });
const run = (...args) => execFileSync(process.execPath, [cli, '--session', 'footprint-fix', ...args], { encoding: 'utf8', timeout: 30000 }).trim();
function js(expression) {
  const value = JSON.parse(run('eval', `JSON.stringify(${expression})`));
  return typeof value === 'string' ? JSON.parse(value) : value;
}
const snapshot = () => run('snapshot', '-i');
const scrollTo = selector => js(`(()=>{document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'});return true})()`);
const click = selector => { scrollTo(selector); run('click', selector); snapshot(); };
const results = [];
function capture(name, width) {
  const state = js(`(()=>{
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
    const panel=document.querySelector('.preplan-focus-map-panel'),editor=document.querySelector('.preplan-editor'),map=document.querySelector('.field-map'),header=editor.querySelector('header');
    const m=rect(map),h=rect(header),overlap=m.x<h.right-1&&m.right>h.x+1&&m.y<h.bottom-1&&m.bottom>h.y+1;
    return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,panel:rect(panel),editor:rect(editor),map:m,header:h,overlap,errors:window.portalAudit.errors,writes:window.portalAudit.writes(),points:document.querySelectorAll('.corner-point').length,markers:document.querySelectorAll('.hydrant-map-pin,.hydrant-cluster').length,overflow:[...editor.querySelectorAll('button,input,select,textarea')].filter(e=>{const r=e.getBoundingClientRect();return e.getClientRects().length&&(r.left<0||r.right>innerWidth+1)}).map(e=>e.textContent.slice(0,80))};
  })()`);
  assert.deepEqual(state.errors, [], `${name}: runtime errors`);
  assert.equal(state.writes, 0, 'Drawing and accepting must not save');
  assert.ok(state.scrollWidth <= width + 1, `${name}: page overflow`);
  assert.deepEqual(state.overflow, [], `${name}: control overflow`);
  assert.equal(state.overlap, false, `${name}: editor header covers map`);
  if (width > 1150) {
    assert.ok(state.panel.right <= state.editor.x + 1, `${name}: map and editor need separate columns`);
  } else {
    assert.ok(state.panel.bottom <= state.editor.y + 1, `${name}: editor must follow the map`);
  }
  run('screenshot', resolve(output, `${width}-${name}.png`));
  results.push({ name, ...state });
  writeFileSync(resolve(output, 'results.json'), JSON.stringify(results, null, 2));
  console.log(`${width} ${name}: passed; ${state.points} corners, ${state.writes} writes`);
}

run('set', 'media', 'light', 'reduced-motion');
for (const width of [1518, 1151, 1150, 1024, 768, 390, 360]) {
  run('set', 'viewport', String(width), width === 768 ? '1024' : '666');
  run('open', 'http://127.0.0.1:4181/portal-audit.html?page=field-preplans&display=portal&preplan-capture=1&preplan=new');
  run('wait', '.field-directory-tabs'); snapshot();
  click('.field-directory-tabs button:nth-child(2)');
  click('.imported-street-groups summary');
  click('.imported-street-groups article button');
  run('wait', '.preplan-capture-help');
  assert.equal(js(`document.querySelectorAll('.hydrant-map-pin,.hydrant-cluster').length`), 0);
  scrollTo('.field-map-toolbar');
  const zoom = js(`(()=>{const g=document.querySelector('.preplan-map-zoom').getBoundingClientRect(),out=document.querySelector('.preplan-map-zoom button:first-child').getBoundingClientRect(),inside=document.querySelector('.preplan-map-zoom button:last-child').getBoundingClientRect();return {left:g.left,right:g.right,aligned:Math.abs(out.top-inside.top)<1}})()`);
  assert.ok(zoom.left >= 0 && zoom.right <= width && zoom.aligned, 'Zoom controls must stay together inside the viewport');
  run('screenshot', resolve(output, `${width}-toolbar.png`));
  if (width === 1518) {
    // Prove the test detects the exact former cascade, in this local fixture only.
    const broken = js(`(()=>{const style=document.createElement('style');style.id='previous-layout';style.textContent='.field-preplans-page{grid-template-columns:minmax(0,1fr)!important}.preplan-focus-map-panel{grid-column:auto}';document.head.append(style);const m=document.querySelector('.preplan-focus-map-panel').getBoundingClientRect(),e=document.querySelector('.preplan-editor').getBoundingClientRect();const result={mapLeft:m.left,mapRight:m.right,editorLeft:e.left,editorRight:e.right};style.remove();return result})()`);
    assert.ok(broken.mapLeft < broken.editorRight && broken.mapRight > broken.editorLeft, 'Regression fixture must recreate shared map/editor column');
    writeFileSync(resolve(output, 'before-regression.json'), JSON.stringify(broken, null, 2));
  }
  scrollTo('.field-map');
  capture('drawing', width);
  // Actual pointer input into the rendered map, not direct React-state edits.
  const map = js(`(()=>{const r=document.querySelector('.field-map').getBoundingClientRect();return {x:r.left+r.width/2,y:Math.max(150,Math.min(innerHeight-180,r.top+r.height/2))}})()`);
  for (const [dx,dy] of [[-42,-40],[42,-40],[42,40],[-42,40]]) {
    run('mouse', 'move', String(Math.round(map.x + dx)), String(Math.round(map.y + dy)));
    run('mouse', 'down'); run('mouse', 'up');
  }
  snapshot();
  assert.equal(js(`document.querySelectorAll('.corner-point').length`), 4);
  click('.capture-buttons button:nth-child(2)');
  assert.equal(js(`document.querySelectorAll('.corner-point').length`), 3);
  click('.accept-footprint');
  assert.ok(js(`!!document.querySelector('.draft-footprint.accepted')`));
  assert.ok(js(`document.querySelectorAll('.hydrant-map-pin,.hydrant-cluster').length>0`), 'Hydrants must return after acceptance');
  assert.equal(js(`!!document.querySelector('.preplan-capture-help')`), false);
  scrollTo('.preplan-editor'); capture('accepted', width);
  click('.preplan-quick-grid .preplan-next-button');
  assert.ok(js(`document.querySelector('.preplan-form').textContent.includes('Building information')`));
  run('fill', '.preplan-form > label input', 'Fictional edited name — not saved');
  click('.preplan-step-actions button:first-child');
  assert.equal(js(`document.querySelectorAll('.corner-point').length`), 3, 'Step navigation must preserve geometry');
  scrollTo('.field-map'); capture('returned-to-footprint', width);
  click('.capture-buttons button:nth-child(3)');
  assert.equal(js(`document.querySelectorAll('.corner-point').length`), 0);
  assert.equal(js(`document.querySelectorAll('.hydrant-map-pin,.hydrant-cluster').length`), 0);
  assert.ok(js(`document.querySelector('.preplan-next-button').disabled`));
  scrollTo('.preplan-editor'); capture('cleared', width);
  click('.preplan-focus-header button');
  run('wait', '.field-directory-tabs');
  console.log(`${width} returned to the preplan list`);
}
console.log(`Passed ${results.length} responsive/workflow states. No production access or saves.`);
