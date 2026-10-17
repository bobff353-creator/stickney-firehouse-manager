import test from 'node:test';
import assert from 'node:assert/strict';
import { cisHarness } from './helpers/cis-cad-harness.mjs';

// All persistence is in-memory PostgreSQL; no HTTP/database service is contacted.
test('bridge commits the incident and log together and cannot reopen a cleared call', async () => {
  const h = await cisHarness();
  const before = process.env.DISPATCH_BRIDGE_READ_TOKEN;
  process.env.DISPATCH_BRIDGE_READ_TOKEN = 'synthetic-local-token';
  try {
    const api = h.load('app/api/dispatch-bridge/route.ts');
    const payload = { reportNumber: 'SYNTHETIC-BRIDGE', callType: 'LOCAL TEST', dispatchedAt: '2026-10-16T14:00:00Z', timeOut: '0900', address: 'Synthetic address' };
    const post = (body = payload, authorized = true) => api.POST(new Request('https://fixture.invalid/api/dispatch-bridge', { method: 'POST', headers: { authorization: authorized ? 'Bearer synthetic-local-token' : 'Bearer invalid', 'content-type': 'application/json' }, body: JSON.stringify(body) }));
    assert.equal((await post(payload, false)).status, 401);
    h.stats.failBatchAt = 1;
    assert.equal((await post()).status, 500);
    assert.equal((await h.pg.query('SELECT count(*) n FROM dispatch_incidents')).rows[0].n, 0, 'projection failure must roll back the incident');
    assert.equal(h.stats.pushes.length, 0, 'push starts only after commit');
    assert.equal((await post()).status, 200);
    assert.equal((await h.pg.query('SELECT count(*) n FROM daily_log_calls')).rows[0].n, 1);
    await h.pg.exec("UPDATE dispatch_incidents SET active=0,cleared_at='2026-10-16T15:00:00Z'; UPDATE daily_log_calls SET time_in='1000',address='Member corrected address'");
    const pushes = h.stats.pushes.length;
    assert.equal((await post({ ...payload, address: 'Late replay' })).status, 200);
    assert.deepEqual((await h.pg.query('SELECT active,cleared_at FROM dispatch_incidents')).rows[0], { active: 0, cleared_at: '2026-10-16T15:00:00Z' });
    assert.equal((await h.pg.query('SELECT address FROM daily_log_calls')).rows[0].address, 'Member corrected address');
    assert.equal(h.stats.pushes.length, pushes);
  } finally {
    if (before === undefined) delete process.env.DISPATCH_BRIDGE_READ_TOKEN; else process.env.DISPATCH_BRIDGE_READ_TOKEN = before;
    await h.close();
  }
});
