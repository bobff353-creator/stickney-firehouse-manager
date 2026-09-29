/** Read-only summaries of loaded records. These never establish assignment eligibility. */
export type CoverageSlot = { id: string; entryDate: string; shiftTypeId: string; role: string; status: string; employeeId: string | null; startTime: string; isExtra: number };
type CoverageEntry = { id: string; entryDate: string };
export type VacancyFilters = { from: string; through: string; role: string; shiftTypeId: string };

export function scheduleDateOffset(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function staffingWeek(entries: CoverageEntry[], slots: CoverageSlot[], from: string) {
  const days = Array.from({ length: 7 }, (_, offset) => ({ date: scheduleDateOffset(from, offset), shifts: 0, required: 0, filled: 0, extraFilled: 0, extraOpen: 0 }));
  const byDate = new Map(days.map(day => [day.date, day]));
  const seenEntries = new Set<string>();
  for (const entry of entries) {
    const day = byDate.get(entry.entryDate);
    if (day && !seenEntries.has(entry.id)) { day.shifts++; seenEntries.add(entry.id); }
  }
  const seenSlots = new Set<string>();
  for (const slot of slots) {
    const day = byDate.get(slot.entryDate);
    if (!day || seenSlots.has(slot.id)) continue;
    seenSlots.add(slot.id);
    const filled = slot.status === "filled" && Boolean(slot.employeeId);
    if (slot.isExtra) { if (filled) day.extraFilled++; else day.extraOpen++; }
    else { day.required++; if (filled) day.filled++; }
  }
  return days.map(day => ({ ...day, open: day.required - day.filled }));
}

export function filterOpenPositions<T extends CoverageSlot>(slots: T[], today: string, filters: VacancyFilters) {
  return slots.filter(slot => slot.status === "open" && !slot.employeeId && slot.entryDate >= today
    && (!filters.from || slot.entryDate >= filters.from) && (!filters.through || slot.entryDate <= filters.through)
    && (!filters.role || slot.role === filters.role) && (!filters.shiftTypeId || slot.shiftTypeId === filters.shiftTypeId))
    .sort((a, b) => a.entryDate.localeCompare(b.entryDate) || a.startTime.replace(":", "").localeCompare(b.startTime.replace(":", "")) || a.role.localeCompare(b.role));
}
