import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { scheduleMonthRange, scheduleSetupSummary } from '../app/schedule-setup-model.ts';

test('month setup uses exact inclusive boundaries, including leap years and December', () => {
  assert.deepEqual(scheduleMonthRange('2026-12'), { from: '2026-12-01', through: '2026-12-31' });
  assert.equal(scheduleMonthRange('2028-02').through, '2028-02-29');
  for (const invalid of ['', '2026-13', '2026-2', '2026-00', '0000-01', '2026-12-01']) assert.equal(scheduleMonthRange(invalid), null);
});

test('loaded month summary excludes retired and out-of-month positions and never invents consent', () => {
  const data = { shiftTypes: [{ id: 'active', active: 1 }, { id: 'retired', active: 0 }], employees: [{ id: 'yes' }, { id: 'no' }], standingAssignments: [{ active: 1 }, { active: 0 }], availability: [{ employeeId: 'yes', availabilityDate: '2026-12-10', status: 'unavailable' }], slots: [
    { id: 'crew', entryDate: '2026-12-01', status: 'filled', employeeId: 'no', shiftTypeId: 'active' },
    { id: 'opening', entryDate: '2026-12-02', status: 'open', employeeId: null, shiftTypeId: 'active' },
    { id: 'retired', entryDate: '2026-12-02', status: 'open', employeeId: null, shiftTypeId: 'retired' },
    { id: 'january', entryDate: '2027-01-01', status: 'open', employeeId: null, shiftTypeId: 'active' },
  ] };
  const before = structuredClone(data), summary = scheduleSetupSummary(data, '2026-12');
  assert.equal(summary.filled, 1); assert.equal(summary.open, 1); assert.equal(summary.positions, 2);
  assert.equal(summary.recurring, 1); assert.equal(summary.submitted, 1); assert.equal(summary.blank, 1);
  assert.deepEqual(data, before);
  assert.equal(scheduleSetupSummary(data, 'invalid').positions, 0);
});

test('setup navigation cannot write records or enable notifications; distribution requires review and a confirmed result', () => {
  const guide = fs.readFileSync(new URL('../app/schedule-setup.tsx', import.meta.url), 'utf8');
  assert.ok(!/fetch\(|runAutoDistribution|saveReminderRule/.test(guide));
  for (const label of ['Keep recurring crews', 'Check submitted availability', 'Fill open positions', 'Review the saved month']) assert.ok(guide.includes(label));
  const ui = fs.readFileSync(new URL('../app/station-scheduler.tsx', import.meta.url), 'utf8');
  const screen = ui.slice(ui.indexOf('function DistributionScreen'), ui.indexOf('function RemindersScreen'));
  assert.match(screen, /reviewing &&/); assert.match(screen, /setReviewing\(false\)/);
  assert.match(screen, /Number\.isInteger\(r\.assigned\)/);
  assert.match(screen, /result &&/); assert.ok(!screen.includes('alert('));
  assert.match(screen, /onReview\(result\.from\)/);
  assert.match(screen, /disabled=\{busy \|\| !validRange \|\| !openCount\}/);
});
