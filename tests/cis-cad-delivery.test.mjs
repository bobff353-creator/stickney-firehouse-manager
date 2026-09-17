import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { cisHarness } from './helpers/cis-cad-harness.mjs';
const base = { incidentId: 'FIXTURE-1', eventId: 'fixture-new', agency: 'TEST', status: 'new', sequence: 1, dispatchedAt: '2026-09-16T14:00:00Z', callType: 'EMS mutual aid', address: 'Preview-only address', notes: 'Fixture call; no real incident', assignedUnits: ['T1204', 'A1205'] };
const settings = mode => ({ revision: '', mode, agencies: ['TEST'], units: [{ agency: 'TEST', external: 'T1204', apparatus: '1204' }, { agency: 'TEST', external: 'A1205', apparatus: '1205' }] });
test('CIS authenticated API and atomic PostgreSQL lifecycle (fictional local records only)', async t => {
  const h = await cisHarness();
  const env = { secret: process.env.CIS_CAD_WEBHOOK_SECRET, database: process.env.FIREHOUSE_DATABASE_SECRET };
  process.env.CIS_CAD_WEBHOOK_SECRET = 'fixture-only-not-a-real-secret'; process.env.FIREHOUSE_DATABASE_SECRET = 'fixture-only';
  const configure = async mode => { const store = h.load('app/cis-cad-store.ts'); const current = await store.readCisSettings(h.db); await store.saveCisSettings(h.db, { ...settings(mode), revision: current.settings.revision }, 'fixture@example.invalid'); };
  const post = async (payload, auth = true, hmac = false) => { const body = JSON.stringify(payload); return h.api.POST(new Request('https://fixture.invalid/api/cad/cis', { method: 'POST', body, headers: { 'Content-Type': 'application/json', ...(auth ? hmac ? { 'x-cis-signature': createHmac('sha256', process.env.CIS_CAD_WEBHOOK_SECRET).update(body).digest('hex') } : { Authorization: `Bearer ${process.env.CIS_CAD_WEBHOOK_SECRET}` } : {}) } })); };
  const count = async table => Number((await h.pg.query(`SELECT count(*) n FROM ${table}`)).rows[0].n);
  try {
    await t.test('authentication, admin gates and disabled mode are fail closed', async () => {
      assert.equal((await post(base, false)).status, 401);
      assert.equal((await post(base)).status, 503);
      for (const method of ['GET', 'PUT', 'PATCH']) assert.equal((await h.api[method](new Request('https://fixture.invalid/api/cad/cis', { method }))).status, 403);
      assert.equal(await count('cad_inbound_receipts'), 0);
    });
    await t.test('shadow exercises real ingestion without any dispatch, log or push', async () => {
      await configure('shadow');
      assert.equal((await (await post(base, true, true)).json()).status, 'shadow');
      assert.equal((await (await post({ ...base, notes: 'Changed body with same event ID' })).json()).duplicate, true);
      assert.equal(await count('dispatch_incidents'), 0); assert.equal(await count('daily_logs'), 0); assert.deepEqual(h.stats.pushes, []);
      assert.equal(h.stats.queries.some(sql => sql.includes('SELECT enable_cad_push_outbox()')), false);
    });
    await t.test('admin settings validate real Fleet, require live confirmation and reject stale saves', async () => {
      const request = (method, body) => new Request('https://fixture.invalid/api/cad/cis', { method, headers: { 'Content-Type': 'application/json', 'x-fixture-role': 'admin' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const view = await (await h.api.GET(request('GET'))).json();
      assert.equal(view.settings.mode, 'shadow'); assert.equal(view.liveVerified, false); assert.equal(JSON.stringify(view).includes('raw_payload'), false);
      assert.equal((await h.api.PATCH(request('PATCH', { settings: { ...view.settings, mode: 'live' } }))).status, 400);
      assert.equal((await h.api.PATCH(request('PATCH', { settings: { ...view.settings, units: [{ agency: 'TEST', external: 'T9999', apparatus: '9999' }] } }))).status, 400);
      const save = { settings: { ...view.settings, mode: 'shadow' } };
      assert.equal((await h.api.PATCH(request('PATCH', save))).status, 200);
      assert.equal((await h.api.PATCH(request('PATCH', save))).status, 400);
      const preview = await (await h.api.PUT(request('PUT', { sample: JSON.stringify(base) }))).json();
      assert.equal(preview.routing.status, 'applied'); assert.equal(preview.writes, false); assert.equal(preview.notifications, false);
    });
    await t.test('live writes canonical unit IDs and original details atomically; test receipts do not suppress live', async () => {
      await configure('live');
      const result = await (await post(base)).json(); assert.equal(result.status, 'accepted');
      assert.equal((await h.pg.query('SELECT responding_units FROM dispatch_incidents')).rows[0].responding_units, '1204, 1205');
      assert.equal(await count('daily_log_calls'), 1); assert.equal(h.stats.pushes.length, 1);
      assert.equal((await (await post(base)).json()).duplicate, true); assert.equal(h.stats.pushes.length, 1);
      await h.load('app/dispatch-daily-log.ts').projectDispatchIntoDailyLog(h.db, { reportNumber: base.incidentId, dispatchedAt: base.dispatchedAt, timeOut: '0800', respondingUnits: 'STIF', address: 'Stale email address', callType: 'Stale email type' });
      const log = (await h.pg.query('SELECT address,responding_units FROM daily_log_calls')).rows[0];
      assert.equal(log.address, base.address); assert.equal(log.responding_units, '1204, 1205', 'An email projection racing after CIS cannot overwrite assignments');
    });
    await t.test('partial update and single-unit availability preserve the incident and other rig', async () => {
      assert.equal((await post({ incidentId: base.incidentId, eventId: 'notes', status: 'update', sequence: 2, notes: 'New call notes' })).status, 200);
      assert.equal((await post({ incidentId: base.incidentId, eventId: 'available', status: 'unit available', unitId: 'T1204', sequence: 3, timeIn: '0930' })).status, 200);
      const row = (await h.pg.query('SELECT * FROM dispatch_incidents')).rows[0];
      assert.equal(row.active, 1); assert.equal(row.responding_units, '1205'); assert.equal(row.address, base.address); assert.equal(row.narrative, 'New call notes');
      assert.equal((await h.pg.query('SELECT time_in FROM daily_log_calls')).rows[0].time_in, '');
    });
    await t.test('a failed transaction rolls back its receipt and all state; retry succeeds', async () => {
      const event = { incidentId: base.incidentId, eventId: 'retry-notes', status: 'update', sequence: 4, notes: 'Retry-safe' };
      const before = await count('cad_inbound_receipts'); h.stats.failBatchAt = 5;
      assert.equal((await post(event)).status, 503); assert.equal(await count('cad_inbound_receipts'), before);
      assert.equal((await h.pg.query('SELECT narrative FROM dispatch_incidents')).rows[0].narrative, 'New call notes');
      assert.equal((await post(event)).status, 200);
    });
    await t.test('incident clear closes dispatch and log; stale and late new messages stay closed', async () => {
      await post({ incidentId: base.incidentId, eventId: 'clear', incidentStatus: 'closed', sequence: 5, timeIn: '1045' });
      assert.equal((await h.pg.query('SELECT active FROM dispatch_incidents')).rows[0].active, 0);
      assert.equal((await h.pg.query('SELECT time_in FROM daily_log_calls')).rows[0].time_in, '1045');
      const pushes = h.stats.pushes.length;
      assert.equal((await (await post({ ...base, eventId: 'late-new', sequence: 6 })).json()).status, 'ignored');
      assert.equal(h.stats.pushes.length, pushes);
    });
    await t.test('concurrent duplicate deliveries commit exactly once', async () => {
      const event = { ...base, incidentId: 'FIXTURE-2', eventId: 'concurrent' };
      const results = await Promise.all([post(event), post(event)]);
      assert.deepEqual(results.map(r => r.status), [200, 200]);
      assert.equal(Number((await h.pg.query("SELECT count(*) n FROM cad_inbound_receipts WHERE external_event_id='concurrent'")).rows[0].n), 1);
      assert.equal(Number((await h.pg.query("SELECT count(*) n FROM daily_log_calls WHERE report_number='FIXTURE-2'")).rows[0].n), 1);
    });
    await t.test('first partial update is retryable after the initial snapshot arrives', async () => {
      const update = { incidentId: 'FIXTURE-ORDER', agency: 'TEST', eventId: 'before-new', status: 'update', sequence: 2, notes: 'Retried update' };
      assert.equal((await post(update)).status, 409);
      assert.equal((await post({ ...base, incidentId: 'FIXTURE-ORDER', eventId: 'initial-order' })).status, 200);
      assert.equal((await post(update)).status, 200);
      assert.equal((await h.pg.query("SELECT narrative FROM dispatch_incidents WHERE incident_id='FIXTURE-ORDER'")).rows[0].narrative, 'Retried update');
      await post({ incidentId: 'FIXTURE-ORDER', eventId: 'order-close', status: 'closed', sequence: 3, timeIn: '1050' });
    });
    await t.test('CIS can close an existing email incident without losing its details or human return time', async () => {
      await h.pg.query("INSERT INTO dispatch_incidents(incident_id,resend_email_id,call_type,category,address,city,narrative,responding_units,dispatched_at,time_out,source_payload,active) VALUES('EMAIL-FIXTURE','email-fixture','Fixture EMS','','Existing address','','Existing narrative','1204','2026-09-16T14:00:00Z','0900','{}',1)");
      await h.pg.query("INSERT INTO daily_log_calls VALUES('email-log','2026-09-16','EMAIL-FIXTURE','0900','1040','1204','Existing address','Fixture EMS',10)");
      assert.equal((await post({ incidentId: 'EMAIL-FIXTURE', agency: 'TEST', eventId: 'handoff-close', incidentStatus: 'closed', sequence: 9, timeIn: '1045' })).status, 200);
      const row = (await h.pg.query("SELECT active,address,responding_units FROM dispatch_incidents WHERE incident_id='EMAIL-FIXTURE'")).rows[0];
      assert.equal(row.active, 0); assert.equal(row.address, 'Existing address'); assert.equal(row.responding_units, '1204');
      assert.equal((await h.pg.query("SELECT time_in FROM daily_log_calls WHERE id='email-log'")).rows[0].time_in, '1040');
    });
    await t.test('all active CIS calls survive age/caps and closed calls cannot fall back to Daily Log', async () => {
      const source = readFileSync('app/api/respond/route.ts', 'utf8');
      const sql = source.match(/"(SELECT incident_id reportNumber,call_type.*?FROM dispatch_incidents.*?)"/)[1];
      await h.pg.query("UPDATE dispatch_incidents SET dispatched_at='2025-01-01T00:00:00Z'");
      assert.equal((await h.db.prepare(sql).all()).results.length, 1);
      assert.equal(source.includes('LIMIT 24'), false);
      const recent = source.match(/"(SELECT report_number reportNumber,call_type callType,address,responding_units.*?LIMIT 25)"/)[1];
      assert.equal((await h.db.prepare(recent).bind('1203', '(^|[^A-Z0-9-])1203([^A-Z0-9-]|$)').all()).results.length, 0);
      assert.equal((await h.db.prepare(recent).bind('1204', '(^|[^A-Z0-9-])1204([^A-Z0-9-]|$)').all()).results.length, 3, 'The first-cleared rig remains in historical response records');
      assert.equal((await h.db.prepare(recent).bind('1205', '(^|[^A-Z0-9-])1205([^A-Z0-9-]|$)').all()).results.length, 2);
    });
  } finally {
    if (env.secret === undefined) delete process.env.CIS_CAD_WEBHOOK_SECRET; else process.env.CIS_CAD_WEBHOOK_SECRET = env.secret;
    if (env.database === undefined) delete process.env.FIREHOUSE_DATABASE_SECRET; else process.env.FIREHOUSE_DATABASE_SECRET = env.database;
    await h.close();
  }
});
