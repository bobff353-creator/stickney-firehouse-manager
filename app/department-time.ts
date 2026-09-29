/** Saved timestamps display in the department's zone, regardless of device location. */
export function departmentTimestamp(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return 'Not recorded';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Not recorded';
  return new Intl.DateTimeFormat('en-US', { timeZone:'America/Chicago',dateStyle:'medium',timeStyle:'short',hourCycle:'h23' }).format(date) + ' Central';
}
