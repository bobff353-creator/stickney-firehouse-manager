import { roundPayrollToCent } from "./payroll-rounding.ts";

export const ACTING_OFFICER_STIPEND_PER_HOUR = 1;

export function workDetailRateForRank(rank: string, regularRate: number, overtimeRate: number) {
  return rank.trim().toLowerCase() === "captain" ? regularRate : overtimeRate;
}

export function calculateGrossPay(input: {
  regularHours: number;
  overtimeHours: number;
  workDetailHours: number;
  holidayHours: number;
  actingOfficerHours: number;
  dpwHours: number;
  regularRate: number;
  overtimeRate: number;
  workDetailRate: number;
  holidayRate: number;
  dpwMultiplier: number;
}) {
  const basePay = input.regularHours * input.regularRate;
  const overtimePay = input.overtimeHours * input.overtimeRate;
  const workDetailPay = input.workDetailHours * input.workDetailRate;
  const holidayPay = input.holidayHours * input.holidayRate;
  const actingOfficerPay = input.actingOfficerHours * ACTING_OFFICER_STIPEND_PER_HOUR;
  const dpwPay = input.dpwHours * input.regularRate * input.dpwMultiplier;
  const gross = basePay + overtimePay + workDetailPay + holidayPay + actingOfficerPay + dpwPay;
  return roundPayrollToCent(gross);
}
