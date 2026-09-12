import { execFileSync } from 'node:child_process';
import { mkdirSync,writeFileSync,readFileSync,openSync,closeSync } from 'node:fs';
import { resolve } from 'node:path';
const cli=process.env.CAD_AUDIT_BROWSER;
if(!cli) throw Error('Set CAD_AUDIT_BROWSER to the installed agent-browser executable.');
const output=resolve('outputs/cad-notifications');mkdirSync(output,{recursive:true});
let command=0;
function run(...args){const file=resolve(output,`browser-${++command}.txt`),fd=openSync(file,'w');try{execFileSync(cli,['--session','cad-reliability',...args],{windowsHide:true,timeout:45000,stdio:['ignore',fd,fd]});}finally{closeSync(fd);}return readFileSync(file,'utf8').trim();}
const evaluate=code=>{const result=JSON.parse(run('eval',`JSON.stringify(${code})`));return typeof result==='string'?JSON.parse(result):result;};
const url='http://127.0.0.1:4192/tests/fixtures/board-feeds-audit.html';
if(process.argv.includes('--baseline')) {
 run('set','viewport','1520','800');run('open',url+'?tv&count=2&alerts&slow');
 console.log(run('snapshot','-i'));run('screenshot',resolve(output,'two-boards.png'));
 const baseline=evaluate('({errors:boardFeedAudit.errors,overlay:!!document.querySelector("vite-error-overlay"),content:document.body.innerText.length,requests:boardFeedAudit.requests})');
 writeFileSync(resolve(output,'baseline.json'),JSON.stringify(baseline,null,2));
 if(baseline.errors.length||baseline.overlay||!baseline.content)throw Error(JSON.stringify(baseline));
 console.log('BASELINE PASS: actual board components render without errors.');
} else {
 const results=[];
 try {
   const start=evaluate('boardFeedAudit.requests.length');
   run('eval','window.boardFeedAudit.incoming=true');
   // Wait on the actual unchanged 30-second board poll, not an accelerated clock.
   run('wait','--fn','window.boardFeedAudit.alerts===2');
   const live=evaluate('({alerts:boardFeedAudit.alerts,notificationRequests:boardFeedAudit.requests.filter(p=>p==="/api/alerts").length,dashboardRequests:boardFeedAudit.requests.filter(p=>p==="/api/dashboard").length,errors:boardFeedAudit.errors})');
   if(live.alerts!==2||live.notificationRequests!==0||live.errors.length)throw Error(JSON.stringify(live));
   results.push({scenario:'Two TV boards, slow informational feeds, incoming simulated CAD',...live,start});
   for(const [width,height] of [[381,666],[768,1024],[1520,800]]) {
     run('set','viewport',String(width),String(height));run('open',url+'?alerts');
     run('find','role','button','click','--name','1 smart alerts');
     run('wait','--fn','!!document.querySelector(".alert-popover")');
     run('screenshot',resolve(output,`alerts-${width}.png`));
     const page=evaluate('({width:innerWidth,content:document.querySelector(".alert-popover").innerText,errors:boardFeedAudit.errors,overlay:!!document.querySelector("vite-error-overlay")})');
     if(page.errors.length||page.overlay||!page.content.includes('Fixture attention item'))throw Error(JSON.stringify(page));
     results.push(page);
   }
   // Test the actual component while the browser visibility API reports hidden,
   // then restored. No production requests are allowed by the fixture.
   run('eval','Object.defineProperty(document,"hidden",{configurable:true,get:()=>true});document.dispatchEvent(new Event("visibilitychange"))');
   const before=evaluate('boardFeedAudit.requests.filter(p=>p==="/api/alerts").length');
   run('eval','window.dispatchEvent(new Event("online"))');
   const hidden=evaluate('boardFeedAudit.requests.filter(p=>p==="/api/alerts").length');
   if(hidden!==before)throw Error('Hidden tab requested alerts');
   run('eval','Object.defineProperty(document,"hidden",{configurable:true,get:()=>false});document.dispatchEvent(new Event("visibilitychange"))');
   run('wait','--fn',`boardFeedAudit.requests.filter(p=>p==="/api/alerts").length>${before}`);
   results.push({scenario:'Simulated visibility and reconnect events on actual SmartAlerts',hiddenRequests:0,recovered:true});
   console.log('PASS: two TV boards detected the call; zero notification-menu requests. Phone/tablet/desktop alerts render; hidden tab pauses and returns.');
 } finally {writeFileSync(resolve(output,'browser-results.json'),JSON.stringify(results,null,2));run('close');}
}
