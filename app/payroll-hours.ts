export type PayrollStaffingRow = {
  employeeId?: unknown;
  timeIn?: unknown;
  timeOut?: unknown;
  shiftKey?: unknown;
  actingOfficer?: unknown;
};

export type DailyLogPayrollTotal = {
  shift: number;
  holiday: number;
  actingOfficer: number;
};

export function workedHours(timeIn: string, timeOut: string) {
  const minutes = (value: string) => {
    const [hours, mins] = value.split(":").map(Number);
    if (!Number.isInteger(hours) || !Number.isInteger(mins) || hours < 0 || hours > 23 || mins < 0 || mins > 59) return Number.NaN;
    return hours * 60 + mins;
  };
  const start = minutes(timeIn);
  const rawEnd = minutes(timeOut);
  if (!Number.isFinite(start) || !Number.isFinite(rawEnd)) return 0;
  if (start === rawEnd) return 24;
  const end = rawEnd < start ? rawEnd + 1440 : rawEnd;
  return Math.max(0, Math.round(((end - start) / 60) * 100) / 100);
}

export function dailyLogPayrollTotals(
  rows: PayrollStaffingRow[],
  holiday: { overnightOnly?: boolean } | null,
) {
  const totals = new Map<string, DailyLogPayrollTotal>();
  for (const row of rows) {
    const employeeId = String(row.employeeId ?? "");
    const hours = workedHours(String(row.timeIn ?? ""), String(row.timeOut ?? ""));
    if (!employeeId || hours <= 0) continue;
    const current = totals.get(employeeId) ?? { shift: 0, holiday: 0, actingOfficer: 0 };
    const holidayApplies = Boolean(holiday && (!holiday.overnightOnly || String(row.shiftKey ?? "") === "overnight"));
    if (holidayApplies) current.holiday += hours;
    else current.shift += hours;
    if (row.actingOfficer) current.actingOfficer += hours;
    totals.set(employeeId, current);
  }
  return totals;
}

export function dailyLogPayrollEntries(
  totals: Map<string, DailyLogPayrollTotal>,
  dpwEmployees: Set<string>,
) {
  const entries: Array<{ employeeId: string; category: "shift" | "holiday" | "actingOfficer" | "dailyLogDpw"; hours: number }> = [];
  const rounded = (hours: number) => Math.round(hours * 100) / 100;
  for (const [employeeId, hours] of totals) {
    if (dpwEmployees.has(employeeId)) {
      const dpwHours = rounded(hours.shift + hours.holiday);
      if (dpwHours > 0) entries.push({ employeeId, category: "dailyLogDpw", hours: dpwHours });
    } else {
      if (hours.shift > 0) entries.push({ employeeId, category: "shift", hours: rounded(hours.shift) });
      if (hours.holiday > 0) entries.push({ employeeId, category: "holiday", hours: rounded(hours.holiday) });
    }
    if (hours.actingOfficer > 0) entries.push({ employeeId, category: "actingOfficer", hours: rounded(hours.actingOfficer) });
  }
  return entries;
}
