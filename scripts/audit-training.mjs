import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const cli=process.env.PORTAL_AUDIT_BROWSER;
if(!cli)throw Error('Set PORTAL_AUDIT_BROWSER to the native browser executable.');
const output=resolve('outputs/training-import');mkdirSync(output,{recursive:true});
function run(...args){return execFileSync(cli,['--session','training-check',...args],{encoding:'utf8',windowsHide:true,timeout:45000}).trim();}
const js=code=>{const value=JSON.parse(run('eval',`(async()=>JSON.stringify(${code}))()`));return typeof value==='string'?JSON.parse(value):value;};
const wait=condition=>run('eval',`(async()=>{for(let i=0;i<350;i++){if(${condition})return 'ready';await new Promise(r=>setTimeout(r,100));}throw Error('Condition not met');})()`);
const button=name=>{run('find','role','button','click','--name',name);run('snapshot','-i');};
const base='http://127.0.0.1:4193/tests/fixtures/board-feeds-audit.html?links&training';
const results=[];
function check(){const state=js(`({errors:window.boardFeedAudit.errors,overlay:!!document.querySelector('vite-error-overlay,[data-nextjs-dialog]'),width:innerWidth,scrollWidth:document.documentElement.scrollWidth})`);assert.deepEqual(state.errors,[]);assert.equal(state.overlay,false);assert.ok(state.scrollWidth<=state.width+1);return state;}
try{
  for(const [id,width,height] of [['romeoville',390,844],['nipsta',768,1024],['ifsi',1213,666]]){
    run('open',base);run('set','viewport',String(width),String(height));run('snapshot','-i');wait(`document.querySelector('.board-display-controls > button:nth-child(2)')`);
    js(`await (await fetch('/__training-reset')).json()`);
    const before=js(`(await (await fetch('/api/board-links')).json()).settings`);
    run('click','.board-display-controls > button:nth-child(2)');run('snapshot','-i');run('select','dialog select',id);run('snapshot','-i');
    run('screenshot',resolve(output,`${width}-source.png`));
    button('2 · Test & preview classes');wait(`document.querySelectorAll('dialog [aria-label="Upcoming classes"] a').length>0`);
    assert.equal(js(`(await (await fetch('/api/board-links')).json()).settings.revision`),before.revision);
    const geometry=js(`(()=>{const d=document.querySelector('dialog').getBoundingClientRect(),f=document.querySelector('dialog footer').getBoundingClientRect();return {left:d.left,right:d.right,top:d.top,footerBottom:f.bottom};})()`);
    assert.ok(geometry.left>=0&&geometry.right<=width+1&&geometry.top>=0&&geometry.footerBottom<=height+1,JSON.stringify(geometry));
    run('screenshot',resolve(output,`${width}-preview.png`));
    run('eval',`document.querySelector('dialog [aria-label="Upcoming classes"]').scrollIntoView({block:'center'})`);run('snapshot','-i');
    run('screenshot',resolve(output,`${width}-preview-cards.png`));
    button('3 · Save classes to board');wait(`!document.querySelector('dialog')`);
    wait(`document.querySelectorAll('.rotation-slide:not([hidden]) [aria-label="Upcoming classes"] a').length===5`);
    assert.deepEqual(js(`(await (await fetch('/api/board-links')).json()).settings.sections.romeoville.links`),before.sections.romeoville.links);
    run('screenshot',resolve(output,`${width}-board.png`));results.push({id,width,height,previewPublish:true,linksPreserved:true,...check()});
  }
  run('open',base+'&count=2');run('snapshot','-i');wait(`document.querySelectorAll('.board-display-controls > button').length===4`);
  js(`await (await fetch('/__training-reset')).json()`);
  run('click','main:first-of-type .board-display-controls > button:nth-child(2)');run('snapshot','-i');
  button('2 · Test & preview classes');wait(`document.querySelectorAll('dialog [aria-label="Upcoming classes"] a').length>0`);
  // Fail at the final transaction statement: preview and previous board survive.
  js(`await (await fetch('/__training-fail-save')).json()`);
  const revision=js(`(await (await fetch('/api/board-links')).json()).settings.revision`);
  button('3 · Save classes to board');wait(`document.querySelector('dialog [role=alert]')`);
  assert.equal(js(`(await (await fetch('/api/board-links')).json()).settings.revision`),revision);
  assert.equal(js(`document.querySelectorAll('dialog [aria-label="Upcoming classes"] a').length`),6);
  run('screenshot',resolve(output,'failed-save.png'));
  run('eval',`window.boardFeedAudit.incoming=true`);wait(`window.boardFeedAudit.alerts===2`);
  assert.ok(js(`!!document.querySelector('dialog')`));
  button('3 · Save classes to board');wait(`!document.querySelector('dialog')`);
  wait(`[...document.querySelectorAll('.operations-board')].every(b=>b.textContent.includes('Fixture romeoville class 1'))`);
  results.push({twoBoardsUpdated:true,failedSavePreserved:true,incomingCallsWhileEditing:true,...check()});
  run('open',base+'&member');run('snapshot','-i');wait(`document.querySelector('.board-clock')`);assert.equal(js(`document.querySelectorAll('.board-display-controls > button').length`),0);results.push({memberCannotEdit:true});
  run('set','viewport','1920','1080');run('open',base+'&tv');run('snapshot','-i');
  // TV mode deliberately omits the section picker. Observe its real rotation.
  let trainingVisible=false;
  for(let attempt=0;attempt<3&&!trainingVisible;attempt++)trainingVisible=js(`await (async()=>{for(let i=0;i<190;i++){if(document.querySelector('.rotation-slide:not([hidden]) [aria-label="Upcoming classes"] a'))return true;await new Promise(r=>setTimeout(r,100));}return false;})()`);
  assert.ok(trainingVisible,'TV rotated to saved classes');run('snapshot','-i');
  const fit=js(`(()=>{const list=document.querySelector('.rotation-slide:not([hidden]) .training-cards-list'),box=list.getBoundingClientRect();return [...list.querySelectorAll('a')].every(a=>{const r=a.getBoundingClientRect();return r.top>=box.top-1&&r.bottom<=box.bottom+1&&r.right<=box.right+1;});})()`);assert.ok(fit,'All five TV class cards fit without scrolling');
  run('screenshot',resolve(output,'tv.png'));check();results.push({tv:true,allFiveCardsVisible:fit});
  writeFileSync(resolve(output,'results.json'),JSON.stringify({passed:true,results},null,2));console.log(JSON.stringify({passed:true,results}));
}catch(error){run('screenshot',resolve(output,'error.png'));console.error(run('snapshot','-i'));throw error;}finally{run('close');}
