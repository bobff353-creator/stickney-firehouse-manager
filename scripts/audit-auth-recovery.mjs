import{execFileSync}from'node:child_process';
import{mkdirSync,openSync,closeSync,readFileSync,writeFileSync}from'node:fs';
import{resolve}from'node:path';
const cli=process.env.PORTAL_AUDIT_BROWSER,out=resolve('outputs/startup-stability/auth');mkdirSync(out,{recursive:true});let n=0;const results=[];
const session=`auth-recovery-${Date.now()}`;
function run(...args){const p=resolve(out,`${++n}.txt`),fd=openSync(p,'w');try{execFileSync(cli,['--session',session,...args],{timeout:60000,windowsHide:true,stdio:['ignore',fd,fd]});}finally{closeSync(fd);}return readFileSync(p,'utf8').trim();}
function ev(code){let r=JSON.parse(run('eval',`JSON.stringify(${code})`));return typeof r==='string'?JSON.parse(r):r;}
function capture(name){const r=ev(`({text:document.body.innerText,errors:window.authRecovery.errors,signouts:window.authRecovery.signouts,protected:!!document.querySelector('#protected-fixture'),overflow:document.documentElement.scrollWidth>innerWidth,overlay:!!document.querySelector('vite-error-overlay')})`);if(r.errors.length||r.overflow||r.overlay)throw Error(JSON.stringify(r));run('screenshot',resolve(out,name+'.png'));results.push({name,...r});console.log(name+': PASS');return r;}
try{
 run('set','viewport','390','844');run('open','http://127.0.0.1:4182/auth-recovery.html');run('wait','.login-primary');run('snapshot','-i');
 let r=capture('identity-outage');if(r.signouts||r.protected||!r.text.includes('Check your connection'))throw Error('Outage erased login or granted access');
 ev(`(window.authRecovery.identity='ok',window.authRecovery.context=503,true)`);run('click','.login-primary');run('wait','.login-primary');r=capture('context-outage');if(r.signouts||r.protected)throw Error('Context outage erased login or granted access');
 ev(`(window.authRecovery.context=200,window.dispatchEvent(new Event('online')),true)`);run('wait','#protected-fixture');r=capture('online-recovered');if(r.signouts||!r.protected)throw Error('Recovery failed');
 run('reload');run('wait','.login-primary');ev(`(window.authRecovery.identity='ok',window.authRecovery.context=403,true)`);run('click','.login-primary');run('wait','.login-waiting-card');r=capture('membership-denied');if(r.protected||!r.text.includes('Department approval needed'))throw Error('Membership denial bypassed');
 run('reload');run('wait','.login-primary');ev(`(window.authRecovery.identity='ok',window.authRecovery.context=401,true)`);run('click','.login-primary');run('wait','input[type="email"]');r=capture('expired-session');if(r.protected||r.signouts!==1)throw Error('Expired login not removed');
}finally{writeFileSync(resolve(out,'results.json'),JSON.stringify(results,null,2));try{run('close');}catch{console.warn('Browser assertions complete; automation session close timed out.');}}
