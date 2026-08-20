export type CallbackDutyRow = {
  employeeId: string | null;
  timeIn: string;
  timeOut: string;
};

export function militaryMinutes(value: string) {
  const raw = String(value ?? "").replace(/\D/g, "");
  if (!raw) return null;
  const digits = raw.padStart(4, "0").slice(-4);
  const hours = Number(digits.slice(0, 2));
  const minutes = Number(digits.slice(2));
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function operationalMinutes(value: string) {
  const minutes = militaryMinutes(value);
  if (minutes === null) return null;
  return minutes < 360 ? minutes + 1440 : minutes;
}

export function employeeWasOnDutyAtCall(row: CallbackDutyRow, callTime: string) {
  if (!row.employeeId) return false;
  const call = operationalMinutes(callTime);
  const start = operationalMinutes(row.timeIn);
  let end = operationalMinutes(row.timeOut);
  if (call === null || start === null || end === null) return false;
  if (end <= start) end += 1440;
  return call >= start && call < end;
}
