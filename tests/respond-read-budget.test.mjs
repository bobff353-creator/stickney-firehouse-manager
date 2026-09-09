import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createHash } from 'node:crypto';

test('unchanged Respond polls skip catalogs while rechecking access and live calls', async () => {
  let now = 60_000, allowed = true, checks = 0;
  let calls = [];
  const sql = [];
  const db = { prepare(query) {
    sql.push(query);
    const statement = {bind(){return statement;}, async run(){return {};}, async first(){return null;}, async all(){return {results: query.startsWith('SELECT incident_id reportNumber,call_type') ? calls : []};}};
    return statement;
  }};
  const module = {exports:{}};
  const source = readFileSync(new URL('../app/api/respond/route.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mocks = {
    '../../../db/bootstrap': {ensureDatabase: async()=>db},
    'node:crypto': {createHash},
    '../../server-permissions': {hasPermission:async()=>{checks++;return allowed;}},
    '../../operational-day': {chicagoOperationalContext:()=>({operationalDate:'2026-09-09'})},
    '../../respond-device': {normalizeApparatusUnit:value=>value||'',respondingUnitsIncludeUnit:()=>true},
    '../../respond-match': {normalizeResponseAddress:value=>value,rankPreplanMatch:()=>null,distanceFeet:()=>0,suggestedStickneyBoxCard:()=>null},
    '../../preplans/domain': {}, '../../preplans/profiles': {},
  };
  class Clock extends Date { static now(){return now;} }
  vm.runInNewContext(compiled, {exports:module.exports,module,require:name=>{assert.ok(name in mocks,name);return mocks[name];},Response,URL,Date:Clock,console,Error});
  const request = (revision,department='department-a')=>new Request('https://example.test/api/respond',{headers:{'x-department-id':department,...(revision?{'x-respond-revision':revision}:{})}});
  const first = await module.exports.GET(request());
  assert.equal(first.status,200);
  const revision = first.headers.get('x-respond-revision');
  assert.ok(revision);
  const fullQueries=sql.length;
  assert.ok(sql.some(query=>query.includes('FROM field_preplans')));
  sql.length=0;
  now+=10_000;
  const unchanged=await module.exports.GET(request(revision));
  assert.equal(unchanged.status,204);
  assert.equal(await unchanged.text(),'');
  assert.ok(sql.length<fullQueries);
  assert.equal(sql.some(query=>query.includes('FROM field_preplans')||query.includes('FROM field_hydrants')),false);
  assert.equal(checks,2);
  assert.match(unchanged.headers.get('cache-control'),/private, no-store/);
  now=90_000;
  assert.equal((await module.exports.GET(request(revision))).status,200,'refresh reference data at 30-second boundary');
  assert.equal((await module.exports.GET(request(revision,'department-b'))).status,200,'never reuse another department packet');
  allowed=false;
  assert.equal((await module.exports.GET(request(revision))).status,403,'permission revocation overrides revision');
  allowed=true;
  now=70_000;
  calls=[{reportNumber:'new-call',address:'',callType:'FIRE ALARM'}];
  const changed=await module.exports.GET(request(revision));
  assert.equal(changed.status,200,'new calls must take the full response path immediately');
  const activeRevision=changed.headers.get('x-respond-revision');
  assert.equal((await module.exports.GET(request(activeRevision))).status,204,'unchanged active calls also skip reference queries');
  calls=[];
  const cleared=await module.exports.GET(request(activeRevision));
  assert.equal(cleared.status,200,'cleared call immediately replaces the active packet');
  assert.equal((await cleared.json()).activeCall,null);
  console.log(`Isolated idle poll: ${fullQueries} database statements before; 3 on unchanged heartbeat (permission check excluded).`);
});

test('client retains packet on heartbeat and forces a full retry after failure',()=>{
  const source=readFileSync(new URL('../app/respond.tsx',import.meta.url),'utf8');
  assert.match(source,/response.status === 204/);
  assert.match(source,/catch \(value\) \{\s+lastPacketRevision.current = \{ apparatus: "", revision: "" \}/);
  assert.match(source,/lastPacketRevision.current.apparatus === apparatus/);
  assert.match(source,/setInterval\(\(\) => void load\(\), 10000\)/);
});
