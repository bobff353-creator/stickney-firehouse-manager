import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { summarizePayroll } from '../app/payroll-calculation.ts';
import { buildPayrollReference } from '../app/payroll-reference-export.ts';
import { employeeGrossCents } from '../app/payroll-submission.ts';
import { submittedPayrollReference, withApprovedAdjustments } from '../app/payroll-submission-export.ts';
import { payrollExcelBytes } from '../app/payroll-excel.ts';

const employee = { id: 'fictional-release', name: 'Fictional Release Member', rank: 'Lieutenant', payScaleId: 'fictional', regularRate: 23.51, overtimeRate: 99, holidayRate: 99, isDpw: 0 };
const settings = { overtimeThreshold: 10, dpwMultiplier: 1.5, actingOfficerPremium: 1 };
const entries = ['shift', 'callback', 'workDetail', 'holiday', 'actingOfficer', 'dailyLogDpw'].map((category, index) => ({ id: `fictional-${index}`, employeeId: employee.id, workDate: '2026-09-23', category, hours: 6 }));

test('early submissions use current live payroll math for work detail, DPW and half-cent rates', () => {
  for (const isDpw of [0, 1]) {
    const member = { ...employee, isDpw };
    assert.equal(employeeGrossCents(member, entries, settings), Math.round(summarizePayroll(member, entries, settings).gross * 100));
  }
  assert.equal(employeeGrossCents(employee, entries.filter(e => e.category === 'workDetail'), settings), 14106);
});

test('approved negative carry-forward remains dollars in saved Excel, never hours-times-rate', async () => {
  const base = buildPayrollReference({ startDate: '2026-09-26', endDate: '2026-10-10', status: 'draft' }, [{ employee, entries }], settings);
  const adjustment = { id: 'fictional-adjustment', employeeName: employee.name, sourcePeriod: '2026-09-11', targetPeriod: '2026-09-26', deltaCents: -8000, changes: [{ workDate: '2026-09-24', category: 'shift', submittedHours: 6, actualHours: 2 }] };
  const report = withApprovedAdjustments(base, [adjustment]);
  assert.equal(report.gross, (Math.round(base.gross * 100) - 8000) / 100);
  assert.equal(report.workedHours, base.workedHours);
  assert.throws(() => withApprovedAdjustments(base, [adjustment, adjustment]), /Duplicate adjustment/);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await payrollExcelBytes(report, [['Fictional audit detail']]));
  const row = workbook.getWorksheet('Payroll').getRow(report.rows.length + 2);
  assert.equal(row.getCell(report.headers.length).value, -80);
  assert.equal(row.getCell(report.headers.length - 2).value, 0);
  assert.ok(workbook.getWorksheet('Submission audit'));
  assert.equal(workbook.getWorksheet('Payroll').getRow(report.rows.length + 4).getCell(report.headers.length).value.result, report.gross);
});

test('submitted export uses frozen sources and refuses a mismatched saved gross', () => {
  const sourceEntries = entries.filter(e => e.category !== 'dailyLogDpw');
  const document = { period: '2026-09-11', end: '2026-09-25', employees: [employee], entries: sourceEntries, settings, incoming: [], grossCents: employeeGrossCents(employee, sourceEntries, settings) };
  assert.equal(submittedPayrollReference(document).gross, document.grossCents / 100);
  assert.throws(() => submittedPayrollReference({ ...document, grossCents: document.grossCents + 1 }), /do not match/);
});
