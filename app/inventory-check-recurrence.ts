export const weeklyRecurrences = ['every_week', 'first_third_saturday'] as const;
export type WeeklyRecurrence = typeof weeklyRecurrences[number];

export function weeklyRecurrenceInput(value: unknown): WeeklyRecurrence {
  if (!weeklyRecurrences.includes(value as WeeklyRecurrence)) {
    throw new Error('Choose every week or the first and third Saturdays.');
  }
  return value as WeeklyRecurrence;
}

/** Match the due Saturday in the same Chicago Monday-Sunday cycle as weekly completion. */
export function equipmentDueForCheck(item: { check_types?: unknown; weekly_recurrence?: unknown }, checkType: string, at = new Date()): boolean {
  if (!Array.isArray(item.check_types) || !item.check_types.includes(checkType)) return false;
  if (checkType !== 'weekly' || item.weekly_recurrence !== 'first_third_saturday') return true;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(at);
  const part = (name: string) => Number(parts.find(value => value.type === name)?.value);
  const weekday = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.find(value => value.type === 'weekday')?.value || '');
  const saturday = new Date(Date.UTC(part('year'), part('month') - 1, part('day') + (weekday === 0 ? -1 : 6 - weekday), 12));
  const day = saturday.getUTCDate();
  return day <= 7 || (day >= 15 && day <= 21);
}

export function weeklyRecurrenceLabel(value: unknown): string {
  return value === 'first_third_saturday' ? 'Required in weekly checks due on the first and third Saturdays of each month.' : '';
}
