export const scheduleTimeBlocks = [
  { id: "all-day", label: "24 hours · 6:00 AM–6:00 AM", startTime: "06:00", endTime: "06:00" },
  { id: "morning", label: "Morning · 6:00 AM–12:00 PM", startTime: "06:00", endTime: "12:00" },
  { id: "afternoon", label: "Afternoon · 12:00 PM–6:00 PM", startTime: "12:00", endTime: "18:00" },
  { id: "overnight", label: "Overnight · 6:00 PM–6:00 AM", startTime: "18:00", endTime: "06:00" },
];

export function normalizeScheduleTime(value: string) {
  const raw = String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const twelveHour = raw.match(/^(\d{1,2})(?::(\d{2}))?(AM|PM)$/);
  if (twelveHour) {
    let hour = Number(twelveHour[1]);
    const minute = Number(twelveHour[2] ?? "0");
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
    if (hour === 12) hour = 0;
    if (twelveHour[3] === "PM") hour += 12;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }
  const twentyFourHour = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!twentyFourHour) return null;
  const hour = Number(twentyFourHour[1]);
  const minute = Number(twentyFourHour[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function matchingTimeBlock(startTime: string, endTime: string) {
  return scheduleTimeBlocks.find((block) => block.startTime === startTime && block.endTime === endTime)?.id ?? "custom";
}
