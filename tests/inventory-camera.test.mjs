import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compiled = ts.transpileModule(readFileSync(new URL('../app/inventory-camera.ts', import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod = {exports:{}};
new Function('module','exports',compiled)(mod, mod.exports);
const {requestRearCamera,scannedVin,cameraError} = mod.exports;
const vin = '1FTWW3BR4AEA52595';
const fakeStream = () => { let stops=0; return {getTracks:()=>[{stop(){stops++;}}],get stops(){return stops;}}; };
test('VIN scanner accepts whole valid values and common label wrappers, never arbitrary truncation',()=>{
  for(const value of [vin,vin.toLowerCase(),`VIN: ${vin}`,`*${vin}*`,`]C1${vin}`]) assert.equal(scannedVin(value),vin);
  for(const value of ['',vin.slice(1),`${vin}999`,'PARTS'+vin,vin.replace('F','I'),vin.replace('F','O'),vin.replace('F','Q'),`${vin};${vin}`]) assert.equal(scannedVin(value),null);
});
test('rear camera requests video only and releases a late grant after Cancel',async()=>{
  let grant, constraints;
  const stream=fakeStream(), controller=new AbortController();
  const request=requestRearCamera(controller.signal,{getUserMedia(value){constraints=value;return new Promise(resolve=>grant=resolve);}},1000);
  await Promise.resolve(); controller.abort();
  await assert.rejects(request,{name:'AbortError'});
  grant(stream); await Promise.resolve(); await Promise.resolve();
  assert.equal(stream.stops,1); assert.equal(constraints.audio,false); assert.equal(constraints.video.facingMode.ideal,'environment');
});
test('camera timeout remains recoverable and releases any later stream',async()=>{
  let grant;const stream=fakeStream();
  const request=requestRearCamera(new AbortController().signal,{getUserMedia(){return new Promise(resolve=>grant=resolve);}},10);
  await assert.rejects(request,{name:'TimeoutError'});grant(stream);await Promise.resolve();await Promise.resolve();assert.equal(stream.stops,1);
});
test('camera success remains owned by caller, failures are distinct and do not retry permissions',async()=>{
  const stream=fakeStream(); assert.equal(await requestRearCamera(new AbortController().signal,{getUserMedia:async()=>stream}),stream); assert.equal(stream.stops,0);
  let calls=0;await assert.rejects(requestRearCamera(new AbortController().signal,{getUserMedia:async()=>{calls++;throw new DOMException('denied','NotAllowedError');}}),{name:'NotAllowedError'});assert.equal(calls,1);
  assert.match(cameraError(new DOMException('denied','NotAllowedError')),/permission is blocked/);
  assert.match(cameraError(new DOMException('missing','NotFoundError')),/No camera/);
  assert.match(cameraError(new DOMException('busy','NotReadableError')),/busy/);
});
test('cancel before startup never opens a camera',async()=>{
  const controller=new AbortController();controller.abort();let calls=0;
  await assert.rejects(requestRearCamera(controller.signal,{getUserMedia:async()=>{calls++;return fakeStream();}}),{name:'AbortError'});assert.equal(calls,0);
});
test('all three inventory camera entry points use the shared recoverable dialog',()=>{
  for(const file of ['inventory-live','inventory-operations','inventory-vin-profile']) {
    const source=readFileSync(new URL(`../app/${file}.tsx`,import.meta.url),'utf8');assert.match(source,/<InventoryCapture/);assert.doesNotMatch(source,/decodeFromConstraints|getUserMedia/);
  }
  const source=readFileSync(new URL('../app/inventory-capture.tsx',import.meta.url),'utf8');
  assert.match(source,/capture="environment"/);assert.match(source,/decodeFromImageUrl/);assert.match(source,/playsInline muted/);assert.match(source,/onPlaying/);assert.match(source,/current !== generation.current/);
});
