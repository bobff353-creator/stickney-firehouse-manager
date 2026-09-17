type ScheduledPerson = { id: string; employeeId: string | null; workDate: string; startTime: string; endTime: string; role: string };
/** Presentation only. Retain every role and the underlying assignment count. */
export function groupStaffingAssignments<T extends ScheduledPerson>(items: T[]) {
  const groups = new Map<string, T & { roles: string[]; assignmentCount: number }>();
  for (const item of items) {
    const key = JSON.stringify([item.employeeId || item.id, item.workDate, item.startTime, item.endTime]);
    const existing = groups.get(key);
    if (existing) {
      existing.assignmentCount += 1;
      if (item.role && !existing.roles.includes(item.role)) existing.roles.push(item.role);
    } else groups.set(key, { ...item, roles: item.role ? [item.role] : [], assignmentCount: 1 });
  }
  return [...groups.values()];
}
