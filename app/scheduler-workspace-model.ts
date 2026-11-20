import {
  shiftHasNotEnded,
  shiftHasNotStarted,
} from "./scheduler-member-view.ts";

export type ScheduleEmployee = {
  id: string;
  name: string;
  rank: string;
  roles: string;
  email?: string;
  actingOfficerEligible?: number;
};
export type ScheduleShift = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  anchorDate: string;
  repeatEveryDays: number;
  color: string;
  active: number;
  sortOrder: number;
};
export type ScheduleSlot = {
  id: string;
  entryId: string;
  role: string;
  employeeId: string | null;
  employeeName?: string;
  status: string;
  sortOrder: number;
  startTime: string;
  endTime: string;
  hasTimeOverride: number;
  isExtra: number;
  staffingReason?: string;
  entryDate: string;
  shiftTypeId: string;
};
export type ScheduleTrade = {
  id: string;
  slotId: string;
  returnSlotId: string | null;
  role: string;
  fromEmployeeId: string;
  fromEmployeeName: string;
  targetEmployeeId: string | null;
  targetEmployeeName?: string;
  acceptedByEmployeeId: string | null;
  note: string;
  status: string;
  createdAt: string;
  entryDate: string;
};
export type ScheduleClaim = {
  id: string;
  slotId: string;
  role: string;
  employeeId: string;
  employeeName: string;
  note: string;
  status: string;
  createdAt: string;
  entryDate: string;
};
export type ScheduleTimeOff = {
  id: string;
  employeeId: string;
  employeeName: string;
  type: string;
  approverEmployeeId: string;
  approverName?: string;
  note: string;
  status: string;
  createdAt: string;
};
export type ScheduleAvailability = {
  id: string;
  employeeId: string;
  employeeName: string;
  availabilityDate: string;
  status: "available" | "unavailable";
  allDay: number;
  startTime: string;
  endTime: string;
  note: string;
  updatedAt: string;
};
export type ScheduleReminder = {
  id: string;
  type: string;
  label: string;
  offsets: string;
  emailEnabled: number;
  textEnabled: number;
  pushEnabled?: number;
  target: string;
  enabled: number;
};
export type LiveSchedule = {
  viewer: {
    employeeId: string | null;
    isAdmin: boolean;
    rank: string;
    roles: string[];
    actingOfficerEligible: boolean;
    name: string;
  };
  today: string;
  roles: string[];
  dayPositionRoles?: string[];
  employees: ScheduleEmployee[];
  shiftTypes: ScheduleShift[];
  shiftTypeRoles: {
    id: string;
    shiftTypeId: string;
    role: string;
    count: number;
  }[];
  entries: { id: string; entryDate: string; shiftTypeId: string }[];
  slots: ScheduleSlot[];
  standingAssignments: {
    id: string;
    employeeId: string;
    employeeName: string;
    shiftTypeId: string;
    role: string;
    active: number;
  }[];
  trades: ScheduleTrade[];
  claims: ScheduleClaim[];
  timeOff: ScheduleTimeOff[];
  timeOffDates: { requestId: string; offDate: string }[];
  availability: ScheduleAvailability[];
  reminderRules: ScheduleReminder[];
  pushConfigured?: boolean;
  requestDeadlines?: { id: string; deadline: string }[];
};
export type WorkspaceRequest = {
  id: string;
  kind: "trade" | "claim" | "timeoff";
  memberId: string;
  name: string;
  status: "offered" | "pending" | "approved" | "denied" | "closed";
  note: string;
  date: string;
  slotId: string;
  trade?: ScheduleTrade;
  claim?: ScheduleClaim;
  timeOff?: ScheduleTimeOff;
};
export type SchedulerPreviewMember = {
  id: string;
  name: string;
  rank: string;
  effectivePermissions: string[];
};
export const generalScheduleRoles = [
  "Extra member",
  "Firefighter",
  "Training/Orientation",
];
export function scheduleRoles(employee: ScheduleEmployee): string[] {
  try {
    const roles = JSON.parse(employee.roles);
    return Array.isArray(roles)
      ? roles.filter((r): r is string => typeof r === "string")
      : [];
  } catch {
    return [];
  }
}
export function clearedForPosition(employee: ScheduleEmployee, role: string) {
  return (
    generalScheduleRoles.includes(role) ||
    scheduleRoles(employee).includes(role)
  );
}
export function scheduleDateOffset(day: string, n: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function scheduleDates(from: string, through: string, max = 93) {
  if (!validScheduleDate(from) || !validScheduleDate(through) || through < from)
    throw new Error("Choose valid first and last dates.");
  const dates: string[] = [];
  for (let day = from; day <= through; day = scheduleDateOffset(day, 1)) {
    if (dates.length >= max)
      throw new Error("Choose no more than " + max + " days.");
    dates.push(day);
  }
  return dates;
}
export function validScheduleDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + "T12:00:00Z")) &&
    new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value
  );
}
export function scheduleDayLabel(day: string, long = false) {
  if (!validScheduleDate(day)) return "Saved date";
  return new Intl.DateTimeFormat("en-US", {
    weekday: long ? "long" : "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(day + "T12:00:00Z"));
}
export function scheduleClock(value: string) {
  const t = value.includes(":")
    ? value
    : value.slice(0, 2) + ":" + value.slice(2, 4);
  const [h, m] = t.split(":").map(Number);
  return (
    (h % 12 || 12) +
    (m ? ":" + String(m).padStart(2, "0") : "") +
    " " +
    (h < 12 ? "AM" : "PM")
  );
}
export const scheduleSpan = (slot: ScheduleSlot) =>
  scheduleClock(slot.startTime) +
  "–" +
  scheduleClock(slot.endTime) +
  (slot.endTime <= slot.startTime ? " · ends next day" : "");
function windowFor(day: string, start: string, end: string): [number, number] {
  const base = Date.parse(day + "T00:00:00Z") / 60000;
  const minutes = (t: string) =>
    Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const a = base + minutes(start);
  let b = base + minutes(end);
  if (b <= a) b += 1440;
  return [a, b];
}
function intersects(a: [number, number], b: [number, number]) {
  return a[0] < b[1] && b[0] < a[1];
}
export function scheduleEligibility(
  data: LiveSchedule,
  employeeId: string,
  slot: ScheduleSlot,
  ignored: string[] = [],
): string | null {
  const employee = data.employees.find((e) => e.id === employeeId);
  if (!employee) return "Outside the current scheduling roster";
  if (!clearedForPosition(employee, slot.role))
    return "Not cleared for this position";
  const span = windowFor(slot.entryDate, slot.startTime, slot.endTime);
  if (
    data.slots.some(
      (x) =>
        x.id !== slot.id &&
        !ignored.includes(x.id) &&
        x.status === "filled" &&
        x.employeeId === employeeId &&
        intersects(span, windowFor(x.entryDate, x.startTime, x.endTime)),
    )
  )
    return "Already assigned during these hours";
  if (
    data.availability.some(
      (a) =>
        a.employeeId === employeeId &&
        a.status === "unavailable" &&
        intersects(
          span,
          windowFor(
            a.availabilityDate,
            a.allDay ? "00:00" : a.startTime,
            a.allDay ? "00:00" : a.endTime,
          ),
        ),
    )
  )
    return "Saved as unavailable";
  const approved = new Set(
    data.timeOff
      .filter((r) => r.employeeId === employeeId && r.status === "approved")
      .map((r) => r.id),
  );
  if (
    data.timeOffDates.some(
      (d) =>
        approved.has(d.requestId) &&
        intersects(span, windowFor(d.offDate, "00:00", "00:00")),
    )
  )
    return "Approved time off";
  return null;
}
export function upcomingAssignments(
  data: LiveSchedule,
  employeeId: string,
  now: Date,
) {
  return data.slots
    .filter(
      (s) =>
        s.status === "filled" &&
        s.employeeId === employeeId &&
        shiftHasNotEnded(s.entryDate, s.startTime, s.endTime, now),
    )
    .slice()
    .sort(slotOrder);
}
export function slotOrder(a: ScheduleSlot, b: ScheduleSlot) {
  return (
    a.entryDate.localeCompare(b.entryDate) ||
    a.startTime.localeCompare(b.startTime) ||
    a.sortOrder - b.sortOrder ||
    a.id.localeCompare(b.id)
  );
}
export function tradeIsOpen(t: ScheduleTrade) {
  return ["pending", "awaiting_acceptance"].includes(t.status);
}
export function incomingTradeOffers(
  data: LiveSchedule,
  employeeId: string,
  now: Date,
) {
  return data.trades.filter((t) => {
    if (
      !tradeIsOpen(t) ||
      t.acceptedByEmployeeId ||
      t.fromEmployeeId === employeeId ||
      (t.targetEmployeeId && t.targetEmployeeId !== employeeId)
    )
      return false;
    const slot = data.slots.find((s) => s.id === t.slotId);
    if (
      !slot ||
      slot.employeeId !== t.fromEmployeeId ||
      !shiftHasNotStarted(slot.entryDate, slot.startTime, now)
    )
      return false;
    if (
      scheduleEligibility(
        data,
        employeeId,
        slot,
        t.returnSlotId ? [t.returnSlotId] : [],
      )
    )
      return false;
    if (t.returnSlotId) {
      const back = data.slots.find((s) => s.id === t.returnSlotId);
      if (
        !back ||
        back.employeeId !== employeeId ||
        !shiftHasNotStarted(back.entryDate, back.startTime, now) ||
        scheduleEligibility(data, t.fromEmployeeId, back, [slot.id])
      )
        return false;
    }
    return true;
  });
}
export function openScheduleSeats(
  data: LiveSchedule,
  employeeId: string,
  now: Date,
  days = 30,
) {
  return data.slots
    .filter(
      (s) =>
        s.status === "open" &&
        !s.employeeId &&
        s.entryDate <= scheduleDateOffset(data.today, days - 1) &&
        shiftHasNotStarted(s.entryDate, s.startTime, now) &&
        !scheduleEligibility(data, employeeId, s),
    )
    .slice()
    .sort(slotOrder);
}
export function workspaceRequests(
  data: LiveSchedule,
  employeeId: string,
  admin = false,
): WorkspaceRequest[] {
  const trade = data.trades
    .filter(
      (t) =>
        admin ||
        t.fromEmployeeId === employeeId ||
        t.targetEmployeeId === employeeId ||
        t.acceptedByEmployeeId === employeeId,
    )
    .map((t) => ({
      id: t.id,
      kind: "trade" as const,
      memberId: t.fromEmployeeId,
      name: t.fromEmployeeName,
      status: tradeIsOpen(t)
        ? t.acceptedByEmployeeId
          ? ("pending" as const)
          : ("offered" as const)
        : t.status === "approved"
          ? ("approved" as const)
          : t.status === "denied" || t.status === "declined"
            ? ("denied" as const)
            : ("closed" as const),
      note: t.note,
      date: t.entryDate,
      slotId: t.slotId,
      trade: t,
    }));
  const claims = data.claims
    .filter((c) => admin || c.employeeId === employeeId)
    .map((c) => ({
      id: c.id,
      kind: "claim" as const,
      memberId: c.employeeId,
      name: c.employeeName,
      status:
        c.status === "pending"
          ? ("pending" as const)
          : c.status === "approved"
            ? ("approved" as const)
            : c.status === "denied"
              ? ("denied" as const)
              : ("closed" as const),
      note: c.note,
      date: c.entryDate,
      slotId: c.slotId,
      claim: c,
    }));
  const timeOff = data.timeOff
    .filter(
      (r) =>
        admin ||
        r.employeeId === employeeId ||
        r.approverEmployeeId === employeeId,
    )
    .map((r) => ({
      id: r.id,
      kind: "timeoff" as const,
      memberId: r.employeeId,
      name: r.employeeName,
      status:
        r.status === "pending"
          ? ("pending" as const)
          : r.status === "approved"
            ? ("approved" as const)
            : r.status === "denied"
              ? ("denied" as const)
              : ("closed" as const),
      note: r.note,
      date: data.timeOffDates.find((d) => d.requestId === r.id)?.offDate || "",
      slotId: "",
      timeOff: r,
    }));
  return [...trade, ...claims, ...timeOff];
}
export function tradeSubmission(
  data: LiveSchedule,
  employeeId: string,
  slotId: string,
  targetEmployeeId: string,
  returnSlotId: string,
  note: string,
) {
  const slot = data.slots.find(
    (s) =>
      s.id === slotId && s.employeeId === employeeId && s.status === "filled",
  );
  if (!slot) throw new Error("Choose one of your saved assignments.");
  if (targetEmployeeId) {
    const target = data.employees.find((e) => e.id === targetEmployeeId);
    if (
      !target ||
      targetEmployeeId === employeeId ||
      !clearedForPosition(target, slot.role)
    )
      throw new Error("Choose a different member cleared for this position.");
  }
  if (returnSlotId) {
    const back = data.slots.find(
      (s) => s.id === returnSlotId && s.status === "filled",
    );
    if (!targetEmployeeId || !back || back.employeeId !== targetEmployeeId)
      throw new Error("Choose a saved return shift belonging to that member.");
  }
  return {
    action: "submitTrade",
    slotId: slot.id,
    targetEmployeeId,
    returnSlotId: returnSlotId || null,
    tradeKind: returnSlotId ? "swap" : "giveaway",
    note: note.trim(),
  };
}
