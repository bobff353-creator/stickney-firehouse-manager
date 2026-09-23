import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { nonnegativeMeasurement, releaseIdentity, summarizeHealth } from '../app/system-health-model.ts';
import { sameOriginAuthRequest } from '../app/request-security.ts';

const ids = ['database','users','file-storage','database-usage','storage-usage','database-backup','file-backup','offsite-backup','backup-verification','deployment'];
const checks = () => ids.map(id => ({ id, state: 'healthy' }));
test('overall status cannot be green with missing, failed, or unverified recovery controls', () => {
  assert.equal(summarizeHealth(checks(), 'fixture').state, 'healthy');
  for (const id of ids) {
    for (const state of ['warning','unavailable']) {
      assert.equal(summarizeHealth(checks().map(check => check.id === id ? {...check,state} : check), 'fixture').state, 'attention', `${id}: ${state}`);
    }
    if (id !== 'deployment') assert.equal(summarizeHealth(checks().filter(check => check.id !== id), 'fixture').state, 'attention', `missing ${id}`);
  }
  assert.equal(summarizeHealth([], 'fixture').state, 'attention');
});
test('unknown provider measurements are not converted to reassuring zero counts', () => {
  for (const value of [null,undefined,'',' ',NaN,Infinity,-1,'unknown',{},false]) assert.equal(nonnegativeMeasurement(value), null);
  for (const value of [0,'0',24,'24']) assert.equal(nonnegativeMeasurement(value), Number(value));
});
test('production without source metadata is unknown, and a CLI release can supply its exact revision', () => {
  assert.deepEqual(releaseIdentity({VERCEL_ENV:'production'}), {environment:'production',commit:null});
  assert.equal(releaseIdentity({VERCEL_GIT_COMMIT_SHA:'local'}).commit, null);
  const sha = 'a'.repeat(40);
  assert.equal(releaseIdentity({APP_RELEASE_SHA:sha}).commit, sha.slice(0,12));
  assert.equal(releaseIdentity({APP_RELEASE_SHA:'invalid',VERCEL_GIT_COMMIT_SHA:sha}).commit, sha.slice(0,12));
});
test('old self-activation clients cannot turn a roster email and number into a verified account', async () => {
  const source = fs.readFileSync(new URL('../app/api/auth/activate/route.ts', import.meta.url),'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, {
    exports, Response, require: name => { assert.equal(name,'../../../request-security'); return {sameOriginAuthRequest}; },
  });
  for (const origin of ['https://portal.test','https://other.test']) {
    const response = await exports.POST(new Request('https://portal.test/api/auth/activate', {method:'POST',headers:{origin},body:JSON.stringify({email:'fictional@stickneyfire.com',employeeNumber:'1234',pin:'5678'})}));
    assert.equal(response.status,403);
    if (origin === 'https://portal.test') {
      assert.equal((await response.json()).code,'VERIFIED_INVITATION_REQUIRED');
      assert.match(response.headers.get('cache-control'),/no-store/);
    }
  }
});
