export type ServiceSchedule = { last_serviced_date: string | null; service_interval_months: number | null; service_reminder_months: number | null };
type Source = Record<string, unknown>;

export function serviceToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= "1900-01-01" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

/** Calendar months, clamped to the target month's last day. No DST or 30-day approximation. */
export function addServiceMonths(date: string, months: number) {
  if (!validDate(date) || !Number.isInteger(months)) throw new Error("Enter a valid service date and whole months.");
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  const result = target.toISOString().slice(0, 10);
  if (!validDate(result)) throw new Error("The service date is outside the supported calendar range.");
  return result;
}

export function serviceScheduleInput(source: Source, today = serviceToday()): ServiceSchedule {
  if (!source || typeof source !== "object" || Array.isArray(source)) throw new Error("Review the service schedule fields.");
  const last = source.last_serviced_date == null ? "" : String(source.last_serviced_date).trim();
  if (last && (!validDate(last) || last > today)) throw new Error("Last serviced must be a valid date on or before today.");
  const interval = source.service_interval_months;
  if (interval == null || interval === "") return { last_serviced_date: last || null, service_interval_months: null, service_reminder_months: null };
  if (!/^[0-9]+$/.test(String(interval)) || Number(interval) < 1 || Number(interval) > 600) throw new Error("Choose a service interval from 1 to 600 whole months.");
  if (!last) throw new Error("Enter Last serviced to calculate the next service date.");
  const reminder = source.service_reminder_months;
  if (reminder == null || !/^[0-9]+$/.test(String(reminder)) || Number(reminder) > 120 || Number(reminder) >= Number(interval)) throw new Error("Choose reminder months from 0 to 120, shorter than the service interval.");
  addServiceMonths(addServiceMonths(last, Number(interval)), -Number(reminder));
  return { last_serviced_date: last, service_interval_months: Number(interval), service_reminder_months: Number(reminder) };
}

export function serviceDates(source: Source, today = serviceToday()) {
  const schedule = serviceScheduleInput(source, today);
  if (!schedule.last_serviced_date || !schedule.service_interval_months) return null;
  const due = addServiceMonths(schedule.last_serviced_date, schedule.service_interval_months);
  const reminder = addServiceMonths(due, -(schedule.service_reminder_months ?? 0));
  const status = today > due ? "overdue" : today === due ? "due" : today >= reminder ? "schedule" : "upcoming";
  return { due, reminder, status };
}

export function serviceDateLabel(date: string | null) {
  return date ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)) : "Not recorded";
}

export function serviceReminders<T extends Source>(equipment: T[], today = serviceToday()) {
  return equipment.flatMap(item => {
    if (item.retired_at || item.service_status === "retired") return [];
    try { const dates = serviceDates(item, today); return dates && dates.status !== "upcoming" ? [{ item, ...dates }] : []; }
    catch { return []; } // Invalid legacy data is labelled in its record, never treated as confirmed due.
  }).sort((a, b) => a.due.localeCompare(b.due));
}
