import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { trainingModules } from './helpers/training-modules.mjs';

function routes() {
  const writes = [];
  let allowed = true;
  const db = { prepare(sql) { const q = { bind() { return q; }, async first() { return null; }, async run() { writes.push(sql); throw Error('Unexpected write'); } }; return q; } };
  const load = trainingModules({
    [resolve('db/bootstrap.ts')]: { ensureDatabase: async () => db },
    [resolve('app/server-permissions.ts')]: { hasPermission: async () => allowed, permissionsForEmail: async () => new Set(allowed ? ['payroll.manage'] : []) },
  });
  const request = (path, body) => new Request(`https://fixture.invalid/api/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { log: load('app/api/logbook/route.ts'), payroll: load('app/api/payroll/route.ts'), request, writes, deny() { allowed = false; } };
}

test('Daily Log rejects malformed and non-quarter staffing times before any record changes', async () => {
  const f = routes();
  const body = { logDate: '2026-10-16', expectedVersion: 0, shiftNotes: 'Synthetic', calls: [], staffing: [{ employeeId: 'synthetic', shiftKey: 'morning', timeIn: '06:00', timeOut: '12:00' }] };
  for (const time of ['06:', '6:00', '06:01', '06:10', '24:00', '12:60', ' 06:00', '06:00:00', 600]) {
    for (const key of ['timeIn', 'timeOut']) {
      const response = await f.log.POST(f.request('logbook', { ...body, staffing: [{ ...body.staffing[0], [key]: time }] }));
      assert.equal(response.status, 400, `${key} ${time}`);
    }
  }
  assert.deepEqual(f.writes, []);
  f.deny();
  assert.equal((await f.log.POST(f.request('logbook', body))).status, 403);
});

test('manual payroll rejects non-quarter hours instead of posting rounded pay', async () => {
  const f = routes();
  const body = { action: 'saveEntry', employeeId: 'synthetic', periodStart: '2026-10-11', workDate: '2026-10-16', category: 'shift' };
  for (const hours of [0.01, 0.1, 1.2, 1.26, -0.25, 48.25]) {
    assert.equal((await f.payroll.POST(f.request('payroll', { ...body, hours }))).status, 400, String(hours));
  }
  assert.deepEqual(f.writes, []);
  f.deny();
  assert.equal((await f.payroll.POST(f.request('payroll', { ...body, hours: 6 }))).status, 403);
});
