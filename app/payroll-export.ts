import { ACTING_OFFICER_STIPEND_PER_HOUR, summarizePayroll, type PayrollEntry, type PayrollEmployee } from "./payroll-calculation.ts";
import { roundPayrollToCent } from "./payroll-rounding.ts";

export type PayrollExportEmployee = PayrollEmployee & { name: string; overtimeRate: number; holidayRate: number };
export type PayrollExportEntry = PayrollEntry;

export function payrollExportRows(employee: PayrollExportEmployee, entries: PayrollExportEntry[], overtimeThreshold: number, dpwMultiplier: number, actingOfficerPremium = ACTING_OFFICER_STIPEND_PER_HOUR) {
  const summary = summarizePayroll(employee, entries, { overtimeThreshold, dpwMultiplier, actingOfficerPremium });
  // Keep the familiar hour columns, but never mix different rates in one Pay row.
  const regularShift = Math.min(summary.totals.shift, summary.regularHours);
  const regularDrill = Math.min(summary.totals.drill, Math.max(0, summary.regularHours - regularShift));
  const regularCallback = roundPayrollToCent(Math.max(0, summary.regularHours - regularShift - regularDrill));
  return summary.lines.filter(line => line.hours > 0 || (line.key === "regular" && summary.lines.every(item => item.hours === 0))).map(line => [
    line.key === "regular" ? employee.name : `${employee.name} (${line.label})`,
    employee.rank,
    line.key === "regular" ? regularShift : line.key === "overtime" ? roundPayrollToCent(summary.totals.shift - regularShift) : 0,
    line.key === "regular" ? regularDrill : line.key === "overtime" ? roundPayrollToCent(summary.totals.drill - regularDrill) : 0,
    line.key === "workDetail" ? line.hours : 0,
    line.key === "regular" ? regularCallback : line.key === "overtime" ? roundPayrollToCent(summary.totals.callback - regularCallback) : 0,
    line.key === "actingOfficer" ? line.hours : 0,
    line.key === "holiday" ? line.hours : 0,
    line.key === "dpw" ? line.hours : 0,
    line.hours,
    Number(line.rate.toFixed(4)).toFixed(line.rate === roundPayrollToCent(line.rate) ? 2 : 4),
    line.amount.toFixed(2),
  ]);
}
