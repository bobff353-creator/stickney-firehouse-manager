export function roundPayrollToCent(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round((value + Number.EPSILON * Math.max(1, value)) * 100) / 100;
}
