import test from 'node:test';
import assert from 'node:assert/strict';
import { savedAvailabilityPage } from '../app/saved-availability.ts';

const filters = { period: 'month', status: 'all', query: '', from: '2026-11-01', through: '2026-11-30' };
const rows = Array.from({ length: 78 }, (_, index) => ({ id: 'fixture-'+index, availabilityDate: new Date(Date.UTC(2026, 9, 25 + index)).toISOString().slice(0, 10), status: index % 10 ? 'available' : 'unavailable', note: `Original fixture note ${index}` }));
const view = (filter = {}, page = 1, entries = rows) => savedAvailabilityPage(entries, { ...filters, ...filter }, '2026-11', '2026-11-24', page);

test('saved availability defaults to the calendar month and pages without hiding history', () => {
  const original = structuredClone(rows);
  const first = view();
  assert.equal(first.total, 78); assert.equal(first.matching, 30); assert.equal(first.rows.length, 10);
  assert.equal(first.first, 1); assert.equal(first.last, 10); assert.equal(first.pages, 3);
  const collected = [1, 2, 3].flatMap(page => view({}, page).rows);
  assert.equal(new Set(collected.map(row => row.id)).size, 30);
  assert.equal(collected.at(-1).availabilityDate, '2026-11-30');
  assert.equal(view({ period: 'all' }).matching, 78);
  assert.deepEqual(rows, original, 'Filtering must not change records, dates, IDs or notes');
});

test('status, note search and custom dates combine; upcoming includes today', () => {
  const december = savedAvailabilityPage(rows, filters, '2026-12', '2026-11-24', 1);
  assert.equal(december.matching, 31); assert.equal(december.rows[0].availabilityDate, '2026-12-01');
  const result = view({ period: 'custom', from: '2026-11-01', through: '2026-12-01', status: 'unavailable', query: '  FIXTURE NOTE  ' });
  assert.ok(result.rows.length > 0);
  assert.ok(result.rows.every(row => row.status === 'unavailable' && row.availabilityDate <= '2026-12-01'));
  assert.equal(view({ period: 'all', query: '2026-12-25' }).rows[0].availabilityDate, '2026-12-25');
  assert.equal(view({ period: 'upcoming' }).rows[0].availabilityDate, '2026-11-24');
  assert.equal(view({ query: 'no matching record' }).matching, 0);
});

test('invalid ranges show no misleading results; deleting the final page clamps safely', () => {
  for (const range of [{ from: '', through: '' }, { from: '2026-11-31', through: '2026-12-01' }, { from: '2026-12-01', through: '2026-11-01' }]) {
    const result = view({ period: 'custom', ...range });
    assert.ok(result.error); assert.equal(result.matching, 0);
  }
  const small = rows.slice(0, 11), lastPage = view({ period: 'all' }, 2, small);
  assert.equal(lastPage.rows.length, 1);
  const afterRemoval = view({ period: 'all' }, 2, small.slice(0, 10));
  assert.equal(afterRemoval.page, 1); assert.equal(afterRemoval.rows.length, 10);
  assert.equal(view({ period: 'all' }, 999).page, 8);
});
