import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSearch, searchScore, searchTerms, searchExcerpt } from '../app/search-matching.ts';

test('multiword searches match across fields in either order without accepting unrelated records', () => {
  assert.ok(searchScore('SCBA', 'Serial 1234 · Engine 2', '1234 scba'));
  assert.ok(searchScore('SCBA', 'Serial 1234 · Engine 2', 'scba 1234'));
  assert.equal(searchScore('SCBA', 'Serial 5678', 'scba 1234'), 0);
  assert.ok(searchScore('José O’Dowd', 'Lieutenant', 'jose dowd'));
  assert.ok(searchScore('José O’Dowd', 'Lieutenant', 'jose odowd'));
  assert.deepEqual(searchTerms('Section 7.1.2'), ['section', '7.1.2']);
  assert.equal(searchScore('Section 7 and 1 and 2', '', '7.1.2'), 0);
  assert.deepEqual(searchTerms('show me the hydrants Pershing'), ['hydrant', 'pershing']);
});

test('common SCBA names match without rewriting unrelated words', () => {
  assert.ok(searchScore('SCBA 12', '', 'air pack 12'));
  assert.ok(searchScore('Self-contained breathing apparatus 12', '', 'SCBA 12'));
  assert.equal(normalizeSearch('repair pack'), 'repair pack');
});

test('exact names outrank partial names and body mentions; snippets use only existing text', () => {
  const exact = searchScore('SCBA', '', 'scba');
  assert.ok(exact > searchScore('SCBA inspection', '', 'scba'));
  assert.ok(searchScore('SCBA inspection', '', 'scba') > searchScore('Policy', 'SCBA inspection', 'scba'));
  const detail = 'Existing text '.repeat(30) + 'needle: original source words' + ' tail'.repeat(80);
  const excerpt = searchExcerpt(detail, 'needle');
  assert.ok(excerpt.includes('needle: original source words'));
  assert.ok(excerpt.length < 185);
  assert.equal(searchScore('100 percent', '', '100%'), 0);
  assert.equal(searchScore('Anything', '', 'show me'), 0);
});
