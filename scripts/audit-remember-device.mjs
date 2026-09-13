// Real sign-in/idle-lock UI with an isolated fictional Auth/API adapter. No live account changes.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,openSync,closeSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const cli=process.env.REMEMBER_AUDIT_BROWSER;
if(!cli)throw Error('Set REMEMBER_AUDIT_BROWSER to the installed native agent-browser executable.');
const out=resolve('outputs/remember-device');mkdirSync(out,{recursive:true});
let command=0;
function run(...args) {
  // The native Windows browser daemon inherits pipes on cold start. File handles
  // let the completed CLI exit without waiting for the persistent daemon.
  const stdout=resolve(out,`command-${++command}.txt`),stderr=resolve(out,`command-${command}-error.txt`);
  const fd=openSync(stdout,'w'),errorFd=openSync(stderr,'w');
  try {execFileSync(cli,['--session','remember-device',...args],{timeout:30000,windowsHide:true,stdio:['ignore',fd,errorFd]});}
  catch(error){console.error(readFileSync(stderr,'utf8'));throw error;}
  finally{closeSync(fd);closeSync(errorFd);}
  return readFileSync(stdout,'utf8').trim();
}
const evaluate=code=>{const value=JSON.parse(run('eval',`JSON.stringify(${code})`));return typeof value==='string'?JSON.parse(value):value;};
const check=(code,message)=>assert.ok(evaluate(code),message);
const rows=[];
const checkbox='.remember-device-option input[type=checkbox]';
function clickButton(name) {
  run('wait','--load','networkidle');
  const line=run('snapshot','-i').split('\n').find(line=>line.includes(`button "${name}"`));
  const ref=line?.match(/\[ref=(e\d+)\]/)?.[1];
  assert.ok(ref,`Missing button: ${name}`);run('click',`@${ref}`);
}
function capture(name,width,height) {
  const state=evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,errors:window.rememberAudit.errors,overlay:!!document.querySelector('vite-error-overlay,[data-nextjs-dialog]'),labelHeight:document.querySelector('.remember-device-option label')?.getBoundingClientRect().height})`);
  assert.equal(state.errors.length,0);assert.equal(state.overlay,false);assert.ok(state.scrollWidth<=width+1);
  if(state.labelHeight)assert.ok(state.labelHeight>=44);
  run('screenshot','--full',resolve(out,`${width}x${height}-${name}.png`));rows.push({name,...state});console.log(`${width}x${height} ${name}: PASS`);
}
try {
  for(const [width,height] of [[390,844],[370,666],[768,1024],[1213,666]]) {
    run('set','viewport',String(width),String(height));
    run('open','http://127.0.0.1:4183/remember-device.html?reset=1');run('wait',checkbox);run('snapshot','-i');
    check(`!document.querySelector('${checkbox}').checked`,'New sign-in must default to unchecked');capture('sign-in',width,height);
    run('find','label','Email address','fill','member@example.test');
    run('find','label','Private PIN','fill','9999');run('check',checkbox);clickButton('Sign in');
    run('wait','.login-message');run('snapshot','-i');
    check(`document.querySelector('.login-message').textContent.includes('not correct')&&document.querySelector('${checkbox}').checked`,'Failed PIN should show error and preserve the option');
    check(`window.rememberAudit.requests.some(r=>r.url==='/api/auth/login'&&r.rememberDevice===true)`,'Checkbox not sent with sign-in');
    capture('failed-pin',width,height);
    run('find','label','Private PIN','fill','1234');clickButton('Sign in');
    run('wait','input[aria-label="Unfinished work"]');run('snapshot','-i');
    check(`sessionStorage.getItem('remember-fixture-enabled')==='true'`,'Remember option not accepted by fictional server');
    run('open','http://127.0.0.1:4183/remember-device.html');run('wait','input[aria-label="Unfinished work"]');run('snapshot','-i');
    check(`!document.querySelector('${checkbox}')`,'Reload unexpectedly requested a PIN');
    run('fill','input[aria-label="Unfinished work"]','Draft survives PIN lock');
    clickButton('Simulate required PIN check');run('wait','.session-lock-overlay');run('snapshot','-i');
    check(`!document.querySelector('${checkbox}').checked&&document.querySelector('.app-under-session-lock').inert`,'PIN lock must preserve work and default off');
    capture('pin-lock',width,height);
    run('find','label','Portal PIN','fill','1234');run('check',checkbox);clickButton('Unlock and continue');
    run('wait','--fn',`!document.querySelector('.session-lock-overlay')`);run('snapshot','-i');
    check(`document.querySelector('input[aria-label="Unfinished work"]').value==='Draft survives PIN lock'`,'Unlock lost unfinished work');
    check(`window.rememberAudit.requests.some(r=>r.url==='/api/auth/pin'&&r.method==='POST'&&r.rememberDevice===true)`,'Unlock checkbox not sent to server');
    clickButton('Sign out');run('wait',checkbox);run('snapshot','-i');
    check(`!document.querySelector('${checkbox}').checked&&!sessionStorage.getItem('remember-fixture-signed')&&!sessionStorage.getItem('remember-fixture-deadline')`,'Sign out must forget this browser and reset the option');
  }
  run('open','http://127.0.0.1:4183/remember-device.html?pin=1');run('wait',checkbox);run('snapshot','-i');
  check(`document.querySelector('h1').textContent==='Enter your portal PIN'&&!document.querySelector('${checkbox}').checked`,'Existing email-session PIN form missing default-off option');
  capture('verified-email-pin',1213,666);
} catch(error) {
  run('screenshot','--full',resolve(out,'failed-state.png'));
  writeFileSync(resolve(out,'failed-state.json'),JSON.stringify(evaluate(`({body:document.body.innerText,errors:window.rememberAudit?.errors,requests:window.rememberAudit?.requests})`),null,2));
  throw error;
} finally {
  writeFileSync(resolve(out,'browser-results.json'),JSON.stringify(rows,null,2));run('close');
}
console.log(`${rows.length} rendered states passed; four full sign-in / wrong-PIN / reload / lock / unlock / sign-out flows passed. Fictional API only.`);
