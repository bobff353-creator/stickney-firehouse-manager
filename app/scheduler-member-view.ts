/** Pure presentation helpers; the authenticated server remains the authority for requests. */
export function shiftTimeLabel(start: string, end: string) {
  const normalize = (value: string) => value.includes(":") ? value.slice(0, 5) : `${value.slice(0, 2)}:${value.slice(2, 4)}`;
  const from = normalize(start);
  const to = normalize(end);
  return `${from}–${to}${to <= from ? " (ends next day)" : ""}`;
}

export function memberShiftList<T extends { employeeId: string | null; status: string; entryDate: string; startTime: string; endTime?: string }>(slots: T[], employeeId: string | null, today: string, now?: Date) {
  if (!employeeId) return [];
  return slots.filter((slot) => slot.employeeId === employeeId && slot.status === "filled" &&
    (now && slot.endTime ? shiftHasNotEnded(slot.entryDate, slot.startTime, slot.endTime, now) : slot.entryDate >= today))
    .sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.startTime.localeCompare(b.startTime));
}

export function canRequestRole(role: string, viewer: { roles: string[]; rank: string; employeeId: string | null }) {
  // Mirrors submitClaim, including Officer/AO rank clearance. Do not infer new qualifications.
  return Boolean(viewer.employeeId) && (['Extra member','Firefighter','Training/Orientation'].includes(role) || viewer.roles.includes(role));
}

export function shiftHasNotStarted(date: string, start: string, now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  const current = `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
  const time = start.includes(":") ? start.slice(0, 5) : `${start.slice(0, 2)}:${start.slice(2, 4)}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time) && `${date}T${time}` > current;
}

/** Keep an overnight assignment visible until its Central-time end, including 24-hour shifts. */
export function shiftHasNotEnded(date: string, start: string, end: string, now: Date) {
  const normalize = (value: string) => value.includes(":") ? value.slice(0, 5) : `${value.slice(0, 2)}:${value.slice(2, 4)}`;
  const from = normalize(start), through = normalize(end);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(from) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(through)) return false;
  const endDate = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(endDate.getTime()) || endDate.toISOString().slice(0, 10) !== date) return false;
  if (through <= from) endDate.setUTCDate(endDate.getUTCDate() + 1);
  return shiftHasNotStarted(endDate.toISOString().slice(0, 10), through, now);
}
