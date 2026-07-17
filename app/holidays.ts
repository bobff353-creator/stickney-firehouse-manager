export type DepartmentHoliday = { name: string; date: string; note?: string; overnightOnly?: boolean };

function iso(year: number, month: number, day: number) { return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`; }
function nthWeekday(year: number, month: number, weekday: number, nth: number) { const first = new Date(year, month - 1, 1, 12); const day = 1 + ((7 + weekday - first.getDay()) % 7) + (nth - 1) * 7; return iso(year, month, day); }
function lastWeekday(year: number, month: number, weekday: number) { const last = new Date(year, month, 0, 12); const day = last.getDate() - ((7 + last.getDay() - weekday) % 7); return iso(year, month, day); }
function easter(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(year, month, day);
}

export function departmentHolidays(year: number): DepartmentHoliday[] {
  return [
    { name: "New Year’s Day", date: iso(year, 1, 1) },
    { name: "Martin Luther King Jr. Day", date: nthWeekday(year, 1, 1, 3) },
    { name: "Presidents’ Day", date: nthWeekday(year, 2, 1, 3) },
    { name: "Easter", date: easter(year) },
    { name: "Memorial Day", date: lastWeekday(year, 5, 1) },
    { name: "Juneteenth", date: iso(year, 6, 19) },
    { name: "Independence Day", date: iso(year, 7, 4) },
    { name: "Labor Day", date: nthWeekday(year, 9, 1, 1) },
    { name: "Columbus Day", date: nthWeekday(year, 10, 1, 2) },
    { name: "Veterans Day", date: iso(year, 11, 11) },
    { name: "Thanksgiving", date: nthWeekday(year, 11, 4, 4) },
    { name: "Christmas Eve", date: iso(year, 12, 24), note: "Night shift only", overnightOnly: true },
    { name: "Christmas Day", date: iso(year, 12, 25) },
  ];
}

export function holidayForDate(date: string) { const year = Number(date.slice(0, 4)); return departmentHolidays(year).find((holiday) => holiday.date === date) ?? null; }
