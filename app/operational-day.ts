const chicagoFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function addCalendarDays(value: string, count: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

export function chicagoOperationalContext(now = new Date()) {
  const parts = chicagoFormatter.formatToParts(now);
  const get = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  const calendarDate = `${get("year")}-${get("month")}-${get("day")}`;
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));
  const operationalDate = minutes < 360 ? addCalendarDays(calendarDate, -1) : calendarDate;
  const inLockGracePeriod = minutes >= 360 && minutes < 420;

  return {
    calendarDate,
    minutes,
    operationalDate,
    inLockGracePeriod,
    // From 6:00–6:59 AM, yesterday remains editable. At 7:00 AM,
    // every log before the new operational date becomes locked.
    lockBeforeDate: inLockGracePeriod ? addCalendarDays(operationalDate, -1) : operationalDate,
  };
}

export function dailyLogDateIsAutoLocked(logDate: string, now = new Date()) {
  return logDate < chicagoOperationalContext(now).lockBeforeDate;
}
