/** Pure presentation helpers; the authenticated server remains the authority for requests. */
export function shiftTimeLabel(start: string, end: string) {
  const normalize = (value: string) => value.includes(":") ? value.slice(0, 5) : `${value.slice(0, 2)}:${value.slice(2, 4)}`;
  const from = normalize(start);
  const to = normalize(end);
  return `${from}–${to}${to <= from ? " (ends next day)" : ""}`;
}

export function memberShiftList<T extends { employeeId: string | null; status: string; entryDate: string; startTime: string }>(slots: T[], employeeId: string | null, today: string) {
  if (!employeeId) return [];
  return slots.filter((slot) => slot.employeeId === employeeId && slot.status === "filled" && slot.entryDate >= today)
    .sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.startTime.localeCompare(b.startTime));
}

export function canRequestRole(role: string, viewer: { roles: string[]; rank: string; employeeId: string | null }) {
  // Mirrors submitClaim, including Officer/AO rank clearance. Do not infer new qualifications.
  return Boolean(viewer.employeeId) && (viewer.roles.includes(role) || (role === "Officer/AO" && /\b(chief|captain|lieutenant)\b/i.test(viewer.rank)));
}

export function shiftHasNotStarted(date: string, start: string, now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  const current = `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}`;
  const time = start.includes(":") ? start.slice(0, 5) : `${start.slice(0, 2)}:${start.slice(2, 4)}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time) && `${date}T${time}` > current;
}
