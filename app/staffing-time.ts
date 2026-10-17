import { addCalendarDays } from './operational-day.ts';

export class StaffingTimeError extends Error {
  constructor(message: string) { super(message); this.name = 'StaffingTimeError'; }
}
const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const offsets = new Map<string, number[]>();
function wallLabel(date: Date) {
  const parts = formatter.formatToParts(date);
  const part = (name: string) => parts.find(p => p.type === name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}
export function chicagoLocalInstant(date: string, time: string) {
  const wall = Date.parse(`${date}T${time}:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !Number.isFinite(wall) || new Date(wall).toISOString().slice(0,16) !== `${date}T${time}`) throw new StaffingTimeError('Enter a valid staffing date and HH:MM time.');
  let choices = offsets.get(date);
  if (!choices) {
    choices = [...new Set([-36,-24,-12,0,12,24,36].map(hours => {
      const sample = Date.parse(`${date}T12:00:00Z`) + hours * 3600000;
      return Date.parse(`${wallLabel(new Date(sample))}:00Z`) - sample;
    }))];
    if (offsets.size > 512) offsets.clear();
    offsets.set(date, choices);
  }
  const matches = choices.map(offset => wall - offset).filter(instant => wallLabel(new Date(instant)) === `${date}T${time}`);
  if (matches.length !== 1) throw new StaffingTimeError(`${date} ${time} is ${matches.length ? 'ambiguous during the repeated daylight-saving hour' : 'nonexistent during the daylight-saving clock change'}. The saved HH:MM fields cannot identify an exact instant; review the original time record before saving.`);
  return matches[0];
}
export function calendarWorkedHours(date: string, timeIn: string, timeOut: string) {
  const start = chicagoLocalInstant(date,timeIn);
  const endDate = timeOut <= timeIn ? addCalendarDays(date,1) : date;
  return (chicagoLocalInstant(endDate,timeOut)-start)/3600000;
}
export function staffingInterval(logDate: string, row: { timeIn?: unknown; timeOut?: unknown }) {
  const start = String(row.timeIn ?? ''), end = String(row.timeOut ?? '');
  if (!start || !end) return null;
  const startDate = start < '06:00' ? addCalendarDays(logDate, 1) : logDate;
  const endDate = end <= start ? addCalendarDays(startDate, 1) : startDate;
  return { start: chicagoLocalInstant(startDate, start), end: chicagoLocalInstant(endDate, end) };
}
export type ActingCoverage = { employeeId?: unknown; timeIn?: unknown; timeOut?: unknown; actingOfficer?: unknown; logDate?: string };
export function assertActingOfficerCoverage(logDate: string, rows: ActingCoverage[], nearby: ActingCoverage[] = []) {
  const candidates = rows.filter(row => Boolean(row.actingOfficer)).map(row => {
    const interval = staffingInterval(logDate, row);
    if (!row.employeeId || !interval) throw new StaffingTimeError('Acting Officer coverage needs an employee and complete start/end times.');
    return interval;
  });
  const existing = nearby.filter(row => row.actingOfficer).map(row => {
    const interval = staffingInterval(row.logDate!, row);
    if (!interval) throw new StaffingTimeError('Nearby Acting Officer coverage has incomplete times; review the saved log before assigning another officer.');
    return interval;
  });
  for (const [index, interval] of candidates.entries()) {
    for (const other of [...candidates.slice(index + 1), ...existing]) {
      // Half-open intervals: the outgoing officer ends exactly when relief begins.
      if (interval.start < other.end && other.start < interval.end) throw new StaffingTimeError('Acting Officer coverage overlaps. Only one acting officer may cover the department at a time; consecutive handoffs are allowed.');
    }
  }
}
