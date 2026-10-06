type TimeRange = { startTime: string; endTime: string };
type CalendarEntry = { id: string; shiftTypeId: string };
type CalendarShift = TimeRange & { id: string };
type CalendarSlot = TimeRange & { entryId: string; employeeId: string | null };

export function calendarShiftText(hex: string) {
  const raw = hex.replace('#', '');
  const color = raw.length === 3 ? raw.split('').map(part => part + part).join('') : raw;
  if (!/^[a-f0-9]{6}$/i.test(color)) return '#ffffff';
  const luminance = color.match(/../g)!.map(part => parseInt(part, 16) / 255)
    .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
  return (luminance + .05) / .05 >= 1.05 / (luminance + .05) ? '#000000' : '#ffffff';
}

/** Overlap a saved assignment with a daily window, including overnight/24-hour work. */
export function calendarTimeOverlaps(range: TimeRange, window: TimeRange) {
  const minutes = (value: string) => {
    const raw = value.replace(':', '');
    if (!/^\d{4}$/.test(raw)) return null;
    const hour = Number(raw.slice(0, 2)), minute = Number(raw.slice(2));
    return hour < 24 && minute < 60 ? hour * 60 + minute : null;
  };
  const start = minutes(range.startTime), end = minutes(range.endTime);
  const windowStart = minutes(window.startTime), windowEnd = minutes(window.endTime);
  if (start === null || end === null || windowStart === null || windowEnd === null) return false;
  const through = end <= start ? end + 1440 : end;
  const windowThrough = windowEnd <= windowStart ? windowEnd + 1440 : windowEnd;
  return [-1440, 0, 1440].some(offset => start < windowThrough + offset && windowStart + offset < through);
}

export function calendarDayShifts<E extends CalendarEntry, S extends CalendarShift, P extends CalendarSlot>(
  entries: E[], shifts: S[], slots: P[], employeeId: string | null, showAll: boolean, window: TimeRange | null,
) {
  return entries.flatMap(entry => {
    const shift = shifts.find(item => item.id === entry.shiftTypeId);
    if (!shift) return [];
    const scopedSlots = slots.filter(slot => slot.entryId === entry.id && (showAll || (employeeId !== null && slot.employeeId === employeeId)));
    const visibleSlots = scopedSlots.filter(slot => window === null || calendarTimeOverlaps(slot, window));
    if (!showAll && !visibleSlots.length) return [];
    if (window && scopedSlots.length && !visibleSlots.length) return [];
    if (window && !scopedSlots.length && !calendarTimeOverlaps(shift, window)) return [];
    return [{ entry, shift, slots: visibleSlots }];
  });
}
