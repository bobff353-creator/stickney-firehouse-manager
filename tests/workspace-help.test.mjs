import test from 'node:test';
import assert from 'node:assert/strict';
import { portalPages, portalPageLabel, portalPageFromSearch } from '../app/portal-navigation.ts';
import { matchesWorkspace, workspaceHelp, workspaceConnectionHelp } from '../app/workspace-help.ts';
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
  assert.ok(matchesWorkspace('Policies', 'policy'));
  assert.equal(matchesWorkspace('Inventory', 'meds nonexistent'), false);
  assert.ok(matchesWorkspace('Scheduling', '  CALENDAR   TRADE  '));
});

test('apparatus navigation is clear while saved Inventory links and crew search terms still work', () => {
  assert.equal(portalPageLabel('Inventory'), 'Apparatus & checks');
  assert.equal(portalPageLabel('Operations Board'), 'Live Operations');
  assert.equal(portalPageFromSearch('?display=portal&page=inventory'), 'Inventory');
  for (const query of ['apparatus checks', 'inventory', 'operations', 'equipment']) assert.ok(matchesWorkspace('Inventory', query), query);
});

test('ordinary connection guidance distinguishes browser online, saved snapshots and confirmed saves', () => {
  for (const page of ['Dashboard', 'Respond', 'Inventory', 'Scheduling', 'Field Preplans']) {
    const text = workspaceConnectionHelp(page).join(' ');
    assert.match(text, /CAD feed.*offline/);
    assert.match(text, /Online describes browser connectivity/);
    assert.match(text, /local draft is not a confirmed department save/);
  }
  for (const page of ['Training', 'Fire Inspections', 'NERIS Reporting', 'Permissions', 'Payroll']) assert.equal(workspaceConnectionHelp(page), null);
});
test('help setup links obey both permissions and visible pages', () => {
  assert.deepEqual(availableAdminTasks([], portalPages), []);
  assert.deepEqual(availableAdminTasks(['scheduling.manage'], ['Daily Log']), []);
  const tasks = availableAdminTasks(['scheduling.manage'], ['Scheduling']);
  assert.ok(tasks.some(task => task.id === 'reminders'));
  assert.ok(tasks.every(task => task.page === 'Scheduling'));
});
