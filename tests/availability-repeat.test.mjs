import test from 'node:test';
import assert from 'node:assert/strict';
import { expandAvailabilityDates } from '../app/availability-repeat.ts';

for (const days of [1,2,3,4,5,6,7,14]) {
  test(`availability repeats every ${days} days through the inclusive end`,()=>{
    const result=expandAvailabilityDates(['2026-09-01'],days,'2026-09-29');
    assert.equal(result.length,Math.floor(28/days)+1);
    for(let i=1;i<result.length;i++) assert.equal((Date.parse(result[i])-Date.parse(result[i-1]))/86400000,days);
  });
}
test('no repeat keeps only the chosen days, sorted and deduplicated',()=>{
  assert.deepEqual(expandAvailabilityDates(['2026-09-03','2026-09-01','2026-09-03'],0,''),['2026-09-01','2026-09-03']);
});
test('overlapping patterns save each date once',()=>{
  assert.deepEqual(expandAvailabilityDates(['2026-09-01','2026-09-03'],2,'2026-09-07'),['2026-09-01','2026-09-03','2026-09-05','2026-09-07']);
});
test('handles year boundaries, leap days, and daylight-saving dates',()=>{
  assert.deepEqual(expandAvailabilityDates(['2027-12-31'],2,'2028-01-04'),['2027-12-31','2028-01-02','2028-01-04']);
  assert.deepEqual(expandAvailabilityDates(['2028-02-28'],1,'2028-03-01'),['2028-02-28','2028-02-29','2028-03-01']);
  assert.deepEqual(expandAvailabilityDates(['2026-03-07'],1,'2026-03-09'),['2026-03-07','2026-03-08','2026-03-09']);
});
test('rejects incomplete or excessive patterns instead of silently truncating',()=>{
  assert.throws(()=>expandAvailabilityDates(['2026-09-01'],2,''));
  assert.throws(()=>expandAvailabilityDates(['2026-09-01'],2,'2026-08-31'));
  assert.throws(()=>expandAvailabilityDates(['2026-02-30'],0,''));
  assert.throws(()=>expandAvailabilityDates(['2026-09-01'],1,'2027-01-01'),/93 dates/);
  assert.throws(()=>expandAvailabilityDates(['2026-09-01'],14,'2028-01-01'),/one year/);
  assert.throws(()=>expandAvailabilityDates(['2026-09-01'],0.5,'2026-10-01'));
});
