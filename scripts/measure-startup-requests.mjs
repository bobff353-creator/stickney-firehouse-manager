// Isolated mount/timer comparison, not production traffic or a billing estimate.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import ts from 'typescript';
const git=process.env.AUDIT_GIT||'git';
const before=execFileSync(git,['show','0a0401c5a9b01fcf0a89585ae1cd446b8061ee7f:app/use-permissions.ts'],{encoding:'utf8',windowsHide:true});
async function measure(source){
 const effects=[],subs=[],timers=new Map();let n=0,requests=0,channels=0;
 const original={window:globalThis.window,document:globalThis.document,BroadcastChannel:globalThis.BroadcastChannel,fetch:globalThis.fetch};
 globalThis.window=Object.assign(new EventTarget(),{setInterval(fn){timers.set(++n,fn);return n;},clearInterval(id){timers.delete(id);}});
 globalThis.document=Object.assign(new EventTarget(),{visibilityState:'visible'});
 globalThis.BroadcastChannel=class{constructor(){channels++;}close(){channels--;}};
 globalThis.fetch=async()=>{requests++;return Response.json({viewerPermissions:['inventory.view'],identity:'fixture'});};
 const module={exports:{}};
 new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(()=>({useEffect(fn){effects.push(fn);},useSyncExternalStore(sub,snapshot){subs.push(sub);return snapshot();}}),module,module.exports);
 const cleanup=[];
 try{
  for(let i=0;i<6;i++){module.exports.usePermissions();const off=subs.at(-1)(()=>{}),stop=effects.at(-1)();cleanup.push(()=>{stop();off();});await new Promise(r=>setImmediate(r));}
  const result={consumers:6,timers:timers.size,channels,staggeredMountRequests:requests};
  requests=0;for(const tick of timers.values()){tick();await new Promise(r=>setImmediate(r));}result.staggeredTimerRequests=requests;
  return result;
 }finally{cleanup.forEach(fn=>fn());Object.assign(globalThis,original);}
}
const result={kind:'Isolated fixture, staggered mounts and timer callbacks',before:await measure(before),after:await measure(readFileSync('app/use-permissions.ts','utf8'))};
mkdirSync('outputs/startup-stability',{recursive:true});writeFileSync('outputs/startup-stability/request-measurement.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
