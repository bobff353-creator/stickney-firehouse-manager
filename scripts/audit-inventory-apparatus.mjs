import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const cli=process.env.INVENTORY_AUDIT_BROWSER;if(!cli)throw Error('Set INVENTORY_AUDIT_BROWSER.');
const output=resolve('outputs/inventory-apparatus');mkdirSync(output,{recursive:true});
const run=(...args)=>execFileSync(process.execPath,[cli,'--session','inventory-flows',...args],{encoding:'utf8',timeout:30000}).trim();
const rows=[];
for(const width of [360,390,768,1024,1180]){
 run('set','viewport',String(width),width<768?'844':'1024');
 for(let index=0;index<4;index++){
  run('eval',`document.querySelector('.builder-section-nav').scrollIntoView({block:'center',behavior:'instant'})`);
  run('click',`.builder-section-nav button:nth-child(${index+1})`);
  run('eval',`document.querySelector('.builder-section-nav').scrollIntoView({block:'start',behavior:'instant'})`);
  const raw=JSON.parse(run('eval',`JSON.stringify({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,errors:document.querySelector('#audit-errors').textContent,overflow:[...document.querySelectorAll('.setup-workspace-panel:not([hidden]) input,.setup-workspace-panel:not([hidden]) select,.setup-workspace-panel:not([hidden]) button')].filter(e=>{const r=e.getBoundingClientRect();return e.getClientRects().length&&(r.right>innerWidth+1||r.left< -1)}).map(e=>({text:(e.textContent||e.getAttribute('name')||e.tagName).slice(0,70),right:Math.round(e.getBoundingClientRect().right)}))})`));
  const measured=typeof raw==='string'?JSON.parse(raw):raw;rows.push({step:index+1,...measured});
  run('screenshot',resolve(output,`${width}-step-${index+1}.png`));
  writeFileSync(resolve(output,'results.json'),JSON.stringify(rows,null,2));console.log({width,step:index+1,overflow:measured.overflow});
 }
}
if(rows.some(r=>r.errors||r.scrollWidth>r.width||r.overflow.length))process.exitCode=1;
