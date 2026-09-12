import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { recentCallRows, seedRecentCalls } from './helpers/recent-call-data.mjs';

test('Respond history returns the latest 25 completed calls, not active calls or the whole history', async () => {
  const pg = new PGlite();
  try {
    await seedRecentCalls(pg);
    const rows = await recentCallRows(pg);
    assert.equal(rows.length, 25);
    assert.deepEqual(rows.map(row => row.reportNumber), Array.from({length:25}, (_,i) => `TEST-${40-i}`));
    assert.equal((await pg.query('SELECT count(*) count FROM daily_log_calls')).rows[0].count, 42, 'history is never deleted');
    await pg.exec("DELETE FROM daily_log_calls WHERE sort_order > 3");
    assert.equal((await recentCallRows(pg)).length, 3, 'show the true count when fewer than 25 exist');
    await pg.exec('DELETE FROM daily_log_calls');
    assert.deepEqual(await recentCallRows(pg), []);
  } finally { await pg.close(); }
});
