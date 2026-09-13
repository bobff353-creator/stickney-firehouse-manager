import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {portalParentPage,portalPages} from '../app/portal-navigation.ts';
const source=file=>readFileSync(new URL('../app/'+file,import.meta.url),'utf8');
test('parent destinations are predictable and never grant access',()=>{
  assert.equal(portalParentPage('Timesheets','Dashboard',portalPages),'Payroll');
  assert.equal(portalParentPage('Timesheets','My Timesheet',['My Timesheet','Timesheets']),'My Timesheet');
  assert.equal(portalParentPage('Scheduling','Dashboard',portalPages),'Dashboard');
  assert.equal(portalParentPage('Employee Contacts','Dashboard',portalPages),'Employees');
});
test('view memory is bounded, identity-scoped and contains no persisted operational data',()=>{
  const state=source('workspace-view-state.tsx');
  assert.match(state,/memory.size >= 64/);
  assert.doesNotMatch(state,/localStorage|sessionStorage|fetch\(/);
  assert.match(source('payroll-app.tsx'),/WorkspaceViewMemory key=\{`\$\{access.identity\}/);
  assert.match(source('inventory-live.tsx'),/WorkspaceViewMemory key=\{access.identity\}/);
});
test('save and preview guidance preserves workflow distinctions',()=>{
  assert.match(source('station-scheduler.tsx'),/if \(previewMember \|\| testMember\)/);
  assert.match(source('station-scheduler.tsx'),/disabled=\{previewMember \|\| Boolean\(testMember\)\}/);
  assert.match(source('station-scheduler.tsx'),/"submitTrade", "respondTrade"/);
  assert.match(source('inventory-operations.tsx'),/Show remaining items/);
  assert.match(source('field-preplans.tsx'),/Advanced publication is a separate review step/);
});
