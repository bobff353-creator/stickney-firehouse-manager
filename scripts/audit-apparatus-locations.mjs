import {execFileSync} from 'node:child_process';
import {mkdirSync,openSync,closeSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const cli=process.env.LOCATION_AUDIT_BROWSER;if(!cli)throw Error('Set LOCATION_AUDIT_BROWSER to installed agent-browser.');
const out=resolve('outputs/apparatus-locations');mkdirSync(out,{recursive:true});let command=0;
const session='apparatus-location-'+Date.now();
const run=(...args)=>{const path=resolve(out,`command-${++command}.txt`),fd=openSync(path,'w');try{execFileSync(cli,['--session',session,...args],{timeout:45000,windowsHide:true,stdio:['ignore',fd,fd]});}finally{closeSync(fd);}return readFileSync(path,'utf8').trim();};
const evaluate=code=>{const result=JSON.parse(run('eval',`JSON.stringify(${code})`));return typeof result==='string'?JSON.parse(result):result;};
// CLI calls block Node's event loop, so do not reuse a control connection after
// the local server's keep-alive timeout while a browser command was running.
const control=query=>fetch('http://127.0.0.1:4193/__location-control?'+query,{headers:{connection:'close'}});
const recoveryOnly=process.argv.includes('--recovery-only');
const results=recoveryOnly?JSON.parse(readFileSync(resolve(out,'browser-results.json'),'utf8')):[];
try{
 if(!recoveryOnly){
 for(const [width,height] of [[381,666],[768,1024],[1520,666]]){
  run('set','viewport',String(width),String(height));run('open','http://127.0.0.1:4193/tests/fixtures/apparatus-locations.html');
  run('wait','--fn','document.querySelectorAll(".location-unit").length===2 && window.locationAudit.requests.filter(x=>x==="/api/apparatus-locations").length>=2');
  run('eval','document.querySelector(".apparatus-location-panel").scrollIntoView()');run('screenshot',resolve(out,`${width}-locations.png`));
  run('click','.location-setup summary');run('eval','document.querySelector(".location-setup").scrollIntoView()');
  run('screenshot',resolve(out,`${width}-setup.png`));
  const result=evaluate('({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,errors:window.locationAudit.errors,overlay:!!document.querySelector("vite-error-overlay"),units:document.querySelectorAll(".location-unit").length,markers:document.querySelectorAll(".respond-apparatus-marker").length})');
  if(result.overflow||result.errors.length||result.overlay||result.units!==2||result.markers!==2)throw Error(JSON.stringify(result));results.push(result);
 }
 // Pair a fictional device through the real admin form and route. Never print
 // the one-time setup secret; this database disappears when preview closes.
 run('eval','window.confirm=()=>true');run('select','.location-setup-fields label:first-child select','test-engine');
 run('fill','.location-setup-fields input','Local Windows preview');
 run('eval','document.querySelectorAll(".location-setup-fields select")[1].value="windows"; document.querySelectorAll(".location-setup-fields select")[1].dispatchEvent(new Event("change",{bubbles:true}))');
 run('eval','document.querySelector(".location-setup-actions button").click()');
 run('wait','--fn','!!document.querySelector(".location-secret textarea")');
 const pairing=evaluate('({hasSetup:JSON.parse(document.querySelector(".location-secret textarea").value).unit==="TESTE",errors:window.locationAudit.errors})');if(!pairing.hasSetup||pairing.errors.length)throw Error(JSON.stringify(pairing));results.push({browserSetupSavedThroughActualAPI:true});
 // Refresh the test control's credential after replacing its fictional sender.
 await control('resetSender=1');
 run('open','http://127.0.0.1:4193/tests/fixtures/apparatus-locations.html?four');
 run('wait','--fn','document.querySelectorAll(".location-unit").length===8 && window.locationAudit.requests.filter(x=>x==="/api/apparatus-locations").length>=2');
 const initial=evaluate('window.locationAudit.requests.filter(x=>x==="/api/apparatus-locations").length');if(initial>4)throw Error('Duplicate location snapshots: '+initial);
 await control('move=1');
 run('wait','--fn','[...document.querySelectorAll(".location-unit")].filter(x=>x.innerText.includes("Moving")).length===4');
 const after=evaluate('window.locationAudit.requests.filter(x=>x==="/api/apparatus-locations").length');
 results.push({fourRespondViews:true,initialSnapshots:initial,afterPushSnapshots:after,allFourReceivedMovement:true});
 // Hold the independent location API indefinitely. Existing call timers must continue.
 run('eval','window.locationAudit.holdLocations=true; window.dispatchEvent(new Event("offline")); window.dispatchEvent(new Event("online")); window.locationAudit.incoming=true');
 run('wait','--fn','document.querySelectorAll(".apparatus-map-only").length===4');
 run('eval','document.querySelector(".apparatus-map-only summary").click()');
 run('wait','--fn','!!document.querySelector(".location-disconnected")');
 const interrupted=evaluate('({errors:window.locationAudit.errors,calls:document.querySelectorAll(".apparatus-map-only").length,stale:document.querySelector(".location-unit").innerText,callRequests:window.locationAudit.requests.filter(x=>x.startsWith("/api/respond")).length})');
 if(interrupted.errors.length||interrupted.calls!==4||!interrupted.stale.includes('Last known'))throw Error(JSON.stringify(interrupted));results.push(interrupted);
 }else{
  run('open','http://127.0.0.1:4193/tests/fixtures/apparatus-locations.html');
  run('wait','--fn','document.querySelectorAll(".location-unit").length===2');
 }
 run('eval','window.locationAudit.holdLocations=false');
 await control('denied=1');
 run('eval','window.dispatchEvent(new Event("offline")); window.dispatchEvent(new Event("online"))');
 run('wait','--fn','document.querySelectorAll(".location-unit").length===0');
 results.push({deniedAccessClearedLocations:true});
 await control('denied=0');
 run('eval','window.dispatchEvent(new Event("online"))');run('wait','--fn','document.querySelectorAll(".location-unit").length===2');
 results.push({reconnected:true});
}finally{await control('denied=0&failed=0').catch(()=>{});writeFileSync(resolve(out,'browser-results.json'),JSON.stringify(results,null,2));run('close');}
console.log(JSON.stringify(results));
