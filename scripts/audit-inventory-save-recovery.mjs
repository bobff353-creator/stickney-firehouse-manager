// Actual React UI with isolated fictional responses. No production inspection writes.
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,openSync,closeSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const cli=process.env.INVENTORY_AUDIT_BROWSER;
if(!cli)throw Error('Set INVENTORY_AUDIT_BROWSER to the installed agent-browser entrypoint.');
const out=resolve('outputs/inventory-save-recovery');mkdirSync(out,{recursive:true});
// Native browser daemons can inherit Windows capture pipes. Files let the
// command finish independently of the long-lived browser process.
let command=0;
const run=(...args)=>{
 const output=resolve(out,`command-${++command}.txt`),errorOutput=resolve(out,`command-${command}-error.txt`),fd=openSync(output,'w'),errorFd=openSync(errorOutput,'w');
 try{execFileSync(cli,['--session','inventory-save-recovery',...args],{timeout:60000,windowsHide:true,stdio:['ignore',fd,errorFd]});}
 catch(error){console.error(readFileSync(errorOutput,'utf8'));throw error;}
 finally{closeSync(fd);closeSync(errorFd);}
 return readFileSync(output,'utf8').trim();
};
const evaluate=code=>{let result=JSON.parse(run('eval',`JSON.stringify(${code})`));return typeof result==='string'?JSON.parse(result):result;};
const check=(code,message)=>{if(!evaluate(code))throw Error(message);};
const click=selector=>{
 evaluate(`(document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'}),true)`);
 const geometry=evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {x:r.x,y:r.y,w:r.width,h:r.height,hit:hit?.outerHTML,valid:e===hit||e.contains(hit)}})()`);
 writeFileSync(resolve(out,'last-click.json'),JSON.stringify(geometry,null,2));
 run('screenshot',resolve(out,'last-click.png'));
 if(!geometry.valid)throw Error('Control is overlapped: '+JSON.stringify(geometry));
 run('click',selector);
};
const results=[];
function capture(name,width){
 const result=evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth,errors:document.querySelector('#audit-errors').textContent,overlay:!!document.querySelector('vite-error-overlay,[data-nextjs-dialog]'),layoutIssues:[...document.querySelectorAll('.check-row')].flatMap(row=>{const buttons=[...row.querySelectorAll('button')],issues=[];if(getComputedStyle(row).display!=='grid')issues.push('Not a grid');buttons.forEach((b,i)=>{const r=b.getBoundingClientRect();if(b.scrollWidth>b.clientWidth+1)issues.push('Clipped '+b.textContent);for(const other of buttons.slice(i+1)){const s=other.getBoundingClientRect();if(Math.min(r.right,s.right)>Math.max(r.left,s.left)+1&&Math.min(r.bottom,s.bottom)>Math.max(r.top,s.top)+1)issues.push('Overlapping buttons');}});return issues;})})`);
 if(result.overflow||result.errors||result.overlay||result.layoutIssues.length)throw Error(`${name}: ${JSON.stringify(result)}`);
 run('screenshot',resolve(out,`${width}-${name}.png`));results.push({name,width,...result});console.log(`${width} ${name}: PASS`);
}
try{for(const width of [360,768,1213]){
 run('set','viewport',String(width),width===768?'1024':'844');
 run('open','http://127.0.0.1:4181/inventory-audit-app.html?role=member&check=1');run('wait','.check-actions .pass');
 run('snapshot','-i');
 capture('initial-check',width);
 check(`![...document.querySelectorAll('button')].some(e=>e.textContent.includes('Pass remaining'))`,'Daily check exposes unsupported bulk action');
 run('check','#fail-save');click('.check-actions .pass');run('wait','.check-save-feedback[role="alert"]');
 check(`window.inventoryAudit.data.checkItems.every(e=>e.result==='pending')`,'Failed save changed records');
 capture('failed-pass',width);
 evaluate(`(window.inventoryAudit.emptySave=true,true)`);click('.check-actions .pass');
 check(`document.querySelector('.check-save-feedback').textContent.includes('did not confirm')`,'Empty acknowledgement shown as saved');
 click('.check-actions .pass');
 check(`window.inventoryAudit.data.checkItems.find(e=>e.equipment_id==='fixture-radio').result==='pass'&&!document.querySelector('.check-actions .pass')`,'Pass did not update Pending list');
 run('fill','.numeric-reading-entry input','1234');click('.numeric-reading-entry button');
 check(`window.inventoryAudit.data.checkItems.every(e=>e.result==='pass')`,'Numeric reading not saved');capture('saved-results',width);
 evaluate(`(window.inventoryAudit.permissionMode='timeout',window.dispatchEvent(new Event('firehouse:permissions-changed')),true)`);
 run('wait','.inventory-access-card');
 check(`document.querySelector('.inventory-access-card').textContent.includes('access check took too long')&&!document.body.textContent.includes('signal timed out')&&!document.querySelector('.check-actions')`,'Timeout is raw or protected checklist remains exposed');
 capture('access-timeout',width);
 // Keep the failure active until the actual click; otherwise the background
 // permission poll can correctly recover and remove this button first.
 evaluate(`(()=>{document.querySelector('.inventory-access-actions button').addEventListener('click',()=>{window.inventoryAudit.permissionMode='ok';},{capture:true,once:true});return true})()`);click('.inventory-access-actions button');run('wait','.check-progress-summary');
 check(`document.querySelector('.check-progress-summary').textContent.includes('2 of 2 completed')`,'Retry lost saved results');capture('recovered',width);
 evaluate(`(window.inventoryAudit.permissionMode='denied',window.dispatchEvent(new Event('firehouse:permissions-changed')),true)`);run('wait','.inventory-access-card');
 check(`!document.querySelector('.check-actions')&&document.body.textContent.includes('access was removed')`,'Revoked access not enforced');capture('access-denied',width);
}}
finally{writeFileSync(resolve(out,'results.json'),JSON.stringify(results,null,2));run('close');}
console.log(`${results.length} render/flow states passed. Simulated browser API; database invoker tests run separately.`);
