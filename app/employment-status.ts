export function departmentToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (name: string) => parts.find(p => p.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function employmentStatus(employee: { active?: number | boolean; startDate?: string | null; endDate?: string | null }, today = departmentToday()) {
  if (employee.active === 0 || employee.active === false || (employee.endDate && employee.endDate < today)) return 'Ended';
  if (employee.startDate && employee.startDate > today) return 'Scheduled';
  return 'Active';
}

// Employee and profile aliases are fixed; dates are always bound parameters.
export const currentEmploymentSql = "e.active=1 AND (NULLIF(ep.start_date,'') IS NULL OR ep.start_date<=?) AND (NULLIF(ep.end_date,'') IS NULL OR ep.end_date>=?)";
