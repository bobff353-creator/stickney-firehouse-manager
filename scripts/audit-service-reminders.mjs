// Actual React screens with fictional API responses; never writes production data.
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const cli=process.env.INVENTORY_AUDIT_BROWSER;
if(!cli)throw Error('Set INVENTORY_AUDIT_BROWSER to the installed agent-browser entrypoint.');
const out=resolve('outputs/service-reminders');mkdirSync(out,{recursive:true});
const run=(...args)=>execFileSync(process.execPath,[cli,'--session','service-reminders',...args],{encoding:'utf8',timeout:30000}).trim();
const evaluate=code=>{let value=JSON.parse(run('eval',`JSON.stringify(${code})`));if(typeof value==='string')value=JSON.parse(value);return value;};
const click=(text,tag='button',prefix=false)=>{
 evaluate(`(()=>{document.querySelector('[data-service-click]')?.removeAttribute('data-service-click');const e=[...document.querySelectorAll(${JSON.stringify(tag)})].find(e=>e.getClientRects().length && !e.closest('[hidden]') && ${prefix?`e.textContent.trim().startsWith(${JSON.stringify(text)})`:`e.textContent.trim()===${JSON.stringify(text)}`});if(!e)throw Error('Missing control '+${JSON.stringify(text)});e.setAttribute('data-service-click','yes');e.scrollIntoView({block:'center',behavior:'instant'});return true})()`);run('click','[data-service-click]');
};
const date=value=>evaluate(`(()=>{const e=document.querySelector('[name="last_serviced_date"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
const assert=(code,message)=>{if(!evaluate(code))throw Error(message);};
const nav=(value,width)=>width<=980?run('select','.inventory-mobile-destination select',value):click(value==='air'?'Air Packs & Bottles':value==='equipment'?'Equipment':'Due Now');
const results=[];
function capture(name,width,selector='.service-schedule-fields'){
 evaluate(`(()=>{document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'center',behavior:'instant'});return true})()`);
 const result=evaluate(`({scrollWidth:document.documentElement.scrollWidth,errors:window.airAudit.errors,overflow:[...document.querySelectorAll(${JSON.stringify(selector+' input,'+selector+' select,'+selector+' button')})].filter(e=>{const r=e.getBoundingClientRect();return e.type!=='hidden'&&e.getClientRects().length&&!e.closest('[hidden]')&&(r.left < -1 || r.right > innerWidth+1)}).map(e=>e.name||e.textContent)})`);
 results.push({name,width,...result});writeFileSync(resolve(out,'results.json'),JSON.stringify(results,null,2));
 if(result.scrollWidth>width||result.errors.length||result.overflow.length)throw Error(`Layout failed: ${name} ${width}`);
 run('screenshot',resolve(out,`${width}-${name}.png`));console.log(`${width} ${name}: PASS`);
}
for(const width of [360,390,768,1024,1280]){
 run('set','viewport',String(width),width>=768?'1024':'844');run('open','http://127.0.0.1:4181/inventory-air-audit.html?service=1');run('wait','.service-reminder');
 capture('due-now',width,'.service-reminders');click('Edit service schedule');run('wait','.service-schedule-fields');capture('generic-editor',width);
 for(const interval of ['12','18','24','36','60']){run('select','[aria-label="Service every"]',interval);assert(`document.querySelector('[name="service_interval_months"]').value===${JSON.stringify(interval)}`,'Wrong selected interval');}
 run('select','[aria-label="Service every"]','custom');run('fill','.service-schedule-grid input[type="number"]','30');run('select','[aria-label="Show reminder in Due Now"]','custom');run('fill','.service-schedule-grid label:last-child input','5');capture('custom-months',width);
 assert(`window.airAudit.requests.filter(r=>r.method==='POST').length===0`,'Typing should not save data');
 run('select','[aria-label="Service every"]','18');run('select','[aria-label="Show reminder in Due Now"]','4');date('2025-01-31');
 assert(`document.querySelector('.service-schedule-preview').textContent.includes('Jul 31, 2026')&&document.querySelector('.service-schedule-preview').textContent.includes('Mar 31, 2026')`,'Wrong saved-data preview');
 if(width===390){
  evaluate(`document.querySelector('#fail-save').checked=true`);click('Save item');run('wait','.equipment-editor [role="alert"]');assert(`window.airAudit.data.equipment.find(e=>e.id==='fixture-spreaders').last_serviced_date==='2020-01-31'`,'Failed save mutated item');assert(`document.querySelector('[name="last_serviced_date"]').value==='2025-01-31'`,'Failed save lost draft');capture('failed-save-keeps-draft',width);
  click('Save item');run('wait','.service-reminders');assert(`!document.querySelector('.equipment-editor')&&window.airAudit.data.equipment.find(e=>e.id==='fixture-spreaders').service_reminder_months===4`,'Save did not persist');
  click('Edit service schedule');assert(`document.querySelector('[name="last_serviced_date"]').value==='2025-01-31'`,'Reopen lost saved date');
  evaluate(`window.airAudit.data.equipment.find(e=>e.id==='fixture-spreaders').updated_at='2030-01-01T00:00:00Z'`);click('Save item');run('wait','.equipment-editor [role="alert"]');assert(`document.querySelector('.equipment-editor').textContent.includes('another screen')`,'Stale save not rejected');click('Cancel');
  // Reconnect reload also brings an independently changed record into this screen.
  evaluate(`(window.dispatchEvent(new Event('focus')),true)`);run('wait','[aria-label="Service reminders"]');click('Edit service schedule');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());date(today);click('Save item');
  assert(`!document.querySelector('.equipment-editor')&&!document.querySelector('.service-reminders').textContent.includes('Preview Spreaders')`,'Completion did not advance service cycle');capture('completed-cycle',width,'.service-reminders');
  evaluate(`(document.querySelector('#fail-read').checked=true,window.dispatchEvent(new Event('focus')),true)`);run('wait','.ops-error');assert(`document.body.textContent.includes('may be out of date')`,'Failed live check missing stale warning');capture('offline-warning',width,'.service-reminders');
  evaluate(`(document.querySelector('#fail-read').checked=false,window.dispatchEvent(new Event('focus')),true)`);
 }else click('Cancel');
 nav('air',width);run('wait','.air-systems');click('ID PACK-001','button',true);click('Edit record & location');run('wait','.service-schedule-fields');capture('air-asset-editor',width);
 if(width===390){run('select','[aria-label="Service every"]','36');run('select','[aria-label="Show reminder in Due Now"]','2');click('Save & view record');run('wait','.service-schedule-summary');assert(`window.airAudit.data.equipment.find(e=>e.id==='fixture-pack').service_interval_months===36`,'Air schedule not persisted');capture('air-saved-record',width,'.service-schedule-summary');}
 run('open','http://127.0.0.1:4181/inventory-air-audit.html?service=1&role=member');run('wait','.service-reminders');assert(`![...document.querySelectorAll('.service-reminders button')].length`,'Member was shown edit action');capture('member-reminders',width,'.service-reminders');
}
run('close');console.log(`${results.length} service-reminder render states passed. Date-input values exercised with native setter; physical mobile date picker not tested.`);
