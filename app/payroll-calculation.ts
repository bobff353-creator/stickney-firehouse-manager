export const ACTING_OFFICER_STIPEND_PER_HOUR = 1;

export function calculateGrossPay(input: {
  regularHours: number;
  overtimeHours: number;
  holidayHours: number;
  actingOfficerHours: number;
  dpwHours: number;
  regularRate: number;
  overtimeRate: number;
  holidayRate: number;
  dpwMultiplier: number;
}) {
  const basePay = input.regularHours * input.regularRate;
  const overtimePay = input.overtimeHours * input.overtimeRate;
  const holidayPay = input.holidayHours * input.holidayRate;
  const actingOfficerPay = input.actingOfficerHours * ACTING_OFFICER_STIPEND_PER_HOUR;
  const dpwPay = input.dpwHours * input.regularRate * input.dpwMultiplier;
  const gross = basePay + overtimePay + holidayPay + actingOfficerPay + dpwPay;
  if (!Number.isFinite(gross) || gross <= 0) return 0;
  return Math.ceil((gross - Number.EPSILON) * 100) / 100;
}
