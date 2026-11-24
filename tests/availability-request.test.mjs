import test from 'node:test';
import assert from 'node:assert/strict';
import { availabilityRequestDates } from '../app/availability-request.ts';
test('weekday availability includes only the requested weekdays within inclusive bounds', () => {
  assert.deepEqual(availabilityRequestDates('2026-12-01','2026-12-31','weekdays',1,[1]), ['2026-12-07','2026-12-14','2026-12-21','2026-12-28']);
  const both=availabilityRequestDates('2026-12-01','2026-12-15','weekdays',1,[1,3,1]);
  assert.deepEqual(both,['2026-12-02','2026-12-07','2026-12-09','2026-12-14']);
});
test('every X days keeps the anchor across month, year and DST boundaries', () => {
  assert.deepEqual(availabilityRequestDates('2026-12-29','2027-01-07','interval',3,[]),['2026-12-29','2027-01-01','2027-01-04','2027-01-07']);
  assert.deepEqual(availabilityRequestDates('2026-03-07','2026-03-10','interval',1,[]),['2026-03-07','2026-03-08','2026-03-09','2026-03-10']);
});
test('ranges include leap days and reject empty, invalid, unbounded or oversized requests', () => {
  assert.deepEqual(availabilityRequestDates('2028-02-28','2028-03-01','range',1,[]),['2028-02-28','2028-02-29','2028-03-01']);
  for (const args of [ ['2026-02-30','2026-03-10','range',1,[]], ['2026-12-02','2026-12-01','range',1,[]], ['2026-12-01','2026-12-02','weekdays',1,[]], ['2026-12-01','2026-12-02','weekdays',1,[8]], ['2026-12-01','2026-12-02','weekdays',1,[1]], ['2026-01-01','2027-01-03','weekdays',1,[1]], ['2026-01-01','2026-05-01','range',1,[]], ['2026-12-01','2026-12-10','interval',0,[]] ]) assert.throws(()=>availabilityRequestDates(...args));
});
