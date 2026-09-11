import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { portalPages, portalPageUrl } from '../app/portal-navigation.ts';
import { portalWorkflows } from '../app/portal-workflows.ts';
const source = file => readFileSync(`app/${file}`, 'utf8');
test('every workspace has specific first-use instructions', () => {
  assert.deepEqual(Object.keys(portalWorkflows).sort(), [...portalPages].sort());
  for (const guide of Object.values(portalWorkflows)) {
    assert.ok(guide.purpose.length > 20);
    assert.ok(guide.steps.length >= 2);
    assert.ok(guide.group);
  }
});
test('search deep-links the exact document and removes unrelated record context', () => {
  assert.equal(portalPageUrl('/', '?preplan=old&edit=1', 'Policies', { policy: 'p 2' }), '/?page=policies&display=portal&policy=p+2');
  assert.equal(portalPageUrl('/', '?policy=p1', 'Box Cards', { boxCard: 'card-2' }), '/?page=box-cards&display=portal&boxCard=card-2');
  assert.equal(portalPageUrl('/', '?boxCard=old&query=old', 'Respond'), '/?page=respond&display=portal');
  assert.match(portalPageUrl('/', '', 'Employees', { query: 'Preview, Member' }), /query=Preview%2C\+Member/);
});
test('shared navigation guards access and retains bounded return context', () => {
  const code = source('payroll-app.tsx');
  assert.match(code, /if \(!visibleNav.includes\(page\)\)/);
  assert.match(code, /trail.slice\(-19\)/);
  assert.match(code, /key=\{navigationVersion\}/);
  assert.match(code, /Skip to workspace/);
  assert.doesNotMatch(code, />Portal Support<|>Version 1.1 · Support</);
});
test('employee editor has cancel, save protection, and preserved ID after partial photo failure', () => {
  const code = source('payroll-app.tsx');
  assert.match(code, /useUnsavedWork\(employeeDirty, employeeSaving\)/);
  assert.match(code, /Cancel · Back to roster/);
  assert.match(code, /setEmployeeDraft\(current => \(\{ \.\.\.current, id: employeeId \}\)\)/);
  assert.match(code, /if \(employeeSaving\) return/);
  assert.match(code, /catch \(caught\) \{ setEmployeeSaveError/);
});
test('phone deletions check server success before reporting removal', () => {
  const code = source('phone-numbers.tsx');
  assert.ok(code.indexOf('if (!response.ok) throw new Error(result.error || "Contact was not removed")') < code.indexOf('setMessage("Contact removed.")'));
  assert.match(code, /finally \{ setRemoving\(false\); \}/);
  assert.match(code, /!loading && !error &&/);
});
test('resource saves retain drafts on failure and open exact selected record', () => {
  const code = source('resource-pages.tsx');
  assert.match(code, /data.items\?\.find\(item => item.id === requested\)/);
  assert.match(code, /useUnsavedWork\(Boolean\(draft\) && JSON.stringify\(draft\) !== draftBaseline, saving\)/);
  assert.match(code, /Your edits remain here/);
  assert.match(code, /Back to \{isPolicy \? "policies" : "cards"\}/);
});
test('phone day view preserves all dates for full-period printing', () => {
  const code = source('payroll-app.tsx'), css = source('portal-usability.css');
  assert.match(code, /data-day-visible=\{allTimesheetDays/);
  assert.match(code, /data-label=\{column.label\}/);
  assert.match(css, /@media print[\s\S]*tr\[data-day-visible=false\] \{ display: table-row !important/);
});
test('empty upcoming schedule still has a readable rotation view', () => {
  assert.match(source('staffing-rotation.tsx'), /schedule\?\.upcomingShifts\?\.length \? schedule.upcomingShifts/);
});
test('record details collapse without deleting audit fields and remain printable', () => {
  assert.match(source('record-credibility.tsx'), /aria-expanded=\{expanded\}/);
  assert.match(source('record-credibility.tsx'), /hidden=\{!expanded\}/);
  assert.match(source('portal-usability.css'), /@media print[\s\S]*record-details-body\[hidden\] \{ display: block !important/);
});
test('failed account actions return to their original form and do not grant access', () => {
  const code = source('auth-gateway.tsx');
  assert.match(code, /if \(actionPendingRef.current\) return/);
  assert.match(code, /catch \{\s*setMode\(returnMode\)/);
  for (const action of ['signIn', 'activateNewUser', 'createPin', 'unlockWithPin', 'resetPin']) assert.ok(code.includes(`runAuthAction(() => ${action}(event)`));
  assert.match(source('reset-password/page.tsx'), /finally \{ setSaving\(false\); \}/);
  assert.match(source('accept-invite/page.tsx'), /finally \{ setSaving\(false\); \}/);
});
test('unavailable road and analytics reads do not render false all-clear or zero totals', () => {
  assert.doesNotMatch(source('road-closures.tsx'), /ALL ROADS OPEN/);
  assert.match(source('road-closures.tsx'), /loadError \? "STATUS UNAVAILABLE"/);
  assert.match(source('command-center.tsx'), /: data \? <>/);
});
