// Existing fictional portal fixture; never enters or changes a production record.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,openSync,closeSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const cli=process.env.PORTAL_AUDIT_BROWSER;
if(!cli)throw Error('Set PORTAL_AUDIT_BROWSER to the native agent-browser executable.');
const output=resolve('outputs/hydrant-markers');mkdirSync(output,{recursive:true});
let command=0;
function run(...args){
  const file=resolve(output,`command-${++command}.txt`),errors=resolve(output,`command-${command}-error.txt`);
  const fd=openSync(file,'w'),ef=openSync(errors,'w');
  // File handles avoid the Windows daemon inheriting the command's output pipe.
  try{execFileSync(cli,['--session','hydrant-markers',...args],{timeout:30000,windowsHide:true,stdio:['ignore',fd,ef]});}
  catch(error){console.error(readFileSync(errors,'utf8'));throw error;}
  finally{closeSync(fd);closeSync(ef);}
  return readFileSync(file,'utf8').trim();
}
const js=code=>{const result=JSON.parse(run('eval',`JSON.stringify(${code})`));return typeof result==='string'?JSON.parse(result):result;};
const base='http://127.0.0.1:4181/portal-audit.html?page=field-preplans&display=portal&preplan-capture=1&preplan-location-audit=1&gps=denied';
const results=[];
function state(){return js(`({pins:document.querySelectorAll('.hydrant-map-pin').length,clusters:[...document.querySelectorAll('.hydrant-cluster')].map(el=>el.textContent),errors:window.portalAudit.errors,writes:window.portalAudit.writes(),width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overlay:!!document.querySelector('vite-error-overlay,[data-nextjs-dialog]')})`);}
try{
  for(const [width,height] of [[390,844],[768,1024],[1213,666]]){
    run('set','viewport',String(width),String(height));run('open',base);run('wait','.hydrant-map-pin');run('snapshot','-i');
    const initial=state();assert.equal(initial.pins,1);assert.deepEqual(initial.clusters,[]);assert.deepEqual(initial.errors,[]);assert.equal(initial.overlay,false);assert.ok(initial.scrollWidth<=width+1);assert.equal(initial.writes,0);
    run('find','role','button','click','--name','Zoom in');run('snapshot','-i');
    run('find','role','button','click','--name','Zoom in');run('snapshot','-i');
    const zoomed=state();assert.equal(zoomed.pins,1);assert.deepEqual(zoomed.clusters,[]);
    js(`(()=>{document.querySelector('.hydrant-map-pin').scrollIntoView({block:'center',behavior:'instant'});return true;})()`);run('screenshot',resolve(output,`${width}-single.png`));
    run('click','.hydrant-map-pin');run('snapshot','-i');
    assert.equal(js(`new URL(location.href).searchParams.get('hydrant')`),'fixture-hydrant');
    assert.equal(state().writes,0);results.push({width,height,single:initial,recordOpened:true});
    run('open',base+'&preplan-large-directory=1&records=2');run('wait','.hydrant-cluster');run('snapshot','-i');
    const grouped=state();assert.deepEqual(grouped.clusters,['×2']);assert.equal(grouped.pins,0);assert.deepEqual(grouped.errors,[]);assert.equal(grouped.writes,0);
    const before=js(`document.querySelector('.field-map-toolbar').innerText`);
    run('click','.hydrant-cluster');run('snapshot','-i');
    assert.notEqual(js(`document.querySelector('.field-map-toolbar').innerText`),before);
    assert.equal(js(`new URL(location.href).searchParams.has('hydrant')`),false);assert.equal(state().writes,0);
    results.push({width,height,group:grouped,zoomedWithoutOpeningRecord:true});
  }
  writeFileSync(resolve(output,'results.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify({passed:true,states:results.length,recordWrites:0}));
}catch(error){run('screenshot','--full',resolve(output,'failure.png'));console.error(run('snapshot','-i'));throw error;}
finally{run('close');}
