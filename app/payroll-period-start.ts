export function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function currentPeriodStart() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();
  if (day >= 26) return isoDate(year, month, 26);
  if (day >= 11) return isoDate(year, month, 11);
  const previous = new Date(year, month - 1, 26);
  return isoDate(previous.getFullYear(), previous.getMonth(), 26);
}
