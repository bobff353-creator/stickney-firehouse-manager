import { payrollExportRows } from "./payroll-export.ts";
import type { PayAdjustment, SubmissionDocument } from "./payroll-submission.ts";

// Separate adjustment rows: never feed previous-period hours back through the
// receiving period's overtime threshold or its newer rates.
export function adjustmentExportRows(adjustments: PayAdjustment[]): Array<Array<string | number>> {
  if (!adjustments.length) return [];
  return [[], ["PRIOR-PERIOD ADJUSTMENTS — administrator approved"],
    ["Employee", "Original period", "Receiving period", "Adjustment ID", "Original work dates/categories", "Hours previously accounted for → actual", "Approval reason", "Approved by", "Approved at", "", "Pay adjustment"],
    ...adjustments.map(a => [a.employeeName, a.sourcePeriod, a.targetPeriod, a.id, a.changes.map(c => `${c.workDate} ${c.category}`).join("; "), a.changes.map(c => `${c.submittedHours} → ${c.actualHours}`).join("; "), a.note ?? "", a.approvedBy ?? "", a.approvedAt ?? "", "", (a.deltaCents / 100).toFixed(2)])];
}
export function submittedExportRows(document: SubmissionDocument): Array<Array<string | number>> {
  const rows: Array<Array<string | number>> = [
    [`SUBMITTED COPY ${document.period} through ${document.end}`],
    [`Recorded staffing through ${document.staffingThrough}; schedule estimates after that date; callbacks/work details through ${document.extrasThrough}`],
    ["Name", "Rank", "Shift", "Drill", "Work Detail", "Call Back", "Acting Officer", "Holiday", "Total", "Rate", "Pay"],
  ];
  for (const employee of document.employees) {
    const entries = document.entries.filter(e => e.employeeId === employee.id);
    if (entries.length) rows.push(...payrollExportRows(employee, entries, document.settings.overtimeThreshold, document.settings.dpwMultiplier));
  }
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
