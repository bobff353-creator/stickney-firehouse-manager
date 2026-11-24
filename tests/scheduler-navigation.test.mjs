import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleDestination, isScheduleWorkspaceScreen } from '../app/scheduler-navigation.ts';

test('member request navigation stays personal while admin tool review opens approvals', () => {
  assert.equal(scheduleDestination('requests'), 'requests');
  assert.equal(scheduleDestination('requests', true), 'approvals');
  assert.equal(scheduleDestination('trades', true), 'approvals');
});
test('tool calendars and daily staffing return to the same workspace', () => {
  for (const task of ['overview', 'day']) {
    const screen = scheduleDestination(task, true);
    assert.equal(screen, 'staffing');
    assert.equal(isScheduleWorkspaceScreen(screen), true);
  }
});
test('detailed tools keep distinct destinations without becoming another workspace', () => {
  assert.equal(scheduleDestination('calendar', true), 'calendarDetail');
  assert.equal(isScheduleWorkspaceScreen('calendarDetail'), false);
  for (const task of ['setup', 'roster', 'shiftTypes', 'distribution', 'availability', 'safety', 'confirmation', 'reminders', 'openAdmin']) {
    assert.equal(scheduleDestination(task, true), task);
    assert.equal(isScheduleWorkspaceScreen(task), false);
  }
});
