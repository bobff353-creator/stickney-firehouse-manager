import './helpers/feed-test-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
const {createBrowserLocationSender}=await import('../app/apparatus-location-sender.ts');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('browser sender validates GPS, prevents overlapping posts, pauses hidden pages and stops after revoke',async()=>{
 const names=['navigator','document','fetch','setInterval','clearInterval'],originals=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
 const originalNow=Date.now;let clock=Date.now(),callback,interval,fetches=0,resolveFetch,hidden=false,cleared=0;const reports=[],active=[];
 const point=(accuracy=10)=>({coords:{latitude:41.8,longitude:-87.7,accuracy,speed:0},timestamp:clock});
 const replace=(name,value)=>Object.defineProperty(globalThis,name,{value,writable:true,configurable:true});
 replace('navigator',{geolocation:{watchPosition(fn){callback=fn;return 1;},clearWatch(){cleared++;},getCurrentPosition(fn){fn(point());}},locks:{request:async(_name,_options,fn)=>fn({})}});
 replace('document',{get visibilityState(){return hidden?'hidden':'visible';}});
 replace('setInterval',fn=>{interval=fn;return 1;});replace('clearInterval',()=>{interval=null;});
 replace('fetch',()=>{fetches++;return new Promise(resolve=>{resolveFetch=resolve;});});Date.now=()=>clock;
 const sender=createBrowserLocationSender(text=>reports.push(text),()=>true,value=>active.push(value));
 try{
  const running=sender.start();await flush();assert.equal(active.at(-1),true);
  callback(point(500));interval();await flush();assert.equal(fetches,0);
  callback(point());interval();await flush();assert.equal(fetches,1);
  clock+=10000;callback(point());interval();await flush();assert.equal(fetches,1,'in-flight POST is not duplicated');
  resolveFetch(Response.json({accepted:true}));await flush();await flush();assert.match(reports.at(-1),/Sharing/);
  hidden=true;clock+=120000;callback(point());interval();await flush();assert.equal(fetches,1);assert.match(reports.at(-1),/hidden/);
  hidden=false;interval();await flush();assert.equal(fetches,2);resolveFetch(Response.json({accepted:false},{status:401}));await flush();await flush();
  assert.equal(active.at(-1),false);assert.equal(interval,null);assert.equal(cleared,1);assert.match(reports.at(-1),/revoked/);
  const count=reports.length;callback(point(999));assert.equal(reports.length,count,'late GPS callback cannot update a stopped sender');await running;
 }finally{sender.stop();Date.now=originalNow;for(const[name,descriptor]of originals){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}
});
