import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, openSync, closeSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cli = process.env.RECENT_AUDIT_BROWSER;
if (!cli) throw Error('Set RECENT_AUDIT_BROWSER to the installed agent-browser executable.');
const out = resolve('outputs/respond-recent');
mkdirSync(out, {recursive:true});
let command = 0;
const run = (...args) => {
  // A newly launched Windows browser daemon can keep inherited pipes open.
  const path=resolve(out,`command-${++command}.txt`), fd=openSync(path,'w');
  try { execFileSync(cli,['--session','recent25',...args],{windowsHide:true,timeout:45000,stdio:['ignore',fd,fd]}); }
  finally { closeSync(fd); }
  return readFileSync(path,'utf8').trim();
};
const evaluate = code => {
  const result = JSON.parse(run('eval',`JSON.stringify(${code})`));
  return typeof result === 'string' ? JSON.parse(result) : result;
};
const fullscreenPhoneOnly = process.argv.includes('--fullscreen-phone-only');
const results = fullscreenPhoneOnly ? JSON.parse(readFileSync(resolve(out,'browser-results.json'),'utf8')).filter(row=>!(row.width===381&&row.monitor)) : [];
try {
  for (const [width,height,monitor] of fullscreenPhoneOnly ? [[381,666,true]] : [[381,666,false],[768,1024,false],[1024,768,false],[1520,666,false],[1520,666,true],[381,666,true]]) {
    run('set','viewport',String(width),String(height));
    run('open',`http://127.0.0.1:4194/tests/fixtures/respond-recent.html${monitor?'?monitor':''}`);
    run('find','role','tab','click','--name','Recent calls 25');
    const before = evaluate(`(()=>{const list=document.querySelector('.respond-call-rail-list');const map=document.querySelector('.respond-map-layout');return{width:innerWidth,monitor:${monitor},cards:list.querySelectorAll('article').length,listHeight:list.clientHeight,contentHeight:list.scrollHeight,mapHeight:map.getBoundingClientRect().height,overflow:document.documentElement.scrollWidth>innerWidth+1,errors:window.recentCallAudit.errors,overlay:!!document.querySelector('vite-error-overlay')};})()`);
    if (before.cards!==25 || before.contentHeight<=before.listHeight || before.listHeight>640 || before.overflow || before.errors.length || before.overlay) throw Error(JSON.stringify(before));
    run('eval',"document.querySelector('.respond-call-rail').scrollIntoView({block:'center'})");
    run('screenshot',resolve(out,`${width}-${monitor?'fullscreen':'portal'}-top.png`));
    // Keyboard scrolling reaches history while the tab header stays outside it.
    run('eval',"document.querySelector('.respond-call-rail-list').focus()");
    run('press','End');
    run('wait','--fn','(()=>{const list=document.querySelector(".respond-call-rail-list");return list.scrollTop+list.clientHeight>=list.scrollHeight-1;})()');
    const scrolled = evaluate("(()=>{const list=document.querySelector('.respond-call-rail-list');return{scrollTop:list.scrollTop,height:document.querySelector('.respond-map-layout').getBoundingClientRect().height};})()");
    // Wait for native keyboard-scroll animation before clicking the last card.
    run('click','.respond-call-rail-list article:last-child button');
    run('wait','--fn','document.querySelectorAll(".respond-call-card").length===1');
    run('find','role','button','click','--name','Show all calls');
    run('wait','--fn','document.querySelectorAll(".respond-call-card").length===25');
    run('eval',"document.querySelector('.respond-call-rail-list').scrollTop=document.querySelector('.respond-call-rail-list').scrollHeight");
    const last = evaluate("(()=>{const list=document.querySelector('.respond-call-rail-list'),last=list.querySelector('article:last-child').getBoundingClientRect(),box=list.getBoundingClientRect();return{scrollTop:list.scrollTop,lastVisible:last.bottom<=box.bottom+1 && last.bottom>box.top,mapHeight:document.querySelector('.respond-map-layout').getBoundingClientRect().height,errors:window.recentCallAudit.errors};})()");
    if (!last.lastVisible || last.scrollTop<=0 || Math.abs(last.mapHeight-before.mapHeight)>1 || last.errors.length) throw Error(JSON.stringify(last));
    run('screenshot',resolve(out,`${width}-${monitor?'fullscreen':'portal'}-bottom.png`));
    run('find','role','tab','click','--name','Current call 0');
    run('wait','--fn','!!document.querySelector(".respond-call-rail-empty")');
    results.push({...before,scrolled,last,lastCallSelectable:true,showAllRestores25:true,currentTabWorks:true});
    console.log(`PASS ${width}x${height} ${monitor?'fullscreen':'portal'}: 25 calls; bounded scroll; last call selectable; return works.`);
  }
} finally {
  writeFileSync(resolve(out,'browser-results.json'),JSON.stringify(results,null,2));
  run('close');
}
