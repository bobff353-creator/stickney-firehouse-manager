import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boardLinksHarness, compile } from './helpers/board-links-harness.mjs';
const model = compile('app/board-configuration.ts', {});
const store = compile('app/board-configuration-store.ts', { './board-configuration': model });
const draft = () => { const c = model.defaultBoardConfiguration(); c.slides[0].seconds = 20; return c; };
async function harness() {
  const h = await boardLinksHarness();
  const api = compile('app/api/board-configuration/route.ts', {
    '../../../db/bootstrap': { ensureDatabase: async () => h.db },
    '../../server-permissions': { hasPermission: async request => request.headers.get('x-fixture-role') === 'admin' },
    '../../board-configuration': model, '../../board-configuration-store': store,
  });
  return { ...h, request(method, payload, role = 'admin') { return api[method](new Request('http://localhost/api/board-configuration', { method, headers: { 'content-type': 'application/json', 'x-fixture-role': role, 'oai-authenticated-user-email': 'test@example.invalid' }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) })); } };
}
test('configuration validates every slide, timing and announcement; protected operational content is not configurable', () => {
  assert.deepEqual(model.validateBoardConfiguration(draft()), draft());
  for (const invalid of [null, {}, { ...draft(), slides: [] }, { ...draft(), closeCalls: '99' }]) assert.throws(() => model.validateBoardConfiguration(invalid));
  for (const mutate of [c => c.slides[0].seconds = 0, c => c.slides[0].seconds = 61, c => c.slides[0].seconds = 10.5, c => c.slides[0].id = 'active_calls', c => c.slides[1].id = c.slides[0].id, c => c.slides.forEach(s => s.enabled = false), c => c.announcement.enabled = true, c => c.announcement.title = 'x'.repeat(81), c => c.announcement.startsAt = 'invalid']) { const c = draft(); mutate(c); assert.throws(() => model.validateBoardConfiguration(c)); }
});
test('all screens share deterministic weighted rotation; disabled slides never rotate in', () => {
  const c = draft(); c.slides.forEach((s, i) => s.enabled = i < 2); c.slides[1].seconds = 10;
  for (const [time, expected] of [[0,'equipment'],[19999,'equipment'],[20000,'duty'],[29999,'duty'],[30000,'equipment'],[50000,'duty']]) assert.equal(model.boardSlideAt(time, c), expected);
  c.slides.reverse(); assert.equal(model.boardSlideAt(0, c), 'duty');
  for (let time = 0; time < 90000; time += 333) assert.ok(['equipment','duty'].includes(model.boardSlideAt(time, c)));
});
test('scheduled notices begin and expire exactly, without network reads or acknowledgements', () => {
  const c = draft(); c.announcement = { title: 'Fixture', body: 'Not operational data', startsAt: '2026-10-01T12:00:00.000Z', endsAt: '2026-10-01T13:00:00.000Z', enabled: true };
  assert.deepEqual(model.validateBoardConfiguration(c), c);
  for (const [at, visible] of [['11:59:59',false],['12:00:00',true],['12:59:59',true],['13:00:00',false]]) assert.equal(model.announcementIsActive(c, Date.parse(`2026-10-01T${at}Z`)), visible);
  c.announcement.enabled = false; assert.equal(model.announcementIsActive(c, Date.parse('2026-10-01T12:30:00Z')), false);
  c.announcement.startsAt = c.announcement.endsAt; assert.throws(() => model.validateBoardConfiguration(c));
});
test('real PostgreSQL persists configuration, preserves unrelated data, and restores previous setup as a new revision', async () => {
  const h = await harness(); try {
    await h.pg.query("INSERT INTO system_meta(key,value) VALUES('unrelated','keep')");
    const initial = await h.request('GET').then(r => r.json()); assert.equal(initial.saved.revision, ''); assert.equal(h.stats.writes, 0);
    assert.equal((await h.request('PUT', { revision: '', configuration: model.defaultBoardConfiguration() }).then(r => r.json())).saved.revision, ''); assert.equal(h.stats.writes, 0);
    const first = await h.request('PUT', { revision: '', configuration: draft() }).then(r => r.json());
    assert.ok(first.saved.revision); assert.deepEqual(first.saved.previous, model.defaultBoardConfiguration());
    assert.deepEqual(await store.readBoardConfiguration(h.db), first.saved);
    const noOp = await h.request('PUT', { revision: first.saved.revision, configuration: draft() }).then(r => r.json()); assert.equal(noOp.saved.revision, first.saved.revision); assert.equal(h.stats.writes, 1);
    const restored = await h.request('PUT', { revision: first.saved.revision, configuration: first.saved.previous }).then(r => r.json());
    assert.notEqual(restored.saved.revision, first.saved.revision); assert.deepEqual(restored.saved.configuration, model.defaultBoardConfiguration()); assert.deepEqual(restored.saved.previous, draft());
    assert.equal((await h.pg.query("SELECT value FROM system_meta WHERE key='unrelated'")).rows[0].value, 'keep');
    assert.match(JSON.stringify((await h.pg.query('EXPLAIN SELECT value FROM system_meta WHERE key=$1 LIMIT 1', [store.boardConfigurationKey])).rows), /system_meta_pkey/);
  } finally { await h.close(); }
});
test('unauthorized, conflicting, invalid and failed saves never replace published settings', async () => {
  const h = await harness(); try {
    for (const role of ['member', 'anonymous', 'revoked', 'other-department']) for (const method of ['GET','PUT']) assert.equal((await h.request(method, method === 'PUT' ? { configuration: draft(), revision: '' } : undefined, role)).status, 403);
    assert.equal(h.stats.reads, 0); assert.equal(h.stats.writes, 0);
    const outcomes = await Promise.all([20,30].map(seconds => { const c = draft(); c.slides[0].seconds = seconds; return h.request('PUT', { revision: '', configuration: c }); }));
    assert.deepEqual(outcomes.map(r => r.status).sort(), [200,409]);
    const saved = await store.readBoardConfiguration(h.db);
    h.stats.failNext = true; const c = draft(); c.slides[0].seconds = 40;
    assert.equal((await h.request('PUT', { revision: saved.revision, configuration: c })).status, 503);
    assert.deepEqual(await store.readBoardConfiguration(h.db), saved);
    for (const payload of [null, {}, { revision: saved.revision, configuration: { ...draft(), slides: [] } }]) assert.equal((await h.request('PUT', payload)).status, 400);
    assert.deepEqual(await store.readBoardConfiguration(h.db), saved);
  } finally { await h.close(); }
});
test('settings ride the existing private change feed with no new polling or dispatch delay', () => {
  const source = path => readFileSync(path, 'utf8');
  assert.match(source('supabase/migrations/20260915175213_operational_change_signals.sql'), /'system_meta','chief'/);
  assert.match(source('app/api/chief-board/route.ts'), /configuration-revision/);
  assert.match(source('app/api/board-configuration/route.ts'), /private, no-store/);
  assert.doesNotMatch(source('app/board-manager.tsx'), /setInterval/);
  assert.match(source('app/operations-board.tsx'), /fallbackMs: 30_000/);
  assert.match(source('app/payroll-app.tsx'), /RESPOND_ALERT_DURATION_SECONDS/);
});
test('board refresh returns changed configuration, omits unchanged payload and isolates a corrupt setting', async () => {
  const h = await harness(); try {
    await h.pg.exec("CREATE TABLE chief_board_items(id text,item_type text,title text,body text,officer_employee_id text,officer_name text,event_date text,starts_at text,ends_at text,expires_at text,invite_status text,created_by text,created_at text,active integer)");
    const api = compile('app/api/chief-board/route.ts', {
      '../../../db/bootstrap': { ensureDatabase: async () => h.db },
      '../../server-permissions': { hasPermission: async () => false, hasAnyPermission: async () => true },
      '../../portal-storage': { getPortalStorage: () => null }, '../../board-officers': {},
      '../../board-links-store': { readBoardLinks: async () => ({ revision: '', sections: {} }) },
      '../../board-links': { boardLinksSignal: settings => ({ settings, confirmed: true, canEdit: false }) },
      '../../board-configuration-store': store,
    });
    const saved = await store.saveBoardConfiguration(h.db, draft(), '', 'fixture');
    const first = await api.GET(new Request('http://localhost/api/chief-board?include-links=1')).then(r => r.json());
    assert.equal(first.boardConfiguration.saved.revision, saved.revision); assert.equal(first.boardConfiguration.saved.previous, null);
    assert.equal(first.boardConfiguration.canEdit, false); assert.deepEqual(first.items, []);
    const unchanged = await api.GET(new Request('http://localhost/api/chief-board?include-links=1&configuration-revision='+saved.revision)).then(r => r.json());
    assert.equal(unchanged.boardConfiguration.saved, undefined); assert.equal(unchanged.boardConfiguration.confirmed, true);
    await h.pg.query('UPDATE system_meta SET value=$1 WHERE key=$2', ['broken',store.boardConfigurationKey]);
    const corrupt = await api.GET(new Request('http://localhost/api/chief-board?include-links=1')).then(r => r.json());
    assert.equal(corrupt.boardConfiguration.confirmed, false); assert.deepEqual(corrupt.items, []);
  } finally { await h.close(); }
});
