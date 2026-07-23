export function normalizeMilitaryTime(value: string) {
  const cleaned = value.trim().toUpperCase();
  if (!cleaned) return "";

  const clock = cleaned.match(/^(\d{1,2}):(\d{2})\s*([AP]M)?$/);
  if (clock) {
    let hours = Number(clock[1]);
    const minutes = Number(clock[2]);
    const meridiem = clock[3];
    if (minutes > 59) return null;
    if (meridiem) {
      if (hours < 1 || hours > 12) return null;
      if (meridiem === "AM") hours = hours === 12 ? 0 : hours;
      if (meridiem === "PM") hours = hours === 12 ? 12 : hours + 12;
    } else if (hours > 23) {
      return null;
    }
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  const digits = cleaned.replace(/\D/g, "");
  const padded = digits.length === 3 ? `0${digits}` : digits;
  if (padded.length !== 4) return null;
  const hours = Number(padded.slice(0, 2)), minutes = Number(padded.slice(2));
  return hours <= 23 && minutes <= 59 ? `${padded.slice(0, 2)}:${padded.slice(2)}` : null;
}

export function formatMilitaryTime(value: string) {
  const raw = value.trim();
  if (/^\d{0,4}$/.test(raw)) return raw;
  const normalized = normalizeMilitaryTime(value);
  return normalized === null ? value : normalized.replace(":", "");
}
