import { roundPayrollToCent } from "./payroll-rounding.ts";

export const ACTING_OFFICER_STIPEND_PER_HOUR = 1;
export const PAYROLL_PREMIUM_MULTIPLIER = 1.5;

export type PayrollCategory = "shift" | "drill" | "workDetail" | "callback" | "actingOfficer" | "holiday" | "dpw";
export type PayrollEntry = { category: PayrollCategory | "dailyLogDpw"; hours: number };
export type PayLine = { key: string; label: string; hours: number; rate: number; amount: number; multiplier: number; additive?: boolean };
export type PayrollRules = { overtimeThreshold: number; actingOfficerPremium: number; dpwMultiplier: number };
export type PayrollEmployee = { rank: string; regularRate: number; isDpw?: number | boolean };

// One category allocation for timesheets, payroll totals, and exported pay rows.
// AO is an allowance on worked hours, never another set of worked hours.
export function summarizePayroll(employee: PayrollEmployee, entries: PayrollEntry[], rules: PayrollRules) {
  const totals: Record<PayrollCategory, number> = { shift: 0, drill: 0, workDetail: 0, callback: 0, actingOfficer: 0, holiday: 0, dpw: 0 };
  for (const entry of entries) {
    const category = entry.category === "dailyLogDpw" ? "dpw" : entry.category;
    totals[category] += entry.hours;
  }
  // Stored hours support hundredths; normalize summation before splitting OT.
  for (const key of Object.keys(totals) as PayrollCategory[]) totals[key] = roundPayrollToCent(totals[key]);
  const baseHours = roundPayrollToCent(totals.shift + totals.drill + totals.callback);
  const hours = roundPayrollToCent(baseHours + totals.workDetail + totals.holiday + totals.dpw);
  const overtimeHours = employee.isDpw ? 0 : roundPayrollToCent(Math.max(baseHours - rules.overtimeThreshold, 0));
  const regularHours = employee.isDpw ? 0 : roundPayrollToCent(baseHours - overtimeHours);
  const workDetailHours = employee.isDpw ? 0 : totals.workDetail;
  const holidayHours = employee.isDpw ? 0 : totals.holiday;
  const dpwHours = employee.isDpw ? hours : totals.dpw;
  const premiumRate = employee.regularRate * PAYROLL_PREMIUM_MULTIPLIER;
  const lines: PayLine[] = [
    { key: "regular", label: "Regular (shift, drill, callback)", hours: regularHours, rate: employee.regularRate, multiplier: 1, amount: 0 },
    { key: "workDetail", label: "Work Detail", hours: workDetailHours, rate: employee.regularRate, multiplier: 1, amount: 0 },
    { key: "overtime", label: "Overtime", hours: overtimeHours, rate: premiumRate, multiplier: PAYROLL_PREMIUM_MULTIPLIER, amount: 0 },
    { key: "holiday", label: "Holiday", hours: holidayHours, rate: premiumRate, multiplier: PAYROLL_PREMIUM_MULTIPLIER, amount: 0 },
    { key: "dpw", label: "DPW", hours: dpwHours, rate: premiumRate, multiplier: PAYROLL_PREMIUM_MULTIPLIER, amount: 0 },
    { key: "actingOfficer", label: "Acting Officer allowance", hours: totals.actingOfficer, rate: rules.actingOfficerPremium, multiplier: 1, additive: true, amount: 0 },
  ].map(line => ({ ...line, amount: roundPayrollToCent(line.hours * line.rate) }));
  const gross = roundPayrollToCent(lines.reduce((sum, line) => sum + line.amount, 0));
  return { hours, regularHours, overtimeHours, workDetailHours, holidayHours, actingHours: totals.actingOfficer, dpwHours, gross, lines, totals };
}
