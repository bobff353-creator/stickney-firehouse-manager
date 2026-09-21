import test from 'node:test';
import assert from 'node:assert/strict';
import { portalPages } from '../app/portal-navigation.ts';
import { matchesWorkspace, workspaceHelp } from '../app/workspace-help.ts';
import { availableAdminTasks } from '../app/admin-tasks.ts';

test('every permitted screen has specific save and notification guidance', () => {
  assert.deepEqual(Object.keys(workspaceHelp).sort(), [...portalPages].sort());
  for (const [page, help] of Object.entries(workspaceHelp)) {
    assert.ok(help.save.length > 35, page);
    assert.ok(help.notify.length > 35, page);
    for (const related of help.related ?? []) assert.ok(portalPages.includes(related), related);
  }
});
test('crew vocabulary finds the actual tools without inventing new modules', () => {
  for (const [query, page] of [['calendar','Scheduling'],['airpack','Inventory'],['medication','Inventory'],['maintenance','Inventory'],['hydrant','Field Preplans'],['sop','Policies'],['handoff','Daily Log'],['phone notifications','Respond Device Modes']]) {
    assert.ok(matchesWorkspace(page, query), `${query}: ${page}`);
  }
  assert.equal(matchesWorkspace('Payroll', 'hydrant'), false);
  assert.equal(matchesWorkspace('Inventory', 'meds nonexistent'), false);
  assert.ok(matchesWorkspace('Scheduling', '  CALENDAR   TRADE  '));
});
test('help setup links obey both permissions and visible pages', () => {
  assert.deepEqual(availableAdminTasks([], portalPages), []);
  assert.deepEqual(availableAdminTasks(['scheduling.manage'], ['Daily Log']), []);
  const tasks = availableAdminTasks(['scheduling.manage'], ['Scheduling']);
  assert.ok(tasks.some(task => task.id === 'reminders'));
  assert.ok(tasks.every(task => task.page === 'Scheduling'));
});
