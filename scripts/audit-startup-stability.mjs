// Real client components with fictional local responses; never production writes.
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,openSync,closeSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const cli=process.env.PORTAL_AUDIT_BROWSER;
if(!cli)throw Error('Set PORTAL_AUDIT_BROWSER to the installed agent-browser binary.');
const out=resolve('outputs/startup-stability');mkdirSync(out,{recursive:true});
let command=0;const results=[];
const session=process.env.PORTAL_AUDIT_SESSION||`startup-${Date.now()}`;
function run(...args){const p=resolve(out,`browser-${++command}.txt`),fd=openSync(p,'w');try{execFileSync(cli,['--session',session,...args],{timeout:60000,windowsHide:true,stdio:['ignore',fd,fd]});}finally{closeSync(fd);}return readFileSync(p,'utf8').trim();}
function evaluate(code){let r=JSON.parse(run('eval',`JSON.stringify(${code})`));return typeof r==='string'?JSON.parse(r):r;}
function check(code,message){if(!evaluate(code))throw Error(message);}
function capture(name,width){const r=evaluate(`({overflow:document.documentElement.scrollWidth>innerWidth,errors:window.portalAudit?.errors||window.inventoryAudit?.errors||[],overlay:!!document.querySelector('vite-error-overlay,[data-nextjs-dialog]')})`);if(r.overflow||r.errors.length||r.overlay)throw Error(name+': '+JSON.stringify(r));run('screenshot',resolve(out,`${width}-${name}.png`));results.push({name,width,...r});console.log(`${width} ${name}: PASS`);}
try {
 for(const width of [390,768,1280]){
  run('set','viewport',String(width),width===768?'1024':'844');
  for(const [page,selector] of [['field-preplans','.field-preplans-page'],['scheduling','.scheduler'],['permissions','.permission-settings']]){
   run('open',`http://127.0.0.1:4181/portal-audit.html?page=${page}&display=portal&seven-ux=1&payroll-unavailable=1`);
   // Permission settings have no dedicated root class in older builds.
   run('wait',page==='permissions'?'#portal-workspace fieldset':selector);
   run('snapshot','-i');
   check(`!window.portalAudit.requests.some(r=>r.includes('/api/payroll'))`,'Independent page fetched payroll: '+page);
   check(`!document.body.innerText.includes('Fictional payroll outage')`,'Payroll failure blocked independent page');
   capture(page+'-without-payroll',width);
  }
  run('open','http://127.0.0.1:4181/portal-audit.html?page=payroll&display=portal');run('wait','.period-row');
  check(`window.portalAudit.requests.some(r=>r.includes('/api/payroll'))`,'Payroll page did not fetch its data');capture('payroll-still-loads',width);
  run('open','http://127.0.0.1:4181/inventory-audit-app.html?role=member&check=1');run('wait','.check-actions .pass');run('snapshot','-i');
  check(`!window.inventoryAudit.requests.some(r=>r.startsWith('/api/digital-twin'))`,'Checklist requested the digital-twin catalog');
  capture('inventory-deferred-catalog',width);
  results.at(-1).requests=evaluate(`window.inventoryAudit.requests`);
  const initial=evaluate(`(()=>{const r=window.inventoryAudit.requestTimes,t=r.find(e=>e.url==='/api/operations').at;return r.filter(e=>e.at<t+1000).map(e=>e.url)})()`);
  if(initial.filter(url=>url==='/api/operations').length!==1)throw Error('Duplicate Inventory startup read');results.at(-1).firstSecondRequests=initial;
  if(width===1280){
   evaluate(`(window.inventoryAudit.holdReads=true,window.inventoryAudit.maxReads=0,window.dispatchEvent(new Event('focus')),window.dispatchEvent(new Event('focus')),window.dispatchEvent(new Event('online')),true)`);
   check(`window.inventoryAudit.activeReads===1&&window.inventoryAudit.maxReads===1`,'Overlapping Inventory refresh requests');
   evaluate(`(window.inventoryAudit.holdReads=false,window.inventoryAudit.releaseReads(),true)`);
   capture('inventory-overlap-protection',width);
  }
 }
} finally {writeFileSync(resolve(out,'browser-results.json'),JSON.stringify(results,null,2));try{run('close');}catch{console.warn('Browser assertions complete; automation session close timed out.');}}
console.log(`${results.length} local rendering/request states passed.`);
