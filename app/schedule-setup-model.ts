export function scheduleMonthRange(month: string): { from: string; through: string } | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [year, number] = month.split('-').map(Number);
  if (year < 1900 || year > 9998) return null;
  return { from: `${month}-01`, through: `${month}-${new Date(Date.UTC(year, number, 0)).getUTCDate()}` };
}

type SetupData = {
  shiftTypes: { id: string; active: number }[];
  slots: { id: string; entryDate: string; status: string; employeeId: string | null; shiftTypeId: string }[];
  standingAssignments: { active: number }[];
  employees: { id: string }[];
  availability: { employeeId: string; availabilityDate: string; status: string }[];
};

/** Loaded-record counts only. These counts never grant assignment eligibility. */
export function scheduleSetupSummary(data: SetupData, month: string) {
  const range = scheduleMonthRange(month);
  const active = new Set(data.shiftTypes.filter(s => s.active).map(s => s.id));
  const slots = range ? data.slots.filter(s => active.has(s.shiftTypeId) && s.entryDate >= range.from && s.entryDate <= range.through) : [];
  const submitted = new Set(range ? data.availability.filter(a => a.availabilityDate >= range.from && a.availabilityDate <= range.through).map(a => a.employeeId) : []);
  return {
    range, shifts: active.size, recurring: data.standingAssignments.filter(s => s.active).length,
    filled: slots.filter(s => s.status === 'filled' && s.employeeId).length,
    open: slots.filter(s => s.status === 'open' && !s.employeeId).length,
    submitted: data.employees.filter(e => submitted.has(e.id)).length,
    blank: data.employees.filter(e => !submitted.has(e.id)).length,
    positions: slots.length,
  };
}
