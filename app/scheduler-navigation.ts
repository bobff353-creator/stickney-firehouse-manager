// Both the everyday screens and detailed tools resolve into the same workspace.
export function scheduleDestination(task: string, fromTool = false) {
  if (fromTool && (task === 'requests' || task === 'trades')) return 'approvals';
  return ({ overview: 'staffing', day: 'staffing', calendar: 'calendarDetail', myshifts: 'shifts' } as Record<string, string>)[task] || task;
}

export function isScheduleWorkspaceScreen(task: string) {
  return ['shifts', 'coverage', 'requests', 'staffing', 'approvals', 'patterns', 'people', 'alerts'].includes(task);
}
