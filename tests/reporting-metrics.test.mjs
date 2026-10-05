import test from 'node:test';
import assert from 'node:assert/strict';
import { trainingModules } from './helpers/training-modules.mjs';
const load = trainingModules(), metrics = load('app/reporting-metrics.ts'), model = load('app/neris/model.ts'), desk = load('app/neris/reporting-desk.ts');
test('trend windows include twelve consecutive calendar periods rather than twelve nonempty old periods', () => {
  const weeks=metrics.trendPeriodKeys('2026-10-05','weekly');assert.equal(weeks.length,12);assert.equal(weeks[0],'2026-07-20');assert.equal(weeks.at(-1),'2026-10-05');
  const months=metrics.trendPeriodKeys('2026-01-31','monthly');assert.equal(months[0],'2025-02');assert.equal(months.at(-1),'2026-01');
  assert.equal(metrics.trendPeriodKeys('2026-10-04','weekly').at(-1),'2026-09-28');
});
test('missing and malformed call times are not midnight; valid legacy clock formats remain usable', () => {
  for (const value of ['', ' ', null, '25:00', '1260', '123456', 'call at 1200', '12:01:02']) assert.equal(metrics.callHour(value), null, String(value));
  for (const [value, hour] of [['0:00', 0], ['0000', 0], ['715', 7], ['23:59', 23], ['2359', 23]]) assert.equal(metrics.callHour(value), hour);
});
test('chief report validates calendar dates, inclusive bounds and permitted coverage', () => {
  const range = (start, end) => metrics.reportRange(start, end, '2026-01-01', '2026-10-05');
  assert.deepEqual(range('2026-10-05', '2026-10-05'), { start: '2026-10-05', end: '2026-10-05' });
  for (const dates of [['2026-02-30', '2026-03-01'], ['2026-10-06', '2026-10-06'], ['2026-01-02', '2026-01-01'], ['2025-12-31', '2026-01-01'], ['', '2026-01-01']]) assert.throws(() => range(...dates));
});
test('chief report shows restricted and unavailable values and includes trustworthy definitions in CSV', () => {
  const sources = { calls: 'ready', staffing: 'unavailable', equipment: 'ready', payroll: 'restricted' }, days = [{ date: '2026-10-04', calls: 2, staffingGaps: 6, equipmentIssues: 3, overtimeHours: 8, aoHours: 4, payrollCost: 123456 }, { date: '2026-10-05', calls: 1, staffingGaps: 2, equipmentIssues: 0, overtimeHours: 5, aoHours: 2, payrollCost: 987654 }];
  const summary = metrics.chiefSummary(days, sources, '2026-10-05', '2026-10-05');
  assert.equal(summary[0].value, 1); assert.equal(summary[1].value, null); assert.equal(summary[5].value, null);
  const csv = metrics.chiefCsv(days, sources, '2026-10-05', '2026-10-05', '2026-10-05T23:00:00Z', 'https://fixture.invalid');
  for (const expected of ['restricted', 'unavailable', 'https://fixture.invalid/?display=portal&page=daily-log', 'Missing days are not proof of no activity']) assert.ok(csv.includes(expected));
  for (const secret of ['123456', '987654', '2026-10-04']) assert.ok(!csv.includes(secret));
});
test('CSV cells quote commas, embedded quotes and lines and neutralize formula prefixes', () => {
  for (const value of ['=HYPERLINK("bad")', ' +1', '\t@SUM(1)', '-2', '\uFEFF=1']) assert.ok(metrics.csvCell(value).startsWith('"\''));
  assert.equal(metrics.csvCell('a,"b"\nnext'), '"a,""b""\nnext"');
});
test('reporting desk matches exact source IDs, excludes test/archive coverage and flags multiple reports', () => {
  const report = (id, sourceId, patch = {}) => { const record = model.newReport(); record.id = id; record.data.local.cadSourceId = sourceId; Object.assign(record.data.local, patch); return record; };
  const first = report('r-1', 'CAD-001'), second = report('r-2', 'CAD-001', { status: 'Reviewed' }), archived = report('r-3', 'CAD-002'), fixture = report('r-4', 'CAD-002', { test: true }); archived.archived = true;
  const rows = desk.reportingDesk([{ id: 'CAD-001' }, { id: 'CAD-002' }, { id: 'CAD-00' }, { id: 'CAD-003' }], [first, second, archived, fixture, report('r-5', 'CAD-003', { status: 'Reviewed' })]);
  assert.equal(rows[0].state, 'Multiple local reports'); assert.equal(rows[0].reports.length, 2);
  assert.equal(rows[1].state, 'No local report'); assert.equal(rows[1].archivedCount, 1); assert.equal(rows[1].testCount, 1);
  assert.equal(rows[2].state, 'No local report'); assert.equal(rows[3].state, 'Locally reviewed');
});
