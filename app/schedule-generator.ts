import { holidayForDate } from "./holidays.ts";
import { qualifiedForScheduleRole, type ScheduleQualification } from "./schedule-eligibility.ts";

export type GeneratorEmployee = ScheduleQualification & {
  id: string;
  name: string;
  sortOrder: number;
};

export type GeneratorAssignment = {
  id: string;
  employeeId: string | null;
  workDate: string;
  startTime: string;
  endTime: string;
  role: string;
  source: string;
  status: string;
};

export type GeneratorRequest = {
  id: string;
  requestType: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  role: string;
  repeatMode: string;
  repeatInterval: number;
  status: string;
  createdAt?: string;
};

export type GeneratorCoverageRule = {
  id: string;
  planId: string;
  name: string;
  role: string;
  minimumStaff: number;
  startTime: string;
  endTime: string;
  daysOfWeek: string;
  active: number;
};

export type GeneratorShiftPattern = {
  id: string;
  name: string;
  color: string;
  startDate: string;
  startTime: string;
  endTime: string;
  recurrenceDays: number;
  coveragePlanId: string;
  active: number;
};

export type GeneratorStaffingOverride = {
  id: string;
  patternId: string;
  name: string;
  conditionType: string;
  role: string;
  minimumStaff: number;
  active: number;
};

export type GeneratedScheduleSlot = {
  id: string;
  patternId: string;
  patternName: string;
  color: string;
  workDate: string;
  startTime: string;
  endTime: string;
  role: string;
  slotNumber: number;
  employeeId: string;
  automatic: boolean;
  autoCandidateIds: string[];
  eligibleEmployeeIds: string[];
  availabilityRequestIds: string[];
};

export type GenerateScheduleInput = {
  startDate: string;
  endDate: string;
  employees: GeneratorEmployee[];
  assignments: GeneratorAssignment[];
  requests: GeneratorRequest[];
  coverageRules: GeneratorCoverageRule[];
  shiftPatterns: GeneratorShiftPattern[];
  staffingOverrides: GeneratorStaffingOverride[];
  distributionOrder: string[];
};

const dayMs = 86400000;
const normalized = (value: string) => value.trim().toLowerCase();
const spanDays = (start: string, end: string) => Math.floor((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / dayMs);
const addDays = (value: string, count: number) => {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
};
const timeMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
const timeRange = (startTime: string, endTime: string) => {
  const start = timeMinutes(startTime || "00:00");
  let end = timeMinutes(endTime || startTime || "00:00");
  if (end <= start) end += 1440;
  return { start, end };
};
const assignmentMinutes = (assignment: Pick<GeneratorAssignment, "startTime" | "endTime">) => {
  const range = timeRange(assignment.startTime, assignment.endTime);
  return range.end - range.start;
};

export function scheduleItemsOverlap(left: Pick<GeneratorAssignment, "workDate" | "startTime" | "endTime">, right: Pick<GeneratorAssignment, "workDate" | "startTime" | "endTime">) {
  const leftStart = Date.parse(`${left.workDate}T${left.startTime}:00Z`);
  const rightStart = Date.parse(`${right.workDate}T${right.startTime}:00Z`);
  let leftEnd = Date.parse(`${left.workDate}T${left.endTime}:00Z`);
  let rightEnd = Date.parse(`${right.workDate}T${right.endTime}:00Z`);
  if (leftEnd <= leftStart) leftEnd += dayMs;
  if (rightEnd <= rightStart) rightEnd += dayMs;
  return leftStart < rightEnd && rightStart < leftEnd;
}

function requestOccurs(request: GeneratorRequest, workDate: string) {
  if (!["pending", "approved"].includes(request.status) || workDate < request.startDate || workDate > request.endDate) return false;
  if (request.repeatMode !== "interval") return true;
  const interval = Number(request.repeatInterval);
  return Number.isInteger(interval) && interval > 0 && spanDays(request.startDate, workDate) % interval === 0;
}

function availabilityRoleMatches(requestRole: string, assignmentRole: string) {
  const requested = normalized(requestRole);
  const assigned = normalized(assignmentRole);
  if (!requested || requested === "any" || requested === assigned) return true;
  if (requested.includes("firefighter") && assigned.includes("firefighter")) return true;
  if (/engine driver|driver\/engineer|engineer/.test(requested) && /engine driver|driver\/engineer|engineer/.test(assigned) && !assigned.includes("ambulance")) return true;
  if (/officer|\bao\b/.test(requested) && /officer|\bao\b/.test(assigned)) return true;
  return false;
}

function requestCoversSlot(request: GeneratorRequest, slot: Pick<GeneratorAssignment, "startTime" | "endTime">) {
  if (!request.startTime || !request.endTime) return true;
  const available = timeRange(request.startTime, request.endTime);
  const needed = timeRange(slot.startTime, slot.endTime);
  return available.start <= needed.start && available.end >= needed.end;
}

function requestOverlapsSlot(request: GeneratorRequest, slot: Pick<GeneratorAssignment, "startTime" | "endTime">) {
  if (!request.startTime || !request.endTime) return true;
  const unavailable = timeRange(request.startTime, request.endTime);
  const needed = timeRange(slot.startTime, slot.endTime);
  return unavailable.start < needed.end && needed.start < unavailable.end;
}

function patternOccurs(pattern: GeneratorShiftPattern, date: string) {
  const offset = spanDays(pattern.startDate, date);
  return Boolean(pattern.active) && offset >= 0 && offset % pattern.recurrenceDays === 0;
}

function requirementsForPattern(
  pattern: GeneratorShiftPattern,
  workDate: string,
  rules: GeneratorCoverageRule[],
  overrides: GeneratorStaffingOverride[],
) {
  const requirements = new Map<string, GeneratorCoverageRule>();
  for (const rule of rules.filter((item) => item.active && (item.planId || item.id) === pattern.coveragePlanId)) {
    requirements.set(normalized(rule.role), { ...rule });
  }
  const weekday = new Date(`${workDate}T12:00:00Z`).getUTCDay();
  for (const override of overrides.filter((item) => item.active && item.patternId === pattern.id)) {
    const specialDay = override.conditionType === "weekend"
      ? weekday === 0 || weekday === 6
      : override.conditionType === "holiday" && Boolean(holidayForDate(workDate));
    if (!specialDay) continue;
    const key = normalized(override.role);
    const existing = requirements.get(key);
    requirements.set(key, {
      id: existing?.id || override.id,
      planId: pattern.coveragePlanId,
      name: override.name,
      role: override.role,
      minimumStaff: Math.max(existing?.minimumStaff || 0, override.minimumStaff),
      startTime: existing?.startTime || pattern.startTime,
      endTime: existing?.endTime || pattern.endTime,
      daysOfWeek: String(weekday),
      active: 1,
    });
  }
  return [...requirements.values()];
}

function matchingRequests(requests: GeneratorRequest[], employeeId: string, requestType: "availability" | "time_off", slot: GeneratorAssignment) {
  return requests.filter((request) => request.employeeId === employeeId && request.requestType === requestType && requestOccurs(request, slot.workDate) && (requestType === "time_off" ? requestOverlapsSlot(request, slot) : availabilityRoleMatches(request.role, slot.role) && requestCoversSlot(request, slot)));
}

export function generateScheduleDraft(input: GenerateScheduleInput) {
  const replaceable = (assignment: GeneratorAssignment) => assignment.source.startsWith("schedule-generator:") && assignment.workDate >= input.startDate && assignment.workDate <= input.endDate;
  const fixedAssignments = input.assignments.filter((assignment) => assignment.status === "assigned" && assignment.employeeId && !replaceable(assignment));
  const scheduledMinutes = new Map<string, number>();
  for (const assignment of fixedAssignments) {
    if (!assignment.employeeId) continue;
    scheduledMinutes.set(assignment.employeeId, (scheduledMinutes.get(assignment.employeeId) || 0) + assignmentMinutes(assignment));
  }

  const slots: GeneratedScheduleSlot[] = [];
  const draftAssignments: GeneratorAssignment[] = [];
  const totalDays = Math.max(0, spanDays(input.startDate, input.endDate));

  for (let offset = 0; offset <= totalDays; offset += 1) {
    const workDate = addDays(input.startDate, offset);
    const occurringPatterns = input.shiftPatterns.filter((pattern) => patternOccurs(pattern, workDate));
    for (const pattern of occurringPatterns) {
      const requirements = requirementsForPattern(pattern, workDate, input.coverageRules, input.staffingOverrides);
      for (const rule of requirements) {
        const slotWindow: GeneratorAssignment = {
          id: "candidate-slot",
          employeeId: null,
          workDate,
          startTime: rule.startTime,
          endTime: rule.endTime,
          role: rule.role,
          source: `schedule-generator:${pattern.id}`,
          status: "assigned",
        };
        const existingEmployeeIds = new Set(fixedAssignments.filter((assignment) => assignment.workDate === workDate && normalized(assignment.role) === normalized(rule.role) && scheduleItemsOverlap(assignment, slotWindow)).map((assignment) => assignment.employeeId).filter(Boolean));
        const missing = Math.max(0, rule.minimumStaff - existingEmployeeIds.size);
        for (let slotIndex = 0; slotIndex < missing; slotIndex += 1) {
          const manualCandidates = input.employees.filter((employee) =>
            qualifiedForScheduleRole(employee, rule.role) &&
            matchingRequests(input.requests, employee.id, "time_off", slotWindow).length === 0 &&
            !fixedAssignments.some((assignment) => assignment.employeeId === employee.id && scheduleItemsOverlap(assignment, slotWindow)),
          );
          const availabilityByEmployee = new Map(manualCandidates.map((employee) => [employee.id, matchingRequests(input.requests, employee.id, "availability", slotWindow)]));
          const autoCandidates = manualCandidates.filter((employee) =>
            (availabilityByEmployee.get(employee.id)?.length || 0) > 0 &&
            !draftAssignments.some((assignment) => assignment.employeeId === employee.id && scheduleItemsOverlap(assignment, slotWindow)),
          );
          const sortedCandidates = [...autoCandidates].sort((left, right) => {
            for (const priority of input.distributionOrder) {
              if (priority === "Fewest hours worked") {
                const difference = (scheduledMinutes.get(left.id) || 0) - (scheduledMinutes.get(right.id) || 0);
                if (difference) return difference;
              } else if (priority === "Seniority") {
                const difference = Number(left.sortOrder || 999) - Number(right.sortOrder || 999);
                if (difference) return difference;
              } else if (priority === "Custom priority") {
                const leftRequested = availabilityByEmployee.get(left.id)?.[0]?.createdAt || "";
                const rightRequested = availabilityByEmployee.get(right.id)?.[0]?.createdAt || "";
                if (leftRequested !== rightRequested) return leftRequested.localeCompare(rightRequested);
              }
            }
            return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
          });
          const selected = sortedCandidates[0];
          const id = `schedule-slot:${pattern.id}:${rule.id}:${workDate}:${slotIndex + 1}`;
          slots.push({
            id,
            patternId: pattern.id,
            patternName: pattern.name,
            color: pattern.color,
            workDate,
            startTime: rule.startTime,
            endTime: rule.endTime,
            role: rule.role,
            slotNumber: existingEmployeeIds.size + slotIndex + 1,
            employeeId: selected?.id || "",
            automatic: Boolean(selected),
            autoCandidateIds: sortedCandidates.map((employee) => employee.id),
            eligibleEmployeeIds: manualCandidates.map((employee) => employee.id),
            availabilityRequestIds: selected ? (availabilityByEmployee.get(selected.id) || []).map((request) => request.id) : [],
          });
          if (selected) {
            const draft = { ...slotWindow, id, employeeId: selected.id };
            draftAssignments.push(draft);
            scheduledMinutes.set(selected.id, (scheduledMinutes.get(selected.id) || 0) + assignmentMinutes(draft));
          }
        }
      }
    }
  }

  return {
    slots,
    assignedCount: slots.filter((slot) => slot.employeeId).length,
    openCount: slots.filter((slot) => !slot.employeeId).length,
    requestedEmployeeCount: new Set(slots.flatMap((slot) => slot.autoCandidateIds)).size,
  };
}
