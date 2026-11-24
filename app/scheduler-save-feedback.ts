export function scheduleSaveFeedback(body: Record<string, unknown>) {
  const action = String(body.action || '');
  if (action === 'saveAvailability') return { message: 'Availability saved. This does not assign or remove a shift.', next: 'requests', label: 'View saved availability' };
  if (action === 'deleteAvailability') return { message: 'Availability removed. Existing assignments are unchanged.', next: 'requests', label: 'Review saved availability' };
  if (action === 'submitClaim') return { message: 'Shift request sent. It is waiting for administrator approval; you are not assigned yet.', next: 'requests', label: 'View request status' };
  if (action === 'submitTrade') return { message: 'Trade offer posted. Your assignment stays yours until a member accepts and an administrator approves.', next: 'requests', label: 'View trade status' };
  if (action === 'respondTrade') return { message: body.decision === 'decline' ? 'Trade offer declined. Assignments are unchanged.' : 'Trade accepted and sent for administrator approval. Assignments are unchanged until approval.', next: 'requests', label: 'View trade status' };
  if (['reviewClaim', 'reviewTrade', 'reviewTimeOff'].includes(action)) return { message: body.decision === 'denied' ? 'Request denied. Assignments are unchanged.' : 'Request approved and saved. Review the affected date for coverage.', next: body.decision === 'denied' ? 'approvals' : 'staffing', label: body.decision === 'denied' ? 'Review remaining requests' : 'Review the saved day' };
  if (['assignSlot', 'clearSlot'].includes(action)) return { message: action === 'clearSlot' ? 'Position saved as open.' : 'Assignment saved to the schedule.', next: 'staffing', label: 'Review the saved day' };
  if (action === 'addDaySlot') return { message: 'Open position added. Next, assign a qualified member or leave it open for requests.', next: 'staffing', label: 'Review the new position' };
  if (action === 'saveShiftType') return { message: 'Recurring schedule saved. Review its dates and required positions before changing crews.', next: 'patterns', label: 'Review saved shift patterns' };
  if (action === 'saveReminderRule') return { message: 'Alert rule saved. Saving a rule does not confirm notification delivery.', next: 'alerts', label: 'Review saved alert rules' };
  if (action === 'saveRequestDeadline') return { message: 'Request deadline saved.', next: 'staffing', label: 'Review the saved day' };
  return { message: 'Saved to Firehouse Manager.', next: '', label: '' };
}
