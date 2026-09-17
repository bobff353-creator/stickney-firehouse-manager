import { normalizeScheduleTime } from "./schedule-time";
import { recurringShiftOccursOnDate } from "./station-scheduler-logic";

export type DistributionPosition = {
  id: string; role: string; entryDate: string; shiftTypeId: string;
  startTime: string; endTime: string; shiftStartTime: string; shiftEndTime: string;
  anchorDate: string; repeatEveryDays: number; shiftActive: number; isExtra: number;
};
export type DistributionRequest = { id: string; slotId: string; employeeId: string; role: string; status: string };
export type DistributionStanding = { id: string; employeeId: string; shiftTypeId: string; role: string; active: number };
export type DistributionConsent = { kind: "request" | "recurring"; id: string };

/** Availability is not consent. Match a requested position or the exact saved rotation. */
export function distributionConsent(
  position: DistributionPosition,
  employeeId: string,
  requests: DistributionRequest[],
  standing: DistributionStanding[],
): DistributionConsent | null {
  if (position.shiftActive !== 1) return null;
  const request = requests.find(row => row.employeeId === employeeId && row.slotId === position.id
    && row.role === position.role && row.status === "pending");
  if (request) return { kind: "request", id: request.id };
  // One-day extras and changed hours are not part of a member's standing agreement.
  const start = normalizeScheduleTime(position.startTime);
  const end = normalizeScheduleTime(position.endTime);
  if (position.isExtra || !start || !end || start !== normalizeScheduleTime(position.shiftStartTime)
    || end !== normalizeScheduleTime(position.shiftEndTime)
    || !recurringShiftOccursOnDate(position.anchorDate, position.repeatEveryDays, position.entryDate)) return null;
  const assignment = standing.find(row => row.employeeId === employeeId && row.active === 1
    && row.shiftTypeId === position.shiftTypeId && row.role === position.role);
  return assignment ? { kind: "recurring", id: assignment.id } : null;
}

/** Recheck the saved consent inside the assignment transaction, never trust client input. */
export function distributionConsentGuard(consent: DistributionConsent, position: DistributionPosition, employeeId: string) {
  return consent.kind === "request" ? {
    sql: "EXISTS (SELECT 1 FROM station_shift_claims c WHERE c.id=? AND c.slot_id=s.id AND c.employee_id=? AND c.role=s.role AND c.status='pending')",
    values: [consent.id, employeeId],
  } : {
    sql: "s.is_extra=0 AND t.anchor_date=? AND t.repeat_every_days=? AND t.start_time=? AND t.end_time=? AND EXISTS (SELECT 1 FROM station_standing_assignments sa WHERE sa.id=? AND sa.employee_id=? AND sa.shift_type_id=en.shift_type_id AND sa.role=s.role AND sa.active=1)",
    values: [position.anchorDate, position.repeatEveryDays, position.shiftStartTime, position.shiftEndTime, consent.id, employeeId],
  };
}
