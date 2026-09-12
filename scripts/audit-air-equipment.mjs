// Actual React UI; explicitly fictional API fixtures. Run SQL tests separately.
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const cli=process.env.INVENTORY_AUDIT_BROWSER;
if(!cli)throw Error('Set INVENTORY_AUDIT_BROWSER to the installed agent-browser entrypoint.');
const output=resolve('outputs/air-equipment');mkdirSync(output,{recursive:true});
const run=(...args)=>execFileSync(process.execPath,[cli,'--session','inventory-air',...args],{encoding:'utf8',timeout:30000}).trim();
const evaluate=code=>{let value=JSON.parse(run('eval',`JSON.stringify(${code})`));if(typeof value==='string')value=JSON.parse(value);return value;};
const click=(text,tag='button',prefix=false)=>{
 evaluate(`(()=>{document.querySelector('[data-air-audit-click]')?.removeAttribute('data-air-audit-click');const element=[...document.querySelectorAll(${JSON.stringify(tag)})].find(item=>item.getClientRects().length && ${prefix?`item.textContent.trim().startsWith(${JSON.stringify(text)})`:`item.textContent.trim()===${JSON.stringify(text)}`});if(!element)throw Error('Missing visible control: '+${JSON.stringify(text)});element.setAttribute('data-air-audit-click','yes');element.scrollIntoView({block:'center',behavior:'instant'});return true;})()`);
 run('click','[data-air-audit-click]');
};
const fill=(name,value)=>{
 const selector=`.air-systems [name="${name}"]`;
 if(evaluate(`document.querySelector(${JSON.stringify(selector)})?.type`)==='date'){
  // This agent-browser version reports success without filling native date inputs.
  // Exercise browser date validity explicitly; native mobile picker interaction is not covered.
  evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));if(input.value!==${JSON.stringify(value)})throw Error('Date not accepted');return true})()`);
 }else run('fill',selector,value);
};
const nav=(view,width)=>width<=980?run('select','.inventory-mobile-destination select',view):click(view==='air'?'Air Packs & Bottles':'Due Now');
const results=process.env.INVENTORY_AUDIT_APPEND ? JSON.parse(readFileSync(resolve(output,'results.json'),'utf8')) : [];
function capture(name,width,role,selector='.air-systems'){
 evaluate(`(()=>{document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'start',behavior:'instant'});return true})()`);
 const result=evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,errors:window.airAudit.errors,overflow:[...document.querySelectorAll('.air-systems button,.air-systems input,.air-systems select,.air-systems textarea,.air-systems h2')].filter(e=>{const r=e.getBoundingClientRect();return e.getClientRects().length&&(r.left < -1 || r.right > innerWidth+1)}).map(e=>({tag:e.tagName,text:(e.textContent||e.name||'').slice(0,80)})),writes:window.airAudit.requests.filter(r=>r.method==='POST').length})`);
 const previous=results.findIndex(item=>item.name===name&&item.width===width&&item.role===role);
 if(previous>=0)results[previous]={name,width,role,...result};else results.push({name,width,role,...result});
 writeFileSync(resolve(output,'results.json'),JSON.stringify(results,null,2));
 if([390,768,1280].includes(width))run('screenshot',resolve(output,`${role}-${width}-${name}.png`));
 console.log(`${role} ${width} ${name}: ${result.scrollWidth}px, ${result.overflow.length} overflowing controls, ${result.errors.length} errors`);
 if(result.scrollWidth>width||result.overflow.length||result.errors.length)throw Error(`Rendering failure: ${role} ${width} ${name}`);
}
for(const width of (process.env.INVENTORY_AUDIT_WIDTHS||'360,390,768,1024,1280').split(',').map(Number)){
 run('set','viewport',String(width),width>=768?'1024':'844');
 for(const role of ['member','admin']){
  run('open',`http://127.0.0.1:4181/inventory-air-audit.html?role=${role}`);run('wait','.inventory-find-unit');
  nav('air',width);run('wait','.air-systems');capture('packs',width,role);
  click('ID PACK-001','button',true);capture('record',width,role);
  if(role==='member' && evaluate(`!![...document.querySelectorAll('.air-systems button')].find(b=>/Edit record|Add completed/.test(b.textContent))`))throw Error('Member sees admin writes');
  click('← Back to air packs');click('Air bottles (1)');capture('bottles',width,role);click('ID BOTTLE-001','button',true);capture('hydro-record',width,role);click('← Back to air bottles');
  click('Weekly checks');capture('weekly-checks',width,role);click('Preview next check · no results saved','summary');capture('check-preview',width,role);
  if(evaluate(`window.airAudit.requests.filter(r=>r.method==='POST').length`)!==0)throw Error('Read-only navigation saved data');
  if(role==='admin'){
   click('Customize weekly checklist & schedule','summary');capture('weekly-settings',width,role);
   click('Air packs (1)');click('ID PACK-001','button',true);click('Edit record & location');capture('editor-identity',width,role);
   click('2. Manufacturer, SKU, serial number & notes','summary');capture('editor-details',width,role,'.air-form > details:nth-of-type(1)');
   click('3. Purchase, service & hydro dates','summary');capture('editor-dates',width,role,'.air-form > details:nth-of-type(2)');
   if(width===390){
    fill('sku','FIXTURE-EDITED-SKU');run('check','#fail-save');click('Save & view record');run('wait','[role=alert]');
    if(evaluate(`document.querySelector('.air-systems [name=sku]')?.value`)!=='FIXTURE-EDITED-SKU')throw Error('Failed save lost edits');capture('failed-save-retained',width,role);
    click('Save & view record');run('wait','.air-record');
    if(!evaluate(`document.querySelector('.air-systems').textContent.includes('FIXTURE-EDITED-SKU')`))throw Error('Saved record not refreshed');capture('saved-record',width,role);
    click('Add completed maintenance');fill('repairDate','2025-06-01');fill('summary','Fictional service record');fill('resolutionNotes','Fixture-only inspection and repair.');fill('repairCost','25.15');capture('maintenance-form',width,role,'.air-record > .air-form');click('Save maintenance record');
    click('Jun 1, 2025 · Fictional service record','summary',true);capture('maintenance-saved',width,role,'[data-air-audit-click]');
    run('check','#fail-read');evaluate(`(()=>{window.dispatchEvent(new Event('focus'));return true})()`);run('wait','[role=alert]');capture('stale-warning',width,role);run('uncheck','#fail-read');evaluate(`(()=>{window.dispatchEvent(new Event('focus'));return true})()`);run('wait','.air-record');
    click('← Back to air packs');click('Add pack or bottle');fill('asset_number','PACK-002');fill('name','Fictional second pack');run('select','.air-systems [name=compartment_id]','fixture-cab2');click('Save & view record');run('wait','.air-record');capture('new-pack-saved',width,role);
    if(!evaluate(`document.querySelector('.air-systems').textContent.includes('PACK-002')`))throw Error('New ID not shown after save');
    click('← Back to air packs');click('Weekly checks');
    // New location has no old template: its physical asset still builds a check.
    const count=evaluate(`[...document.querySelectorAll('.air-check-grid .ops-primary')].filter(b=>b.textContent==='Start / resume air check').length`);if(count!==2)throw Error('New location asset was not included in its checklist');
    click('Start / resume air check');run('wait','.scba-entry');capture('active-check',width,role,'.scba-check-worklist');
    if(evaluate(`document.querySelector('.scba-entry input[name=harnessNumber]')?.value`)!=='PACK-001')throw Error('Registered pack ID not carried into check');
    click('← Back to Air Packs & Bottles');run('wait','.air-systems');capture('check-return',width,role);
   }else click('Cancel');
  }
 }
}
console.log(`Verified ${results.length} responsive states using fictional records.`);
