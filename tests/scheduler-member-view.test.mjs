import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../app/scheduler-member-view.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { memberShiftList, shiftTimeLabel, canRequestRole, shiftHasNotStarted } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('calendar department view changes visibility without changing edit permissions or availability privacy', async () => {
  const component = await readFile(new URL('../app/station-scheduler.tsx', import.meta.url), 'utf8');
  const calendar = component.split('function CalendarScreen(')[1].split('function DaySlotTimeEditor(')[0];
  assert.ok(calendar.includes('<option value="all">All scheduled</option>'));
  assert.ok(calendar.includes('const showAllSchedule = isAdmin || calendarScope === "all"'));
  assert.ok(calendar.includes('.filter((slot) => showAllSchedule || slot.employeeId === myId)'));
  assert.ok(calendar.includes('const visibleEntry = showAllSchedule'));
  assert.ok(calendar.includes('(showAllSchedule || slot.employeeId === myId)'));
  assert.ok(calendar.includes('.filter((row) => isAdmin || row.employeeId === myId)'));
  assert.ok(calendar.includes('{isAdmin && <AssignmentEditor'));
  assert.ok(calendar.includes('const canTrade = !isAdmin && slot.status === "filled" && slot.employeeId === myId'));
});
test('mobile navigation uses one labeled picker and scrolls only after a requested screen change', async () => {
  const component = await readFile(new URL('../app/station-scheduler.tsx', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../app/scheduler-member.css', import.meta.url), 'utf8');
  assert.ok(component.includes('aria-label="Choose scheduling screen"'));
  assert.ok(component.includes('(isAdmin ? adminTabs : employeeTabs).map(([id, label]) => <option'));
  assert.ok(component.includes('if (!navigationRequested.current) return;'));
  assert.ok(component.includes('window.matchMedia("(max-width: 700px)").matches'));
  assert.ok(component.includes('scrollIntoView({ block: "start", behavior: "instant" })'));
  assert.ok(styles.includes('.scheduler label.scheduler-mobile-picker:not(.chip) { display: none; }'));
  const mobile = styles.split('@media (max-width: 700px)')[1];
  assert.ok(mobile.includes('.scheduler .scheduler-admin-tabs { display: none; }'));
  assert.ok(mobile.includes('min-height: 44px'));
});
test('open requests exclude started shifts using Central time in summer and winter', () => {
  assert.equal(shiftHasNotStarted('2026-09-09', '0600', new Date('2026-09-09T12:00:00Z')), false);
  assert.equal(shiftHasNotStarted('2026-09-09', '18:00', new Date('2026-09-09T12:00:00Z')), true);
  assert.equal(shiftHasNotStarted('2026-12-09', '06:00', new Date('2026-12-09T12:00:00Z')), false);
  assert.equal(shiftHasNotStarted('2026-12-09', '07:00', new Date('2026-12-09T12:00:00Z')), true);
});

test('admin navigation uses daily staffing and explicit assignment saves', async () => {
  const component = await readFile(new URL('../app/station-scheduler.tsx', import.meta.url), 'utf8');
  assert.ok(component.includes('setSchedulerView("admin"); setTab("overview")'));
  assert.ok(component.includes('const [adminDayMode, setAdminDayMode] = useState(isAdmin)'));
  assert.ok(component.includes('role={adminDayMode ? "region" : "dialog"}'));
  const editor = component.split('function AssignmentEditor(')[1].split('function DaySlotTimeEditor(')[0];
  assert.ok(editor.includes('onChange={(event) => setSelected(event.target.value)}'));
  assert.ok(editor.includes('Unsaved change'));
  assert.ok(editor.includes('Save assignment'));
  assert.ok(editor.includes('action: "assignSlot"'));
  assert.ok(editor.includes('action: "clearSlot"'));
  assert.ok(component.includes('window.confirm("Remove this entire shift'));
  assert.ok(component.includes('Ready for approval ('));
  assert.ok(component.includes('Waiting for member ('));
});
test('member list scopes to filled own assignments and sorts without mutating records', () => {
  const slots = [
    { employeeId: 'me', status: 'filled', entryDate: '2026-09-11', startTime: '18:00' },
    { employeeId: null, status: 'open', entryDate: '2026-09-10', startTime: '06:00' },
    { employeeId: 'other', status: 'filled', entryDate: '2026-09-10', startTime: '06:00' },
    { employeeId: 'me', status: 'filled', entryDate: '2026-09-09', startTime: '06:00' },
    { employeeId: 'me', status: 'filled', entryDate: '2026-09-10', startTime: '06:00' },
  ];
  const original = JSON.stringify(slots);
  assert.deepEqual(memberShiftList(slots, 'me', '2026-09-10').map(s => s.entryDate), ['2026-09-10', '2026-09-11']);
  assert.deepEqual(memberShiftList(slots, null, '2026-09-10'), []);
  assert.equal(JSON.stringify(slots), original);
});
test('overnight and 24-hour shifts explicitly identify the next day', () => {
  assert.equal(shiftTimeLabel('1800', '0600'), '18:00–06:00 (ends next day)');
  assert.equal(shiftTimeLabel('06:00', '06:00'), '06:00–06:00 (ends next day)');
  assert.equal(shiftTimeLabel('06:00', '12:00'), '06:00–12:00');
});
test('open shift role filtering follows recorded clearance, not inferred firefighter eligibility', () => {
  const viewer = { employeeId: 'me', rank: 'Firefighter', roles: ['FF/Attendant'] };
  assert.equal(canRequestRole('FF/Attendant', viewer), true);
  assert.equal(canRequestRole('Officer/AO', viewer), false);
  assert.equal(canRequestRole('Officer/AO', { ...viewer, rank: 'Lieutenant' }), false);
  assert.equal(canRequestRole('Officer/AO', { ...viewer, roles: ['Officer/AO'] }), true);
  assert.equal(canRequestRole('FF/Attendant', { ...viewer, employeeId: null }), false);
});
test('part-time member navigation exposes trades and no time-off route', async () => {
  const component = await readFile(new URL('../app/station-scheduler.tsx', import.meta.url), 'utf8');
  const tabs = component.split('const employeeTabs = [')[1].split('] as const;')[0];
  for (const label of ['My shifts', 'Open shifts', 'Offer a trade', 'Accept a trade', 'My Requests']) assert.ok(tabs.includes(label));
  assert.ok(!tabs.includes('timeoff'));
  const adminTabs = component.split('const adminTabs = [')[1].split('] as const;')[0];
  assert.ok(!adminTabs.includes('timeoff'), 'part-time scheduling has no time-off navigation');
  assert.ok(component.includes('tab === "timeoff" && isAdmin'));
  assert.ok(component.includes('Send shift request'));
  assert.ok(component.includes('Requested — awaiting review'));
  assert.ok(component.includes('if (await act({ action: "submitClaim", slotId: slot.id }))'));
  assert.ok(!component.includes('scheduler-live-dot'));
  assert.ok(component.includes('t.fromEmployeeId === myId || t.acceptedByEmployeeId === myId'), 'accepted trades remain visible in My Requests');
});
