// Uses the installed agent-browser, actual React board, and local PostgreSQL fixture.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, openSync, closeSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const cli=process.env.BOARD_AUDIT_BROWSER;
if(!cli)throw Error('Set BOARD_AUDIT_BROWSER to the installed agent-browser executable.');
const out=resolve('outputs/board-feed-optimization');mkdirSync(out,{recursive:true});
let command=0;
const run=(...args)=>{
 const output=resolve(out,`command-${++command}.txt`),fd=openSync(output,'w'),errorFd=openSync(resolve(out,`command-${command}-error.txt`),'w');
 try {execFileSync(cli,['--session','board-feed-render',...args],{timeout:45000,windowsHide:true,stdio:['ignore',fd,errorFd]});}
 finally {closeSync(fd);closeSync(errorFd);}
 return readFileSync(output,'utf8').trim();
};
const evaluate=code=>{const value=JSON.parse(run('eval',`JSON.stringify(${code})`));return typeof value==='string'?JSON.parse(value):value;};
const results=[];
try {
 for(const [width,height,tv] of [[360,844,false],[768,1024,false],[1520,666,true],[1920,1080,true]]){
  run('set','viewport',String(width),String(height));
  run('open',`http://127.0.0.1:4192/tests/fixtures/board-feeds-audit.html${tv?'?tv':''}`);
  // Training slides stay mounted but hidden until their rotation; wait for
  // data in the DOM, not for the training rotation to become visible.
  run('wait','--fn','document.querySelectorAll(".training-course-list a").length === 3');
  run('wait','--fn','!!document.querySelector(".board-weather-slide")');
  // Rotate using only the fixture's UI timers, not API timers, for captures.
  const before=evaluate('window.boardFeedAudit.requests.filter(x=>x.includes("board-feeds")).length');
  const result=evaluate(`({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,errors:window.boardFeedAudit.errors,overlay:!!document.querySelector('vite-error-overlay,[data-nextjs-dialog]'),classes:document.querySelectorAll('.training-course-list a').length,feeds:window.boardFeedAudit.requests.filter(x=>x.includes('board-feeds')).length})`);
  if(result.overflow||result.errors.length||result.overlay||result.classes!==3||result.feeds!==2)throw Error(JSON.stringify(result));
  run('snapshot','-i');run('screenshot',resolve(out,`${width}-board.png`));
  results.push({...result,before});
 }
} finally {run('close');writeFileSync(resolve(out,'browser-results.json'),JSON.stringify(results,null,2));}
console.log(JSON.stringify(results));
