import { addCalendarDays } from "./operational-day.ts";

export type DepartmentScheduleAssignment = {
  id: string;
  employeeId: string | null;
  employeeName?: string;
  workDate: string;
  startTime: string;
  endTime: string;
  role: string;
  source?: string;
  status: string;
};

export type DepartmentScheduleWindowItem = DepartmentScheduleAssignment & {
  endDate: string;
};

export type ScheduledStaffingRow = {
  id: string;
  shiftKey: "morning" | "afternoon" | "overnight";
  employeeId: string;
  timeIn: string;
  timeOut: string;
  actingOfficer: boolean;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

function dayNumber(value: string) {
  if (!datePattern.test(value)) return Number.NaN;
  return Math.floor(Date.parse(`${value}T00:00:00Z`) / 86400000);
}

function timeMinutes(value: string) {
  const match = value.match(timePattern);
  return match ? Number(match[1]) * 60 + Number(match[2]) : Number.NaN;
}

function assignmentInterval(assignment: DepartmentScheduleAssignment) {
  const day = dayNumber(assignment.workDate);
  const startMinute = timeMinutes(assignment.startTime);
  const endMinute = timeMinutes(assignment.endTime);
  if (![day, startMinute, endMinute].every(Number.isFinite)) return null;
  const start = day * 1440 + startMinute;
  const duration = endMinute <= startMinute ? endMinute + 1440 - startMinute : endMinute - startMinute;
  return { start, end: start + duration };
}

function absoluteDateTime(value: number) {
  const day = Math.floor(value / 1440);
  const minute = ((value % 1440) + 1440) % 1440;
  return {
    date: new Date(day * 86400000).toISOString().slice(0, 10),
    time: `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`,
  };
}

export function next24DepartmentSchedule(
  assignments: DepartmentScheduleAssignment[],
  calendarDate: string,
  currentMinutes: number,
) {
  const start = dayNumber(calendarDate) * 1440 + currentMinutes;
  const end = start + 1440;
  return assignments.flatMap((assignment): DepartmentScheduleWindowItem[] => {
    const interval = assignmentInterval(assignment);
    if (
      !interval ||
      assignment.status !== "assigned" ||
      !assignment.employeeId ||
      interval.start >= end ||
      interval.end <= start
    ) return [];
    return [{ ...assignment, endDate: absoluteDateTime(interval.end).date }];
  }).sort((a, b) =>
    a.workDate.localeCompare(b.workDate) ||
    a.startTime.localeCompare(b.startTime) ||
    String(a.employeeName ?? "").localeCompare(String(b.employeeName ?? "")),
  );
}

export function scheduledStaffingForLog(assignments: DepartmentScheduleAssignment[], logDate: string) {
  const operationalStart = dayNumber(logDate) * 1440 + 360;
  const sections = [
    { shiftKey: "morning" as const, start: operationalStart, end: operationalStart + 360 },
    { shiftKey: "afternoon" as const, start: operationalStart + 360, end: operationalStart + 720 },
    { shiftKey: "overnight" as const, start: operationalStart + 720, end: operationalStart + 1440 },
  ];
  const rows = new Map<string, ScheduledStaffingRow>();

  for (const assignment of assignments) {
    const interval = assignmentInterval(assignment);
    if (!interval || assignment.status !== "assigned" || !assignment.employeeId) continue;
    for (const section of sections) {
      const overlapStart = Math.max(interval.start, section.start);
      const overlapEnd = Math.min(interval.end, section.end);
      if (overlapStart >= overlapEnd) continue;
      const timeIn = absoluteDateTime(overlapStart).time;
      const timeOut = absoluteDateTime(overlapEnd).time;
      const key = `${section.shiftKey}:${assignment.employeeId}:${timeIn}:${timeOut}`;
      const actingOfficer = /\bacting\s+officer\b|\bao\b/i.test(assignment.role);
      const existing = rows.get(key);
      if (existing) {
        existing.actingOfficer = existing.actingOfficer || actingOfficer;
      } else {
        rows.set(key, {
          id: `schedule-${logDate}-${assignment.id}-${section.shiftKey}`,
          shiftKey: section.shiftKey,
          employeeId: assignment.employeeId,
          timeIn,
          timeOut,
          actingOfficer,
        });
      }
    }
  }

  const order = { morning: 0, afternoon: 1, overnight: 2 };
  return [...rows.values()].sort((a, b) =>
    order[a.shiftKey] - order[b.shiftKey] ||
    a.timeIn.localeCompare(b.timeIn) ||
    a.employeeId.localeCompare(b.employeeId),
  );
}

export function scheduleQueryDates(value: string) {
  return { startDate: addCalendarDays(value, -1), endDate: addCalendarDays(value, 1) };
}
