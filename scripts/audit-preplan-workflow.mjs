import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const cli=process.env.PORTAL_AUDIT_BROWSER;
if(!cli)throw Error('Set PORTAL_AUDIT_BROWSER to agent-browser.');
const output=resolve('outputs/preplan-workflow');mkdirSync(output,{recursive:true});
const run=(...args)=>{try{return execFileSync(cli,['--session','preplan-workflow',...args],{encoding:'utf8',timeout:45000}).trim();}catch(error){console.error('Failed browser command:',args.slice(0,5));throw error;}};
const js=expression=>{const value=JSON.parse(run('eval',`JSON.stringify(${expression})`));return typeof value==='string'?JSON.parse(value):value;};
const snapshot=()=>run('snapshot','-i');
const click=selector=>{js(`(()=>{document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'});return true})()`);run('click',selector);snapshot();};
const button=name=>{js(`(()=>{const target=[...document.querySelectorAll('button')].find(e=>(e.getAttribute('aria-label')||e.innerText).replace(/\\s+/g,' ').trim()===${JSON.stringify(name)});target?.scrollIntoView({block:'center',behavior:'instant'});return true})()`);run('find','role','button','click','--name',name,'--exact');snapshot();if(name==='Save photo changes')run('wait','--fn','!document.querySelector("dialog[open]") || !!document.querySelector("dialog[open] [role=alert]")');};
const fill=(label,value)=>{run('find','label',label,'fill',value,'--exact');snapshot();};
const base='http://127.0.0.1:4181/portal-audit.html?page=field-preplans&display=portal&preplan-workflow=1&preplan=fixture-preplan&edit=1';
const results=[];
function check(name){const result=js(`({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,errors:window.portalAudit.errors,overlay:!!document.querySelector('vite-error-overlay,[data-nextjs-dialog]'),dialog:document.querySelector('dialog[open]')?.getBoundingClientRect().toJSON(),dialogWidth:document.querySelector('dialog[open]')?.scrollWidth,writes:window.portalAudit.writes()})`);assert.deepEqual(result.errors,[]);assert.equal(result.overlay,false);assert.ok(result.scrollWidth<=result.width+1,`${name}: page overflow`);if(result.dialog){assert.ok(result.dialog.width<=result.width,`${name}: modal overflow`);assert.ok(result.dialogWidth<=result.dialog.width+1,`${name}: modal contents overflow`);assert.ok(result.dialog.bottom<=result.height+1);}results.push({name,...result});console.log(name+': passed');writeFileSync(resolve(output,'results.json'),JSON.stringify(results,null,2));}
try{
  run('open',base);run('wait','--fn','!!document.querySelector(".preplan-editor")');js('window.preplanAudit.reset()');run('reload');snapshot();
  run('set','viewport','1213','800');
  assert.equal(js('getComputedStyle(document.querySelector(".preplan-focus-map-panel")).display'),'none');
  fill('Business / building name','Fictional Training Building Edited');
  click('nav[aria-label="Preplan sections"] button:nth-child(3)');click('nav[aria-label="Preplan sections"] button:nth-child(1)');
  assert.equal(js('document.querySelector(".preplan-form input").value'),'Fictional Training Building Edited','tab changes keep building drafts');
  js('window.portalAudit.setFailWrite(true)');button('Save building changes');
  assert.ok(js('document.body.innerText.includes("Simulated failed building save")'));
  assert.equal(js('window.preplanAudit.plan().businessName'),'Fictional Training Building');check('failed building save preserves draft');
  button('Save building changes');assert.equal(js('window.preplanAudit.plan().businessName'),'Fictional Training Building Edited');
  click('.record-focus-view-button');assert.ok(js('!!document.querySelector(".preplan-record-view")'));button('Edit Preplan');
  assert.equal(js('document.querySelector(".preplan-form input").value'),'Fictional Training Building Edited');check('save preview and edit round trip');
  click('nav[aria-label="Preplan sections"] button:nth-child(3)');click('.preplan-exterior-gallery button');
  fill('Find a symbol','gas');button('Gas shutoff Utilities');button('Place in center (then move)');
  fill('Label (optional)','Photo note only');run('select','.photo-selected-controls select','90');
  click('.photo-illustration-stage .photo-mark');run('press','ArrowRight');snapshot();
  const x=js('parseFloat(document.querySelector(".photo-mark.selected").style.left)');assert.equal(x,51);
  button('Undo');button('Redo');assert.equal(js('parseFloat(document.querySelector(".photo-mark").style.left)'),51);
  assert.equal(js('window.preplanAudit.plan().photos[0].illustrations.length'),0,'placing does not save');
  fill('Photo caption','Saved fictional annotation');js('window.portalAudit.setFailWrite(true)');button('Save photo changes');
  assert.ok(js('document.querySelector("dialog[open]").innerText.includes("Simulated failed save")'));assert.equal(js('document.querySelectorAll("dialog[open] .photo-mark").length'),1);check('photo edit failure keeps symbols');
  button('Save photo changes');assert.equal(js('window.preplanAudit.plan().photos[0].illustrations.length'),1);assert.equal(js('window.preplanAudit.plan().features.length'),0,'no operational record created');
  run('reload');snapshot();click('nav[aria-label="Preplan sections"] button:nth-child(3)');assert.equal(js('document.querySelectorAll(".preplan-exterior-gallery .photo-mark").length'),1);check('saved symbols survive reload');
  click('.preplan-exterior-gallery button');fill('Photo caption','Must not overwrite');js('window.preplanAudit.conflict()');button('Save photo changes');assert.ok(js('document.querySelector("dialog[open]").innerText.includes("changed on another screen")'));assert.equal(js('window.preplanAudit.plan().photos[0].caption'),'Saved fictional annotation');check('concurrent change is rejected');
  // Deliberate confirm handling in this fictional browser, not production.
  js('(()=>{window.confirm=()=>true;return true})()');button('Cancel / close');
  for(const [width,height] of [[1213,800],[1024,768],[768,1024],[390,844],[370,666],[844,390]]){
    run('set','viewport',String(width),String(height));snapshot();
    click('.preplan-exterior-gallery button');check(`photo editor ${width}x${height}`);run('screenshot',resolve(output,`photo-${width}x${height}.png`));button('Cancel / close');
    click('nav[aria-label="Preplan sections"] button:nth-child(1)');assert.equal(js('getComputedStyle(document.querySelector(".preplan-focus-map-panel")).display'),'none');check(`building form ${width}x${height}`);
    click('nav[aria-label="Preplan sections"] button:nth-child(2)');assert.notEqual(js('getComputedStyle(document.querySelector(".preplan-focus-map-panel")).display'),'none');check(`equipment map ${width}x${height}`);
    click('nav[aria-label="Preplan sections"] button:nth-child(4)');check(`advanced tools ${width}x${height}`);
    click('nav[aria-label="Preplan sections"] button:nth-child(3)');
  }
  for(const index of [2,3,4]){click(`.preplan-photo-tabs button:nth-child(${index})`);click('.preplan-exterior-gallery button');fill('Find a symbol','arrow');button('Direction arrow Drawing');button('Place in center (then move)');button('Save photo changes');}
  assert.ok(js('window.preplanAudit.plan().photos.every(photo=>photo.illustrations.length===1)'));check('all four sides save independently');
  click('.preplan-photo-tabs button:nth-child(1)');click('.preplan-exterior-gallery button');click('dialog[open] .photo-mark');button('Remove selected symbol');button('Save photo changes');assert.equal(js('window.preplanAudit.plan().photos[0].illustrations.length'),0);assert.ok(js('window.preplanAudit.plan().photos[0].url.startsWith("data:image/svg+xml")'));check('remove symbols preserves original');
  run('open',base+'&no-photo-edit=1');snapshot();click('nav[aria-label="Preplan sections"] button:nth-child(3)');assert.equal(js('document.querySelectorAll(".preplan-exterior-gallery button").length'),0);check('photo tools hidden without permission');
  console.log(`${results.length} browser checks passed. Fictional records only.`);
}catch(error){try{run('screenshot',resolve(output,'failure.png'));console.error(js('({text:document.querySelector("dialog[open]")?.innerText,errors:window.portalAudit.errors,writes:window.portalAudit.writes()})'));}catch{}throw error;
}finally{try{js('(()=>{window.onbeforeunload=null;return true})()');run('close');}catch(error){console.error('Browser cleanup needs attention:',error.message);}}
