import { buildPayrollReference, type PayrollReference } from "./payroll-reference-export.ts";
import type { PayAdjustment, SubmissionDocument } from "./payroll-submission.ts";

// Separate adjustment rows: never feed previous-period hours back through the
// receiving period's overtime threshold or its newer rates.
export function adjustmentExportRows(adjustments: PayAdjustment[]): Array<Array<string | number>> {
  if (!adjustments.length) return [];
  return [[], ["PRIOR-PERIOD ADJUSTMENTS — administrator approved"],
    ["Employee", "Original period", "Receiving period", "Adjustment ID", "Original work dates/categories", "Hours previously accounted for → actual", "Approval reason", "Approved by", "Approved at", "", "Pay adjustment"],
    ...adjustments.map(a => [a.employeeName, a.sourcePeriod, a.targetPeriod, a.id, a.changes.map(c => `${c.workDate} ${c.category}`).join("; "), a.changes.map(c => `${c.submittedHours} → ${c.actualHours}`).join("; "), a.note ?? "", a.approvedBy ?? "", a.approvedAt ?? "", "", (a.deltaCents / 100).toFixed(2)])];
}
export function withApprovedAdjustments(report: PayrollReference, adjustments: PayAdjustment[]): PayrollReference {
  if (new Set(adjustments.map(a => a.id)).size !== adjustments.length) throw new Error("Duplicate adjustment in payroll export. No file was created.");
  const extra = adjustments.map(a => {
    const cells: Array<string | number> = report.headers.map(() => 0);
    cells[0] = `${a.employeeName} (prior-period adjustment)`;
    cells[1] = `${a.sourcePeriod} · ${a.changes.map(c => c.workDate).filter((d, i, dates) => dates.indexOf(d) === i).join(", ")}`;
    cells[cells.length - 2] = "";
    cells[cells.length - 1] = a.deltaCents / 100;
    return { kind: "adjustment", cells };
  });
  const gross = (Math.round(report.gross * 100) + adjustments.reduce((sum, a) => sum + a.deltaCents, 0)) / 100;
  const totals = [...report.totals]; totals[totals.length - 1] = gross;
  return { ...report, rows: [...report.rows, ...extra], totals, gross };
}
export function submittedPayrollReference(document: SubmissionDocument) {
  const report = withApprovedAdjustments(buildPayrollReference({ startDate: document.period, endDate: document.end, status: "Fixed submitted copy" }, document.employees.filter(e => document.entries.some(row => row.employeeId === e.id)).map(employee => ({ employee, entries: document.entries.filter(e => e.employeeId === employee.id) })), document.settings), document.incoming);
  if (Math.round(report.gross * 100) !== document.grossCents) throw new Error("Submitted payroll totals do not match the saved copy. Review is required; no replacement total was exported.");
  return { ...report, title: `SUBMITTED COPY · ${report.title}` };
}
export function submittedExportRows(document: SubmissionDocument): Array<Array<string | number>> {
  const report = submittedPayrollReference(document);
  const rows: Array<Array<string | number>> = [
    [`SUBMITTED COPY ${document.period} through ${document.end}`],
    [`Recorded staffing through ${document.staffingThrough}; schedule estimates after that date; callbacks/work details through ${document.extrasThrough}`],
    report.headers,
    ...report.rows.filter(row => row.kind !== "adjustment").map(row => row.cells),
  ];
  rows.push(...adjustmentExportRows(document.incoming), [], ["SUBMITTED GROSS INCLUDING APPROVED CARRYOVERS", "", "", "", "", "", "", "", "", "", (document.grossCents / 100).toFixed(2)], [], ["SOURCE DETAIL"], ["Employee", "Work date", "Category", "Hours", "Basis", "Source record IDs"]);
  for (const entry of document.entries) rows.push([document.employees.find(e => e.id === entry.employeeId)?.name ?? entry.employeeId, entry.workDate, entry.category, entry.hours, entry.basis, entry.sourceIds.join("; ")]);
  return rows;
}
export function payrollCsv(rows: Array<Array<string | number>>) {
  return rows.map(row => row.map(cell => {
    const value = typeof cell === "string" && /^[=+@\-\t\r]/.test(cell) && !/^-?\d+(?:\.\d+)?$/.test(cell) ? `'${cell}` : String(cell);
    return `"${value.replaceAll('"', '""')}"`;
  }).join(",")).join("\r\n");
}
