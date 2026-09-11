// Isolated responsive audit of the actual components. Requires the local fixture server.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const cli=process.env.INVENTORY_AUDIT_BROWSER;
if(!cli) throw Error('Set INVENTORY_AUDIT_BROWSER to the installed agent-browser CLI path.');
const output=resolve(`outputs/inventory-audit${process.env.INVENTORY_AUDIT_SUFFIX||''}`);mkdirSync(output,{recursive:true});
const run=(...args)=>execFileSync(process.execPath,[cli,'--session','inventory-audit',...args],{encoding:'utf8',timeout:30000}).trim();
const evaluate=js=>run('eval',js);
const clickText=text=>evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.getClientRects().length&&b.textContent.trim()===${JSON.stringify(text)});if(!b)throw Error('Missing button: '+${JSON.stringify(text)});b.click();return true})()`);
const navigate=(view,width)=>width<=980?run('select','.inventory-mobile-destination select',view):clickText(({due:'Due Now',fleet:'Checks',inventory:'Inventory',equipment:'Equipment',reports:'Reports',service:'Repairs',stock:'Meds & Stock',setup:'Build & templates'})[view]);
const results=[];
function capture(name,width,role,selector='.inventory-ops',shot=false){
 evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'start',behavior:'instant'})`);
 const measured=JSON.parse(evaluate(`JSON.stringify({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,errors:document.querySelector('#audit-errors').textContent, writes:document.querySelector('#audit-writes').textContent, overflow:[...document.querySelectorAll('.inventory-app-shell input,.inventory-app-shell select,.inventory-app-shell textarea,.inventory-app-shell button,.inventory-app-shell h2')].filter(e=>{const r=e.getBoundingClientRect();return e.getClientRects().length&&(r.left < -1 || r.right > innerWidth+1)}).map(e=>({tag:e.tagName,text:(e.textContent||e.getAttribute('name')||'').slice(0,90),right:Math.round(e.getBoundingClientRect().right)}))})`));
 // agent-browser emits evaluated strings as JSON strings.
 const result=typeof measured==='string'?JSON.parse(measured):measured;
 results.push({name,width,role,...result});
 writeFileSync(resolve(output,'results.json'),JSON.stringify(results,null,2));
 if(shot)run('screenshot',resolve(output,`${role}-${width}-${name}.png`));
 console.log(`${role} ${width} ${name}: ${result.scrollWidth}px; ${result.overflow.length} overflowing controls; ${result.errors||'no errors'}`);
}
for(const width of (process.env.INVENTORY_AUDIT_WIDTHS||'360,390,768,1024,1180').split(',').map(Number)){
 run('set','viewport',String(width),width>=768?'1024':'844');
 for(const role of ['member','admin']){
  run('open',`http://127.0.0.1:4179/inventory-audit-app.html?role=${role}`);
  run('wait','.inventory-find-unit');
  capture('home',width,role,'.inventory-command-header',true);
  for(const view of ['inventory','equipment','reports','service','stock','fleet']){
   navigate(view,width);run('wait','.inventory-app-shell');
   capture(view,width,role,view==='fleet'?'.fleet-grid':'.inventory-ops',width===390||width===768);
   if(view==='equipment'){
    run('fill','.equipment-search-tools input','radio');
    capture('equipment-search',width,role,'.equipment-search-tools');
    run('click','.equipment-record-button');
    capture('equipment-detail',width,role,'.equipment-record-summary',width===390||width===768);
   }
  }
  if(role==='admin'){
   navigate('setup',width);run('wait','.inventory-builder-toolbar');
   capture('builder',width,role,'.inventory-builder-toolbar',true);
   for(const task of ['Add an item','Due dates & times','Air pack template','Location requests (0)','Member preview']){
    clickText(task);
    const name=task.toLowerCase().replace(/[^a-z]+/g,'-');
    capture(name,width,role,task==='Member preview'?'.inventory-member-preview':'.inventory-ops .ops-card:not([hidden]):not(.inventory-builder-toolbar)',width===390||width===768);
   }
   const previewPosts=evaluate(`document.querySelector('#audit-writes').textContent`);
   if(!previewPosts.includes('Test writes: 0'))throw Error('Read-only navigation unexpectedly wrote data');
   clickText('Edit checklist');run('fill','.callback-search input','radio');evaluate(`document.querySelector('.equipment-grid button').scrollIntoView({block:'center',behavior:'instant'})`);run('click','.equipment-grid button');
   for(const [section,text] of [['basics','1 · Item & location'],['checks','2 · Check requirements'],['asset','3 · Asset details']]){
    clickText(text);capture(`editor-${section}`,width,role,'.equipment-editor',true);
   }
   clickText('Cancel');
  }
 }
}
writeFileSync(resolve(output,'results.json'),JSON.stringify(results,null,2));
const failed=results.filter(r=>r.scrollWidth>r.width||r.overflow.length||r.errors);
console.log(JSON.stringify({states:results.length,failed:failed.map(r=>({name:r.name,width:r.width,role:r.role,overflow:r.overflow}))},null,2));
if(failed.length) process.exitCode=1;
