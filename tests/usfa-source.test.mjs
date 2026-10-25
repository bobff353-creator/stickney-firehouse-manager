import './helpers/feed-test-loader.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
const { loadUsfa } = await import('../app/lib/usfa-source.ts');
const { isMarkedUsfaTestRecord } = await import('../app/lib/usfa-records.ts');
const year = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric' }).format(new Date());
const record = (id, fields = {}) => ({ id, firstName: `Fictional${id}`, lastName: 'Firefighter', fdName: 'Fictional Department', fdCity: 'Preview City', stateAbbr: 'IL', deathDt: `${year}-10-14T00:00:00`, ...fields });

test('USFA screening recognizes explicit security-test markers without rejecting real surnames', () => {
  for (const value of [{ firstName: 'CisatestPocExploit' }, { name: 'CisatestB Disregard-SecurityTest' }, { fdCity: 'Cisatest' }, { lastName: 'Disregard-Poc1792826476' }]) assert.equal(isMarkedUsfaTestRecord(value), true);
  for (const value of [null, undefined, record(1), { name: 'Pat Testa', department: 'Teston Fire Department' }, { firstName: 'Lester', lastName: 'Tester' }]) assert.equal(isMarkedUsfaTestRecord(value), false);
});

test('source filters marked tests before selecting five real source records; preserves the reported annual total', async t => {
  const latest = [...Array.from({ length: 5 }, (_, i) => record(100 + i, { firstName: 'CisatestPocExploit', lastName: `Disregard-Poc${i}` })), ...Array.from({ length: 5 }, (_, i) => record(i + 1))];
  const before = structuredClone(latest), requests = [];
  t.mock.method(globalThis, 'fetch', async url => { requests.push(url); return Response.json(url.endsWith('/latest') ? latest : { total: 76 }); });
  const data = await loadUsfa();
  assert.equal(data.total, 76, 'the application must not invent a corrected annual total');
  assert.equal(data.excludedTestRecords, 5);
  assert.equal(data.items.length, 5);
  assert.deepEqual(data.items.map(item => item.id), [1, 2, 3, 4, 5]);
  for (const item of data.items) {
    assert.equal(item.name, `Fictional${item.id} Firefighter`);
    assert.equal(item.department, 'Fictional Department');
    assert.equal(item.location, 'Preview City, IL');
    assert.ok(item.url.endsWith(`details?id=${item.id}`));
  }
  assert.equal(requests.length, 2, 'screening does not add provider requests');
  assert.deepEqual(latest, before);
});

test('an all-test or unavailable source fails rather than saving test names as firefighter reports', async t => {
  t.mock.method(globalThis, 'fetch', async url => Response.json(url.endsWith('/latest') ? [record(100, { firstName: 'Cisatest' })] : { total: 1 }));
  await assert.rejects(loadUsfa(), /latest records missing/);
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }));
  await assert.rejects(loadUsfa(), /source unavailable/);
});
