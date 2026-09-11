import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adminTasks, availableAdminTasks, schedulerAdminTask, inventoryAdminDestination } from '../app/admin-tasks.ts';
import { permissionCatalog } from '../app/permissions.ts';
import { portalPages, portalPageUrl, portalPageFromSearch } from '../app/portal-navigation.ts';
const source = name => readFileSync(new URL('../app/'+name,import.meta.url),'utf8');

test('every admin task has a valid destination, current capability, and save/preview guidance', () => {
  assert.equal(new Set(adminTasks.map(task=>task.id)).size,adminTasks.length);
  const keys=permissionCatalog.map(permission=>permission.key);
  for(const task of adminTasks){
    assert.ok(portalPages.includes(task.page),task.id);
    assert.ok(task.permissions.length && task.permissions.every(key=>keys.includes(key)),task.id);
    assert.ok(task.steps.length>30 && task.preview.length>30,task.id);
    assert.ok(availableAdminTasks(task.permissions,[task.page]).includes(task),task.id);
    for(const key of task.permissions) assert.ok(!availableAdminTasks(task.permissions.filter(item=>item!==key),[task.page]).includes(task),task.id);
    assert.ok(!availableAdminTasks(task.permissions,[]).includes(task),task.id);
  }
  assert.deepEqual(availableAdminTasks([],portalPages),[]);
  assert.equal(availableAdminTasks(keys,portalPages).length,adminTasks.length);
});

test('admin task routes clear old selection and stale task intents', () => {
  const url=portalPageUrl('/','?page=policies&policy=old&adminTask=policies','Scheduling',{adminTask:'roster'});
  const params=new URLSearchParams(url.split('?')[1]);
  assert.equal(params.get('adminTask'),'roster');
  assert.equal(params.get('policy'),null);
  assert.equal(portalPageFromSearch(params.toString()),'Scheduling');
  assert.equal(new URLSearchParams(portalPageUrl('/',params.toString(),'Dashboard').split('?')[1]).has('adminTask'),false);
});

test('schedule and apparatus editor destinations are allowlisted, not external redirects', () => {
  for(const task of adminTasks.filter(task=>task.page==='Scheduling')) assert.equal(schedulerAdminTask(task.id),task.id);
  assert.equal(schedulerAdminTask('https://example.invalid'),'');
  assert.equal(inventoryAdminDestination('checks'),'/inventory?adminTask=checks');
  assert.equal(inventoryAdminDestination('apparatus'),'/inventory?adminTask=apparatus');
  assert.equal(inventoryAdminDestination('service'),'/inventory?adminTask=service');
  assert.equal(inventoryAdminDestination('https://example.invalid'),'/inventory');
  assert.match(source('inventory-live.tsx'), /if \(!access.verified \|\| adminDestinationApplied.current\) return/);
  assert.match(source('station-scheduler.tsx'), /!testMember && data.viewer.isAdmin/);
});

test('permission editing guards drafts, prevents no-op saves, and retains revision checks', () => {
  const ui=source('permission-settings.tsx');
  assert.match(ui,/useUnsavedWork\(dirty, saving\)/);
  assert.match(ui,/if \(saving \|\| !dirty \|\| needsRefresh\) return/);
  assert.match(ui,/revision: data\?\.revision/);
  assert.match(ui,/setNeedsRefresh\(confirmed\)/);
  assert.match(ui,/Discard changes/);
  assert.match(ui,/Reload saved permissions/);
  assert.match(ui,/selectedEmployee.isOwner/);
});

test('saved record preview requires readback and phone preview never impersonates a member', () => {
  const resources=source('resource-pages.tsx'), phones=source('phone-numbers.tsx');
  assert.match(resources,/const savedRecord = refreshed\?\.find/);
  assert.match(resources,/if \(savedRecord\)/);
  assert.match(resources,/could not be reloaded for preview/);
  assert.match(phones,/canEdit && editing/);
  assert.match(phones,/This does not change your account or access/);
  assert.match(phones,/ConfirmDialog/);
});

test('admin launcher remains out of member preview and always-on operational displays', () => {
  assert.match(source('payroll-app.tsx'), /!tvMode && !testMember && activeNav !== "Respond" && activeNav !== "Command Board" && <AdminTools/);
  assert.match(source('admin-tools.tsx'), /dialog.current\?\.showModal/);
  assert.match(source('admin-tools.tsx'), /onNavigate\(task.page, \{ adminTask: task.id \}\)/);
  assert.doesNotMatch(source('admin-tools.tsx'), /fetch\(|localStorage|sessionStorage/);
});

test('sticky admin save controls account for tablet bottom navigation', () => {
  assert.match(source('admin-usability.css'), /@media \(max-width:980px\) \{\s+\.admin-save-bar,\.employee-profile-form \.employee-form-footer \{ bottom:calc\(76px/);
  assert.match(source('admin-usability.css'), /\.employee-roster-card tbody \{ display:grid; grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test('wide box cards scroll inside an accessible region without clipping print output', () => {
  assert.match(source('resource-pages.tsx'), /className="box-sheet-scroll" role="region" aria-label=\{.*?\} tabIndex=\{0\}/);
  assert.match(source('admin-usability.css'), /\.box-sheet-scroll \{ max-width:100%; overflow:auto/);
  assert.match(source('admin-usability.css'), /@media print \{ \.box-sheet-scroll \{ overflow:visible; max-width:none;/);
});
