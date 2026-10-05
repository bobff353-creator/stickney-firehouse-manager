import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { buildPayrollReference, payrollReferenceCsv } from '../app/payroll-reference-export.ts';
import { withApprovedAdjustments, submittedPayrollReference, submittedExportRows, adjustmentExportRows } from '../app/payroll-submission-export.ts';
import { validatePayrollReference, validatePayrollExportInputs } from '../app/payroll-timekeeping-review.ts';

// Execute the actual component handler with isolated browser/download boundaries.
const source = readFileSync(new URL('../app/payroll-app.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('payroll-app.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'exportPayroll') handler = node.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(handler);
const code = ts.transpileModule(handler, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const period = { startDate: '2026-10-01', endDate: '2026-10-10', status: 'draft' };
const employee = { id: 'fixture-only', name: 'Local Fixture', rank: 'Firefighter', regularRate: 20, overtimeRate: 30, holidayRate: 30 };
const settings = { overtimeThreshold: 106, actingOfficerPremium: 5, dpwMultiplier: 1.5, configured: true };
const entry = hours => ({ employeeId: employee.id, workDate: '2026-10-05', category: 'shift', hours });
const dataFor = hours => ({ period, employees: [employee], entries: [entry(hours)], settings, viewer: { canManagePayroll: true } });
function harness({ fresh = dataFor(6), submission = null, status = 200, unsaved = false } = {}) {
  const calls = [], errors = [], busy = [], downloads = [], blobs = [];
  const context = {
    data: dataFor(4), loading: false, periodStart: period.startDate,
    payrollExportInFlight: { current: false }, savingCellIds: { current: new Set() }, originalCellValues: { current: new Set(unsaved ? ['cell'] : []) }, failedCells: {},
    setError: text => errors.push(text), setExportingPayroll: value => busy.push(value), setToast: () => {},
    fetch: async url => {
      calls.push(url);
      return Response.json(url.startsWith('/api/payroll-submissions') ? { submission, incoming: [] } : fresh, { status: url.startsWith('/api/payroll-submissions') ? 200 : status });
    },
    AbortSignal, Blob, URL: { createObjectURL: blob => { blobs.push(blob); return 'blob:local'; }, revokeObjectURL: () => {} },
    window: { setTimeout: () => {} }, document: { body: { appendChild: () => {} }, createElement: () => ({ click() { downloads.push(this.download); }, remove() {} }) },
    buildPayrollReference, payrollReferenceCsv, withApprovedAdjustments, submittedPayrollReference, submittedExportRows, adjustmentExportRows, validatePayrollReference, validatePayrollExportInputs,
  };
  const run = new Function(...Object.keys(context), code + '\nreturn exportPayroll;')(...Object.values(context));
  return { run, context, calls, errors, busy, downloads, blobs };
}
test('working payroll export downloads freshly read hours instead of stale screen data', async () => {
  const h = harness(); await h.run('csv');
  assert.equal(h.downloads.length, 1); assert.equal(h.errors.length, 0);
  assert.deepEqual(h.calls, ['/api/payroll-submissions?period=2026-10-01', '/api/payroll?period=2026-10-01']);
  assert.match(await h.blobs[0].text(), /"120.00"/); assert.doesNotMatch(await h.blobs[0].text(), /"80.00"/);
  assert.deepEqual(h.busy, [true, false]); assert.equal(h.context.payrollExportInFlight.current, false);
});
test('failed, denied or mismatched fresh payroll never starts a download', async () => {
  for (const options of [{ status: 503 }, { fresh: { ...dataFor(6), viewer: { canManagePayroll: false } } }, { fresh: { ...dataFor(6), period: { ...period, endDate: '2026-10-25' } } }]) {
    const h = harness(options); await h.run('csv');
    assert.equal(h.downloads.length, 0); assert.match(h.errors[0], /Payroll export failed/); assert.equal(h.context.payrollExportInFlight.current, false);
  }
});
test('unsaved payroll edits prevent both reads and downloads', async () => {
  const h = harness({ unsaved: true }); await h.run('csv');
  assert.deepEqual(h.calls, []); assert.equal(h.downloads.length, 0); assert.match(h.errors[0], /unsaved hours/);
});
test('submitted export retains frozen hours and never substitutes working records', async () => {
  const document = { schemaVersion: 1, period: period.startDate, end: period.endDate, staffingThrough: period.endDate, extrasThrough: period.endDate,
    employees: [employee], entries: [{ ...entry(4), basis: 'recorded', sourceIds: ['fixture-source'] }], settings, incoming: [], grossCents: 8000 };
  const h = harness({ submission: { document } }); await h.run('csv');
  assert.equal(h.errors.length, 0); assert.equal(h.calls.length, 1); assert.match(h.downloads[0], /Submitted/);
  assert.match(await h.blobs[0].text(), /"80.00"/); assert.doesNotMatch(await h.blobs[0].text(), /"120.00"/);
});
test('unmapped source rows cannot silently disappear from a working export', async () => {
  const h = harness({ fresh: { ...dataFor(6), entries: [{ ...entry(6), employeeId: 'unknown' }] } });
  await h.run('csv'); assert.equal(h.downloads.length, 0); assert.match(h.errors[0], /employee mapping/);
});
test('nonfinite source hours, invalid dates, categories and rules fail before rounding or calculation', () => {
  for (const bad of [{ hours: NaN }, { hours: Infinity }, { hours: -1 }, { workDate: '2026-02-30' }, { workDate: '2026-10-11' }, { category: 'unknown' }]) {
    assert.throws(() => validatePayrollExportInputs([employee], [{ ...entry(6), ...bad }], settings, period.startDate, period.endDate));
  }
  for (const bad of [{ configured: false }, { overtimeThreshold: NaN }, { dpwMultiplier: -1 }]) assert.throws(() => validatePayrollExportInputs([employee], [entry(6)], { ...settings, ...bad }, period.startDate, period.endDate));
  assert.doesNotThrow(() => validatePayrollExportInputs([employee], [entry(6)], settings, period.startDate, period.endDate));
});
