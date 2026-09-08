import assert from 'node:assert/strict';
import test from 'node:test';
import { joinedLabel } from '../app/member-start-label.ts';
test('September 7 start is yesterday on September 8 before noon', () => {
  assert.equal(joinedLabel('2026-09-07', new Date('2026-09-08T15:39:00Z')), 'Joined 1 day ago');
});
test('uses Chicago midnight, not UTC midnight or the viewing device timezone', () => {
  assert.equal(joinedLabel('2026-09-07', new Date('2026-09-08T04:59:59Z')), 'Started today');
  assert.equal(joinedLabel('2026-09-07', new Date('2026-09-08T05:00:00Z')), 'Joined 1 day ago');
});
test('calendar days stay correct over DST and year boundaries', () => {
  assert.equal(joinedLabel('2026-03-08', new Date('2026-03-09T05:01:00Z')), 'Joined 1 day ago');
  assert.equal(joinedLabel('2026-11-01', new Date('2026-11-02T06:01:00Z')), 'Joined 1 day ago');
  assert.equal(joinedLabel('2025-12-31', new Date('2026-01-02T06:01:00Z')), 'Joined 2 days ago');
});
test('future or invalid starts never claim the member started today', () => {
  assert.equal(joinedLabel('2026-09-09', new Date('2026-09-08T15:00:00Z')), 'Starts in 1 day');
  assert.equal(joinedLabel('2026-02-30'), 'Start date unavailable');
});
