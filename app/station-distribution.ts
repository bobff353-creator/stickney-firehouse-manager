import { normalizeScheduleTime } from "./schedule-time";

export type DistributionPosition = {
  id: string; role: string; entryDate: string; shiftTypeId: string;
  startTime: string; endTime: string; shiftActive: number;
};
export type DistributionAvailability = {
  employeeId: string; availabilityDate: string; status: string;
  allDay: number; startTime: string; endTime: string;
};
export type DistributionTimeOff = { employeeId: string; offDate: string };
export type DistributionConsent = {
  fromDate: string; endDate: string; shiftDates: string[];
  availability: DistributionAvailability[];
};

const dayMinutes = (date: string) => {
  const time = Date.parse(`${date}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(time)
    && new Date(time).toISOString().slice(0, 10) === date ? time / 60000 : null;
};
const dateAt = (minutes: number) => new Date(minutes * 60000).toISOString().slice(0, 10);
const minute = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

function timeWindow(date: string, startTime: string, endTime: string, allDay = 0): [number, number] | null {
  const base = dayMinutes(date);
  if (base === null) return null;
  // All day is this calendar date, not permission for the following morning.
  if (allDay === 1) return [base, base + 1440];
  const start = normalizeScheduleTime(startTime), end = normalizeScheduleTime(endTime);
  if (!start || !end) return null;
  const from = base + minute(start);
  let to = base + minute(end);
  if (to <= from) to += 1440;
  return [from, to];
}

/** Only the saved availability calendar authorizes a new automatic assignment. */
export function distributionConsent(
  position: DistributionPosition,
  employeeId: string,
  availability: DistributionAvailability[],
  timeOff: DistributionTimeOff[],
): DistributionConsent | null {
  if (position.shiftActive !== 1) return null;
  const shift = timeWindow(position.entryDate, position.startTime, position.endTime);
  if (!shift) return null;
  const base = dayMinutes(position.entryDate)!;
  const fromDate = dateAt(base - 1440), endDate = dateAt(base + 1440);
  const shiftDates = [...new Set([position.entryDate, dateAt(shift[1] - 1)])];
  if (timeOff.some(row => row.employeeId === employeeId && shiftDates.includes(row.offDate))) return null;
  const own = availability.filter(row => row.employeeId === employeeId
    && row.availabilityDate >= fromDate && row.availabilityDate <= endDate);
  const available: [number, number][] = [];
  for (const row of own) {
    const window = timeWindow(row.availabilityDate, row.startTime, row.endTime, row.allDay);
    // Invalid saved data must not grant availability or conceal an unavailable block.
    if (!window || ![0, 1].includes(row.allDay) || !["available", "unavailable"].includes(row.status)) return null;
    if (row.status === "unavailable" && window[0] < shift[1] && shift[0] < window[1]) return null;
    if (row.status === "available") available.push(window);
  }
  // Merge adjoining windows, but never fill a gap or extrapolate a repeating pattern.
  let coveredThrough = shift[0];
  for (const [start, end] of available.sort((a, b) => a[0] - b[0])) {
    if (start > coveredThrough) break;
    coveredThrough = Math.max(coveredThrough, end);
    if (coveredThrough >= shift[1]) return { fromDate, endDate, shiftDates, availability: own };
  }
  return null;
}

/** Recheck the exact calendar snapshot in the atomic save, including newly added blocks. */
export function distributionConsentGuard(consent: DistributionConsent, employeeId: string) {
  const sql = [
    "(SELECT COUNT(*) FROM station_availability av WHERE av.employee_id=? AND av.availability_date>=? AND av.availability_date<=?)=?",
  ];
  const values: (string | number)[] = [employeeId, consent.fromDate, consent.endDate, consent.availability.length];
  for (const row of consent.availability) {
    sql.push("EXISTS (SELECT 1 FROM station_availability av WHERE av.employee_id=? AND av.availability_date=? AND av.status=? AND av.all_day=? AND av.start_time=? AND av.end_time=?)");
    values.push(employeeId, row.availabilityDate, row.status, row.allDay, row.startTime, row.endTime);
  }
  sql.push(`NOT EXISTS (SELECT 1 FROM station_unavailability off WHERE off.employee_id=? AND off.off_date IN (${consent.shiftDates.map(() => "?").join(",")}))`);
  values.push(employeeId, ...consent.shiftDates);
  return { sql: sql.join(" AND "), values };
}
