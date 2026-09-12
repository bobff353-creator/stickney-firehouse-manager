import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const cli = process.env.PORTAL_AUDIT_BROWSER;
if (!cli) throw Error('Set PORTAL_AUDIT_BROWSER to the agent-browser executable.');
const output = resolve('outputs/preplan-overview');
mkdirSync(output, {recursive:true});
const run = (...args) => execFileSync(cli, ['--session', 'preplan-overview', ...args], {encoding:'utf8', timeout:55000}).trim();
const js = expression => {
  const value = JSON.parse(run('eval', `JSON.stringify(${expression})`));
  return typeof value === 'string' ? JSON.parse(value) : value;
};
const snapshot = () => run('snapshot', '-i');
const click = selector => {
  js(`(()=>{document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'});return true})()`);
  run('click', selector); snapshot();
};
const base = 'http://127.0.0.1:4181/portal-audit.html?page=field-preplans&display=portal&preplan-capture=1&preplan-location-audit=1&gps=denied&preplan-large-directory=1';
const results = [];
function check(name, {count=218, zoom=14, expanded=false}={}) {
  const result = js(`(()=>{
    const map=document.querySelector('.field-map'), list=document.querySelector('.field-map-layout > aside');
    const tile=map.querySelector('.field-map-tiles img');
    const [z,y,x]=new URL(tile.src).pathname.split('/').slice(-3).map(Number), scale=256*2**z;
    const rect=map.getBoundingClientRect(), wx=x*256+(.5-parseFloat(tile.style.left)/100)*rect.width, wy=y*256+(.5-parseFloat(tile.style.top)/100)*rect.height;
    return {zoom:z,center:{lng:wx/scale*360-180,lat:Math.atan(Math.sinh(Math.PI*(1-2*wy/scale)))*180/Math.PI},
      map:rect.toJSON(),list:list.getBoundingClientRect().toJSON(),listScroll:list.scrollHeight,listHeight:list.clientHeight,
      overflow:getComputedStyle(list).overflowY,count:list.querySelectorAll('button').length,
      expanded:!!document.querySelector('.field-map-workspace.expanded'),width:innerWidth,height:innerHeight,
      scrollWidth:document.documentElement.scrollWidth,pageHeight:document.documentElement.scrollHeight,
      errors:window.portalAudit.errors,writes:window.portalAudit.writes(),overlay:!!document.querySelector('vite-error-overlay,[data-nextjs-dialog]')};
  })()`);
  assert.equal(result.count, count, name);
  assert.equal(result.zoom, zoom, name);
  assert.ok(Math.abs(result.center.lat-41.8189)<.00002 && Math.abs(result.center.lng+87.7734)<.00002, `${name}: center changed`);
  assert.ok(result.map.height>=200 && result.map.height<=Math.max(680,result.height), `${name}: unbounded map ${result.map.height}`);
  assert.ok(result.list.height<=Math.max(680,result.height), `${name}: unbounded record list`);
  assert.equal(result.overflow, 'auto', name);
  if(count===218) assert.ok(result.listScroll>result.listHeight*5, `${name}: records must scroll independently`);
  assert.equal(result.expanded, expanded, name);
  assert.ok(result.scrollWidth<=result.width+1, `${name}: horizontal overflow`);
  if(expanded) assert.ok(result.list.bottom<=result.height+1 && result.map.bottom<=result.height+1, `${name}: expanded panes leave viewport`);
  assert.deepEqual(result.errors, [], name);
  assert.equal(result.overlay, false, name);
  assert.equal(result.writes, 0, 'Map navigation must not save records');
  results.push({name,...result});
  writeFileSync(resolve(output,'results.json'), JSON.stringify(results,null,2));
  console.log(`${name}: passed (map ${Math.round(result.map.height)}px, ${result.count} records, no writes)`);
  return result;
}
try {
  for(const [width,height] of [[1518,666],[1213,666],[1100,800],[1024,768],[768,1024],[390,666],[666,390]]) {
    run('set','viewport',String(width),String(height));
    run('open',base);run('wait','.field-map-layout > aside > button');snapshot();
    check(`${width}-overview`);
    click('.field-map-toolbar button[aria-label="Zoom in"]');
    check(`${width}-zoom-in`,{zoom:15});
    click('.field-map-toolbar button[aria-label="Zoom out"]');
    check(`${width}-zoom-out`);
    // Last item stays reachable without stretching the map or page.
    js(`(()=>{document.querySelector('.field-map-layout > aside > button:last-child').scrollIntoView({block:'center',behavior:'instant'});return true})()`);
    const scroll=js(`(()=>{const list=document.querySelector('.field-map-layout > aside'),r=list.getBoundingClientRect(),last=list.querySelector('button:last-child').getBoundingClientRect();return {scrollTop:list.scrollTop,lastTop:last.top,lastBottom:last.bottom,top:r.top,bottom:r.bottom}})()`);
    assert.ok(scroll.scrollTop>0 && scroll.lastTop>=scroll.top && scroll.lastBottom<=scroll.bottom+1, 'Last record must be visible inside its list');
    check(`${width}-last-record-scroll`);
    click('.field-map-expand-button');
    check(`${width}-expanded`,{expanded:true});
    run('screenshot',resolve(output,`${width}-expanded.png`));
    run('press','Escape');snapshot();check(`${width}-collapsed`);
    run('fill','input[aria-label="Search all preplans and hydrants"]','PREVIEW 218');snapshot();
    check(`${width}-search-last-record`,{count:1});
    run('fill','input[aria-label="Search all preplans and hydrants"]','no-such-record');snapshot();
    check(`${width}-empty-search`,{count:0});
    click('input[aria-label="Search all preplans and hydrants"]');
    run('press','Control+a');run('press','Backspace');snapshot();
    check(`${width}-search-cleared`);
    js(`(()=>{document.querySelector('.field-map').scrollIntoView({block:'center',behavior:'instant'});return true})()`);
    run('screenshot',resolve(output,`${width}-overview.png`));
  }
  // Resize one already-mounted map across breakpoints, as rotation does.
  for(const [width,height] of [[390,666],[1024,768],[1518,666]]) {
    run('set','viewport',String(width),String(height));snapshot();check(`${width}-mounted-resize`);
  }
  console.log(`Passed ${results.length} overview checks. Fictional fixtures; third-party imagery blocked; no production writes.`);
} finally {run('close');}
