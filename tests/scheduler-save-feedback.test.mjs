import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleSaveFeedback } from '../app/scheduler-save-feedback.ts';
test('saving availability is distinct from assignment and pending requests', () => {
  const availability=scheduleSaveFeedback({action:'saveAvailability'});
  assert.match(availability.message,/does not assign/);
  assert.equal(availability.next,'requests');
  assert.match(scheduleSaveFeedback({action:'submitClaim'}).message,/not assigned yet/);
  assert.match(scheduleSaveFeedback({action:'submitTrade'}).message,/until a member accepts and an administrator approves/);
  assert.match(scheduleSaveFeedback({action:'respondTrade',decision:'accept'}).message,/unchanged until approval/);
});
test('denials and removals never claim an assignment and point to the correct saved view', () => {
  assert.equal(scheduleSaveFeedback({action:'reviewClaim',decision:'denied'}).next,'approvals');
  assert.match(scheduleSaveFeedback({action:'deleteAvailability'}).message,/Existing assignments are unchanged/);
  assert.equal(scheduleSaveFeedback({action:'reviewTrade',decision:'approved'}).next,'staffing');
  assert.equal(scheduleSaveFeedback({action:'saveShiftType'}).next,'patterns');
  assert.match(scheduleSaveFeedback({action:'saveReminderRule'}).message,/does not confirm notification delivery/);
});
