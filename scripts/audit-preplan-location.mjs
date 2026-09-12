import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const cli=process.env.PORTAL_AUDIT_BROWSER;
if(!cli)throw Error('Set PORTAL_AUDIT_BROWSER to the agent-browser executable.');
const output=resolve('outputs/preplan-location');mkdirSync(output,{recursive:true});
const run=(...args)=>execFileSync(cli,['--session','preplan-location',...args],{encoding:'utf8',timeout:55000}).trim();
const js=expression=>{const value=JSON.parse(run('eval',`JSON.stringify(${expression})`));return typeof value==='string'?JSON.parse(value):value;};
const snapshot=()=>run('snapshot','-i');
const click=selector=>{js(`(()=>{document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'});return true})()`);run('click',selector);snapshot();};
const base='http://127.0.0.1:4181/portal-audit.html?page=field-preplans&display=portal&preplan-capture=1&preplan-location-audit=1';
const results=[];
function check(name,expectedZoom,expected={lat:41.8189,lng:-87.7734}) {
  const result=js(`(()=>{
    const map=document.querySelector('.field-map'),tile=map.querySelector('.field-map-tiles img');
    const [z,y,x]=new URL(tile.src).pathname.split('/').slice(-3).map(Number),scale=256*2**z;
    const rect=map.getBoundingClientRect(),wx=x*256+(.5-parseFloat(tile.style.left)/100)*rect.width,wy=y*256+(.5-parseFloat(tile.style.top)/100)*rect.height;
    return {zoom:z,center:{lng:wx/scale*360-180,lat:Math.atan(Math.sinh(Math.PI*(1-2*wy/scale)))*180/Math.PI},width:innerWidth,scrollWidth:document.documentElement.scrollWidth,errors:window.portalAudit.errors,writes:window.portalAudit.writes(),corners:document.querySelectorAll('.corner-point').length,overlay:!!document.querySelector('vite-error-overlay,[data-nextjs-dialog]')};
  })()`);
  assert.equal(result.zoom,expectedZoom,name);
  assert.ok(Math.abs(result.center.lat-expected.lat)<.00002&&Math.abs(result.center.lng-expected.lng)<.00002,`${name}: actual map center ${JSON.stringify(result.center)}`);
  assert.deepEqual(result.errors,[],name);assert.equal(result.overlay,false,name);
  assert.equal(result.writes,0,'Map changes must not save records');
  assert.ok(result.scrollWidth<=result.width+1,`${name}: horizontal overflow`);
  results.push({name,...result});writeFileSync(resolve(output,'results.json'),JSON.stringify(results,null,2));
  console.log(`${name}: passed (zoom ${result.zoom}, no writes)`);return result;
}
function imports() {click('.field-directory-tabs button:nth-child(2)');js(`(()=>{document.querySelectorAll('.imported-street-groups details').forEach(e=>{if(!e.open)e.querySelector('summary').click()});return true})()`);snapshot();}
function choose(label) {js(`(()=>{[...document.querySelectorAll('.imported-street-groups button')].find(e=>e.textContent.trim()===${JSON.stringify(label)}).scrollIntoView({block:'center',behavior:'instant'});return true})()`);run('find','role','button','click','--name',label);snapshot();run('wait','.preplan-map-zoom');}
try {
  for(const [width,gps] of [[1518,'denied'],[768,'missing'],[390,'timeout']]) {
    run('set','viewport',String(width),width===768?'1024':'666');
    run('open',`${base}&gps=${gps}`);run('wait','.field-directory-tabs');snapshot();
    check(`${width}-initial-${gps}`,14);
    imports();choose('Verify & Build');check(`${width}-located-address`,20,{lat:41.825,lng:-87.78});
    click('.preplan-focus-header button');imports();choose('Locate & Build');
    check(`${width}-unlocated-address`,14);
    js(`(()=>{document.querySelector('.preplan-focus-map-panel').scrollIntoView({block:'start',behavior:'instant'});return true})()`);
    run('screenshot',resolve(output,`${width}-overview.png`));
    // Real pointer drawing, followed by failed device lookup. Geometry must survive.
    js(`(()=>{document.querySelector('.field-map').scrollIntoView({block:'center',behavior:'instant'});return true})()`);
    const point=js(`(()=>{const r=document.querySelector('.field-map').getBoundingClientRect();return {x:r.left+r.width/2,y:Math.max(170,Math.min(innerHeight-150,r.top+r.height/2))}})()`);
    for(const [dx,dy] of [[-30,-30],[30,-30],[30,30],[-30,30]]) {run('mouse','move',String(Math.round(point.x+dx)),String(Math.round(point.y+dy)));run('mouse','down');run('mouse','up');}
    snapshot();assert.equal(js(`document.querySelectorAll('.corner-point').length`),4);
    click('.preplan-map-zoom button:last-child');
    click('.preplan-focus-map-panel .field-map-toolbar > button:first-child');
    assert.equal(check(`${width}-lookup-failure-retains-draft`,14).corners,4);
    click('.preplan-focus-header button');
    run('find','role','button','click','--name','+ New Preplan');snapshot();
    check(`${width}-new-without-location`,14);
  }
  run('open',`${base}&gps=success`);run('wait','.field-directory-tabs');snapshot();
  check('valid-device-location',17,{lat:41.825,lng:-87.78});
  run('open',`${base}&gps=pending`);run('wait','.field-directory-tabs');snapshot();
  imports();choose('Locate & Build');
  js(`(()=>{window.finishFixtureLocation();return true})()`);snapshot();
  check('late-device-response-does-not-move-draft',14);
  console.log(`Passed ${results.length} map-location scenarios. Fictional data only; no production requests or saves.`);
} finally {run('close');}
