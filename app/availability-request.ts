import { expandAvailabilityDates } from './availability-repeat.ts';

export type AvailabilityPattern = 'range' | 'interval' | 'weekdays';
/** Dated availability only: never creates standing crews or assigned shifts. */
export function availabilityRequestDates(from: string, through: string, pattern: AvailabilityPattern, interval: number, weekdays: number[]) {
  // Reuse the existing strict date and one-year boundary validation.
  expandAvailabilityDates([from], 365, through);
  if (pattern === 'interval' && (!Number.isInteger(interval) || interval < 1 || interval > 365)) throw Error('Choose a repeat interval from 1 to 365 days.');
  if (pattern === 'interval') return expandAvailabilityDates([from], interval, through);
  if (!['range', 'weekdays'].includes(pattern)) throw Error('Choose a repeat option.');
  if (pattern === 'weekdays' && (!weekdays.length || weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6))) throw Error('Choose at least one weekday.');
  const dates: string[] = [];
  for (let time = Date.parse(from + 'T00:00:00Z'), end = Date.parse(through + 'T00:00:00Z'); time <= end; time += 86400000) {
    const date = new Date(time);
    if (pattern === 'range' || weekdays.includes(date.getUTCDay())) dates.push(date.toISOString().slice(0, 10));
    if (dates.length > 93) throw Error('This pattern exceeds 93 dates. Choose an earlier end date or save in smaller batches.');
  }
  if (!dates.length) throw Error('No selected weekdays fall within these dates. Choose a later end date or another weekday.');
  return dates;
}
