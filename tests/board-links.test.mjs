import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boardLinksHarness, model, store } from './helpers/board-links-harness.mjs';
const changed = (label = 'Department resource') => ({ title: 'Training & safety links', links: [{ id: 'fixture-link', label, url: 'https://example.org/training?course=1', note: 'Local test; never production' }] });

test('unchanged board refresh sends confirmation only, not the full list; changed revision resends settings', () => {
  const settings = model.defaultBoardLinks();
  assert.ok(model.boardLinksSignal(settings, null, true, 'now').settings);
  assert.equal(model.boardLinksSignal(settings, '', true, 'now').settings, undefined);
  settings.revision = 'saved-new';
  assert.equal(model.boardLinksSignal(settings, '', false, 'now').settings, settings);
  assert.equal(model.boardLinksSignal(settings, 'saved-new', false, 'now').canEdit, false, 'permission changes still travel with unchanged data');
});

test('all five sections have descriptive defaults; reject unsafe URLs and oversized/duplicate data', () => {
  assert.equal(model.boardLinkSections.length, 5);
  for (const section of Object.values(model.defaultBoardLinks().sections)) assert.deepEqual(model.validateBoardLinkSection(section), section);
  for (const url of ['javascript:alert(1)', 'data:text/html,a', 'http://example.org', 'https://user:pass@example.org', 'https://127.0.0.1', 'https://localhost', 'https://host.internal', 'https://example.org/a\nb', '//example.org']) assert.throws(() => model.safeBoardLinkUrl(url));
  assert.throws(() => model.validateBoardLinkSection({ ...changed(), links: Array(13).fill(changed().links[0]) }));
  assert.throws(() => model.validateBoardLinkSection({ ...changed(), links: Array(2).fill(changed().links[0]) }));
  assert.throws(() => model.validateBoardLinkSection({ ...changed(), title: '' }));
});
test('actual API saves, reads, edits and removes links using real PostgreSQL; restarts retain values', async () => {
  const h = await boardLinksHarness(); try {
    const before = await h.request('GET').then(r => r.json()); assert.equal(before.canEdit, true); assert.equal(h.stats.writes, 0);
    const response = await h.request('PUT', { id: 'news', revision: '', section: changed() }); assert.equal(response.status, 200);
    const first = (await response.json()).settings;
    assert.ok(first.revision); assert.ok(first.updatedAt); assert.deepEqual(first.sections.news, changed());
    assert.deepEqual(await store.readBoardLinks(h.db), first, 'separate reader sees durable state');
    const noOp = await h.request('PUT', { id: 'news', revision: first.revision, section: changed() }).then(r => r.json());
    assert.equal(noOp.settings.revision, first.revision); assert.equal(h.stats.writes, 1, 'no-op does not create a saved revision');
    const second = await h.request('PUT', { id: 'news', revision: first.revision, section: { title: 'Updated section', links: [] } }).then(r => r.json());
    assert.notEqual(second.settings.revision, first.revision); assert.equal(second.settings.sections.news.links.length, 0);
    assert.deepEqual(second.settings.sections.ifsi, first.sections.ifsi, 'other sections preserved');
    const raw = await h.pg.query('SELECT value FROM system_meta');
    assert.equal(JSON.parse(Buffer.from(raw.rows[0].value, 'base64')).updatedBy, 'admin@example.invalid');
    assert.deepEqual((await h.request('GET', undefined, 'member').then(r => r.json())).settings, second.settings);
  } finally { await h.close(); }
});
test('permissions gate reads/writes before settings I/O; revoked member cannot save', async () => {
  const h = await boardLinksHarness(); try {
    for (const role of ['anonymous', 'other-department', 'revoked']) assert.equal((await h.request('GET', undefined, role)).status, 403);
    assert.equal(h.stats.reads, 0);
    for (const role of ['member', 'anonymous', 'revoked']) assert.equal((await h.request('PUT', { id: 'news', revision: '', section: changed() }, role)).status, 403);
    assert.equal(h.stats.writes, 0); assert.equal(h.stats.reads, 0);
    assert.equal((await h.request('GET', undefined, 'member').then(r => r.json())).canEdit, false);
  } finally { await h.close(); }
});
test('concurrent first saves and stale revisions never overwrite another administrator', async () => {
  const h = await boardLinksHarness(); try {
    const outcomes = await Promise.all(['One', 'Two'].map(label => h.request('PUT', { id: 'news', revision: '', section: changed(label) })));
    assert.deepEqual(outcomes.map(r => r.status).sort(), [200, 409]); assert.equal(h.stats.writes, 1);
    assert.equal((await h.request('PUT', { id: 'ifsi', revision: '', section: changed() })).status, 409);
  } finally { await h.close(); }
});
test('failed writes and validation preserve previous data and saved revision', async () => {
  const h = await boardLinksHarness(); try {
    const first = (await h.request('PUT', { id: 'news', revision: '', section: changed() }).then(r => r.json())).settings;
    h.stats.failNext = true;
    assert.equal((await h.request('PUT', { id: 'news', revision: first.revision, section: changed('Another') })).status, 503);
    assert.deepEqual(await store.readBoardLinks(h.db), first);
    for (const body of [null, {}, { id: 'weather', revision: '', section: changed() }, { id: 'news', revision: first.revision, section: { ...changed(), links: [{ ...changed().links[0], url: 'javascript:alert(1)' }] } }]) assert.equal((await h.request('PUT', body)).status, 400);
    assert.equal(h.stats.writes, 1); assert.deepEqual(await store.readBoardLinks(h.db), first);
  } finally { await h.close(); }
});
test('settings lookup is indexed and existing records untouched', async () => {
  const h = await boardLinksHarness(); try {
    await h.pg.query("INSERT INTO system_meta(key,value) VALUES('unrelated','keep')");
    await h.request('PUT', { id: 'ifsi', revision: '', section: changed() });
    assert.equal((await h.pg.query("SELECT value FROM system_meta WHERE key='unrelated'")).rows[0].value, 'keep');
    assert.match(JSON.stringify((await h.pg.query('EXPLAIN SELECT value FROM system_meta WHERE key=$1 LIMIT 1', [store.boardLinksKey])).rows), /system_meta_pkey/);
  } finally { await h.close(); }
});
test('whole-record size is bounded before the signed SQL query limit can be exceeded', async () => {
  const h = await boardLinksHarness(); try {
    const section = { title: 'Large test', links: Array.from({ length: 12 }, (_, i) => ({ id: `size-${i}`, label: 'L'.repeat(120), url: 'https://example.org/'+'a'.repeat(2000), note: 'N'.repeat(240) })) };
    let revision = '';
    let limited = false;
    for (const id of ['news','fatalities','ifsi','nipsta']) {
      const response = await h.request('PUT', { id, revision, section });
      const result = await response.json();
      if (response.status === 400) { assert.match(result.error,/too long/); limited = true; break; }
      assert.equal(response.status, 200); revision = result.settings.revision;
    }
    assert.ok(limited); assert.equal((await store.readBoardLinks(h.db)).revision, revision);
  } finally { await h.close(); }
});
test('private API, existing refresh path and safety-critical call intervals stay intact', () => {
  const source = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
  const proxy = source('proxy.ts'); assert.doesNotMatch(proxy.match(/const publicApiPaths =[\s\S]*?\]\);/)[0], /board-links/); assert.match(proxy, /origin !== request.nextUrl.origin/);
  const board = source('app/operations-board.tsx'); assert.match(board, /setInterval\(\(\) => void load\(\), 30000\)/); assert.match(board, /rotationPaused \|\| linkEditor/); assert.match(board, /<ChiefBoardPanel onBoardLinks=/);
  assert.doesNotMatch(source('app/board-links-panel.tsx'), /setInterval|localStorage/);
  assert.match(source('app/api/board-links/route.ts'), /private, no-store/);
  assert.match(source('app/api/chief-board/route.ts'), /include-links/);
});
