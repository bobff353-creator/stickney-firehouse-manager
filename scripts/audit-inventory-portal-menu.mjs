// Real Inventory React components; fictional, in-browser API only. No production writes.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync, writeFileSync, openSync, closeSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const cli=process.env.INVENTORY_AUDIT_BROWSER;
if(!cli)throw Error('Set INVENTORY_AUDIT_BROWSER to the installed native agent-browser executable.');
const out=resolve('outputs/inventory-portal-menu');mkdirSync(out,{recursive:true});
let command=0;
function run(...args){
  const stdout=resolve(out,`command-${++command}.txt`),stderr=resolve(out,`command-${command}-error.txt`);
  const fd=openSync(stdout,'w'),errorFd=openSync(stderr,'w');
  try{execFileSync(cli,['--session','inventory-menu',...args],{timeout:30000,windowsHide:true,stdio:['ignore',fd,errorFd]});}
  catch(error){console.error(readFileSync(stderr,'utf8'));throw error;}
  finally{closeSync(fd);closeSync(errorFd);}
  return readFileSync(stdout,'utf8').trim();
}
const evaluate=code=>{const result=JSON.parse(run('eval',`JSON.stringify(${code})`));return typeof result==='string'?JSON.parse(result):result;};
const check=(code,message)=>assert.ok(evaluate(code),message);
const rows=[];
function capture(name,width,height){
  const result=evaluate(`(()=>{const d=document.querySelector('.portal-module-menu'),r=d?.getBoundingClientRect();return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,open:!!d?.open,dialog:r?{x:r.x,y:r.y,w:r.width,h:r.height}:null,errors:window.inventoryAudit.errors,overlay:!!document.querySelector('vite-error-overlay,[data-nextjs-dialog]'),focusedInside:!!d?.contains(document.activeElement)}})()`);
  assert.equal(result.errors.length,0,JSON.stringify(result));assert.equal(result.overlay,false);
  assert.ok(result.scrollWidth<=width+1,`Page overflows at ${width}`);
  if(result.open){assert.ok(result.dialog.x>=0&&result.dialog.y>=0&&result.dialog.w<=width&&result.dialog.h<=height+1);assert.equal(result.focusedInside,true);}
  run('screenshot',resolve(out,`${width}x${height}-${name}.png`));rows.push({name,...result});console.log(`${width}x${height} ${name}: PASS`);
}
function openMenu(){run('click','.portal-module-menu-trigger');run('wait','.portal-module-menu[open]');}
function closed(){check(`!document.querySelector('.portal-module-menu')?.open&&document.body.style.overflow!=='hidden'`,'Menu did not unlock body');}
try{
  for(const [width,height] of [[1213,666],[1024,768],[768,1024],[390,844],[370,666],[844,390]]){
    run('set','viewport',String(width),String(height));
    run('open','http://127.0.0.1:4181/inventory-audit-app.html?role=admin&check=1');
    run('wait','.check-actions .pass');run('snapshot','-i');
    check(`(()=>{const e=document.querySelector('.portal-module-menu-trigger'),r=e.getBoundingClientRect();return r.x>=0&&r.x<40&&r.y<100&&r.width>=44&&r.height>=44&&!document.querySelector('.portal-module-menu').open})()`,'Menu trigger is not usable in upper-left');
    capture('closed',width,height);
    // An unfinished numeric entry is local work and must survive menu interactions.
    run('fill','.numeric-reading-entry input','1234');
    const before=evaluate(`({requests:window.inventoryAudit.requests.filter(u=>!u.startsWith('/api/permissions')).length,writes:document.querySelector('#audit-writes').textContent,progress:document.querySelector('.check-progress-summary').textContent})`);
    openMenu();capture('open',width,height);
    run('press','Tab');check(`document.querySelector('.portal-module-menu').contains(document.activeElement)`,'Focus escaped menu');
    run('click','.portal-module-more summary');
    check(`[...document.querySelectorAll('.portal-module-menu a')].some(e=>e.textContent.includes('Daily Duties'))`,'Station Duties link missing');
    capture('more-tools',width,height);
    check(`[...document.querySelectorAll('.portal-module-menu a')].every(e=>!/[?&](apparatus|check)=/.test(e.getAttribute('href')))`,'Apparatus state leaked into other module URL');
    // Exercise the same cancelable unsaved-work guard used throughout the portal.
    evaluate(`(window.addEventListener('firehouse:before-navigate',event=>event.preventDefault(),{once:true}),true)`);
    run('click','.portal-module-menu a[href="/?page=dashboard&display=portal"]');
    check(`location.pathname==='/inventory-audit-app.html'&&document.querySelector('.portal-module-menu').open`,'Canceled navigation left the check');
    run('click','.portal-module-menu a[aria-current="page"]');closed();
    check(`document.querySelector('.numeric-reading-entry input').value==='1234'`,'Current-menu selection lost unsaved reading');
    openMenu();run('press','Escape');closed();
    check(`document.activeElement===document.querySelector('.portal-module-menu-trigger')`,'Escape failed to restore trigger focus');
    openMenu();run('click','button[aria-label="Close navigation"]');closed();
    openMenu();run('mouse','move',String(width-8),'120');run('mouse','down');run('mouse','up');closed();
    const after=evaluate(`({requests:window.inventoryAudit.requests.filter(u=>!u.startsWith('/api/permissions')).length,writes:document.querySelector('#audit-writes').textContent,progress:document.querySelector('.check-progress-summary').textContent})`);
    assert.deepEqual(after,before,'Menu interactions refetched inventory, wrote records, or reset progress');
    rows.push({name:'interaction-preservation',width,height,additionalOperationalRequests:after.requests-before.requests,writes:after.writes});
  }
  run('set','viewport','390','844');
  run('open','http://127.0.0.1:4181/inventory-audit-app.html?role=member&check=1');run('wait','.check-actions .pass');
  // Save one fictional result, then check that menu use keeps the shared progress.
  run('click','.check-actions .pass');
  run('wait','--fn',`window.inventoryAudit.data.checkItems.some(i=>i.result==='pass')`);
  openMenu();
  check(`!document.querySelector('.portal-module-menu a[href*="operations-board"]')`,'Member was granted unapproved Live Operations');
  const grants=['inventory.view','inventory.check','dashboard.view','operations_board.view'];
  evaluate(`(window.inventoryAudit.permissions=${JSON.stringify(grants)},window.dispatchEvent(new Event('firehouse:permissions-changed')),true)`);
  run('wait','.portal-module-menu a[href*="operations-board"]');capture('individual-grant',390,844);
  evaluate(`(window.inventoryAudit.permissions=['inventory.view','inventory.check','dashboard.view'],window.dispatchEvent(new Event('firehouse:permissions-changed')),true)`);
  run('wait','--fn',`!document.querySelector('.portal-module-menu a[href*="operations-board"]')`);
  capture('individual-grant-removed',390,844);
  run('press','Escape');check(`document.querySelector('.check-progress-summary').textContent.includes('1 of 2 completed')`,'Saved progress was lost');
  openMenu();
  evaluate(`(window.inventoryAudit.permissionMode='timeout',window.dispatchEvent(new Event('firehouse:permissions-changed')),true)`);
  run('wait','.inventory-access-card');closed();
  check(`!document.querySelector('.portal-module-menu-trigger')`,'Failed access check kept privileged menu');capture('access-failed',390,844);
  evaluate(`(window.inventoryAudit.permissionMode='ok',window.dispatchEvent(new Event('firehouse:permissions-changed')),true)`);
  run('wait','.check-progress-summary');check(`document.querySelector('.check-progress-summary').textContent.includes('1 of 2 completed')`,'Reconnect lost saved result');
  capture('reconnected',390,844);openMenu();
  evaluate(`(window.inventoryAudit.permissions=['dashboard.view'],window.dispatchEvent(new Event('firehouse:permissions-changed')),true)`);
  run('wait','.inventory-access-card');closed();check(`!document.querySelector('.portal-module-menu')`,'Inventory revocation did not unmount the menu');
  capture('inventory-access-removed',390,844);
} finally {
  writeFileSync(resolve(out,'results.json'),JSON.stringify(rows,null,2));
  run('close');
}
console.log(`${rows.length} layout/interaction states passed. Fictional browser API; no production records changed.`);
