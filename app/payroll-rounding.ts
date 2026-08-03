export function roundPayrollUpToCent(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.ceil((value - Number.EPSILON) * 100) / 100;
}
