// Station Scheduler — pure business logic.
//
// No database or framework imports so this stays unit-testable in isolation.
// The API route (app/api/station-scheduler/route.ts) is responsible for loading
// rows, translating them into the plain shapes below, and persisting results.

export type OtCriterion = "leastOT" | "leastMandatory" | "mostSeniority" | "leastSeniority";

export const OT_CRITERIA: { id: OtCriterion; label: string }[] = [
  { id: "leastOT", label: "Least overtime worked" },
  { id: "leastMandatory", label: "Least mandatory time" },
  { id: "mostSeniority", label: "Most seniority" },
  { id: "leastSeniority", label: "Least seniority" },
];

export type OtMode = "voluntary" | "mandatory";

export type OtEmployee = {
  employeeId: string;
  name: string;
  otHours: number;
  mandatoryHours: number;
  // Comparable seniority: larger = more senior. Derive from hire date via
  // `seniorityFromStartDate` so an earlier start date sorts as more senior.
  seniority: number;
  // Pool context flags (all optional; treated as false/absent when omitted):
  offDuty?: boolean;                 // off duty / on approved leave that day
  alreadyScheduled?: boolean;        // already working that day
  declined?: boolean;                // already declined this specific vacancy
  lastMandated?: string;             // YYYY-MM-DD of most recent mandate ("" = never)
  consecutiveMandatory?: number;     // consecutive mandatory shifts
};

export type OtSettings = {
  exemptOffDuty: boolean;
  exemptAlreadyScheduled: boolean;
  exemptDeclined: boolean;           // voluntary only
  exemptRecentlyMandated: boolean;   // mandatory only
  recentDays: number;                // mandatory only
  exemptMaxConsecutive: boolean;     // mandatory only
  maxConsecutive: number;            // mandatory only
  priorityOrder: OtCriterion[];
};

/** Days between two YYYY-MM-DD dates (b - a), using a noon anchor to dodge DST. */
export function daysBetween(a: string, b: string): number {
  const start = Date.parse(`${a}T12:00:00Z`);
  const end = Date.parse(`${b}T12:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return Number.NaN;
  return Math.round((end - start) / 86_400_000);
}

/**
 * Return every occurrence of a repeating shift inside an inclusive window.
 * Dates are handled at noon UTC so daylight-saving changes cannot move a
 * shift to the prior or following calendar day.
 */
export function recurringShiftDates(
  anchorDate: string,
  repeatEveryDays: number,
  throughDate: string,
  fromDate = anchorDate,
): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate) || !/^\d{4}-\d{2}-\d{2}$/.test(throughDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !Number.isInteger(repeatEveryDays) || repeatEveryDays < 1 || repeatEveryDays > 365) return [];
  const throughOffset = daysBetween(anchorDate, throughDate);
  if (Number.isNaN(throughOffset) || throughOffset < 0) return [];
  const fromOffset = Math.max(0, daysBetween(anchorDate, fromDate));
  if (Number.isNaN(fromOffset)) return [];
  const firstOffset = Math.ceil(fromOffset / repeatEveryDays) * repeatEveryDays;
  const dates: string[] = [];
  const anchor = new Date(`${anchorDate}T12:00:00Z`);
  for (let offset = firstOffset; offset <= throughOffset && dates.length < 500; offset += repeatEveryDays) {
    const date = new Date(anchor);
    date.setUTCDate(date.getUTCDate() + offset);
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

/** True when two repeating definitions produce the same set of calendar days. */
export function sameRecurringPattern(
  anchorDateA: string,
  repeatEveryDaysA: number,
  anchorDateB: string,
  repeatEveryDaysB: number,
): boolean {
  if (!Number.isInteger(repeatEveryDaysA) || repeatEveryDaysA < 1 || repeatEveryDaysA !== repeatEveryDaysB) return false;
  const offset = daysBetween(anchorDateA, anchorDateB);
  return !Number.isNaN(offset) && Math.abs(offset) % repeatEveryDaysA === 0;
}

/** True when a repeating shift is scheduled to occur on a specific date. */
export function recurringShiftOccursOnDate(
  anchorDate: string,
  repeatEveryDays: number,
  date: string,
): boolean {
  if (!Number.isInteger(repeatEveryDays) || repeatEveryDays < 1 || repeatEveryDays > 365) return false;
  const offset = daysBetween(anchorDate, date);
  return !Number.isNaN(offset) && offset >= 0 && offset % repeatEveryDays === 0;
}

/**
 * A seniority score where larger = more senior. Earlier start dates yield a
 * larger number. Falls back to 0 when the date is missing/invalid so those
 * employees sort as least senior.
 */
export function seniorityFromStartDate(startDate: string | null | undefined, today: string): number {
  if (!startDate) return 0;
  const days = daysBetween(startDate, today);
  return Number.isNaN(days) ? 0 : days; // more days of service = more senior
}

const comparators: Record<OtCriterion, (a: OtEmployee, b: OtEmployee) => number> = {
  leastOT: (a, b) => a.otHours - b.otHours,
  leastMandatory: (a, b) => a.mandatoryHours - b.mandatoryHours,
  mostSeniority: (a, b) => b.seniority - a.seniority,
  leastSeniority: (a, b) => a.seniority - b.seniority,
};

/**
 * Rank eligible employees by an ordered list of criteria. The first criterion
 * is the primary sort key; each later one only breaks ties from the previous.
 * Name is the final deterministic tie-breaker. Returns a new array; the input
 * is not mutated.
 */
export function rankByCriteria(employees: OtEmployee[], priorityOrder: OtCriterion[]): OtEmployee[] {
  const order = priorityOrder.filter((id) => id in comparators);
  return [...employees].sort((a, b) => {
    for (const id of order) {
      const result = comparators[id](a, b);
      if (result !== 0) return result;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Filter out employees who must never be asked (and never charged hours) for a
 * vacancy, per the active mode's exemption settings. `slotDate` and `today` are
 * YYYY-MM-DD; `recentDays` is measured against `slotDate`.
 */
export function filterOtPool(
  employees: OtEmployee[],
  mode: OtMode,
  settings: OtSettings,
  slotDate: string,
): OtEmployee[] {
  return employees.filter((emp) => {
    if (settings.exemptOffDuty && emp.offDuty) return false;
    if (settings.exemptAlreadyScheduled && emp.alreadyScheduled) return false;
    if (mode === "voluntary") {
      if (settings.exemptDeclined && emp.declined) return false;
    } else {
      if (settings.exemptRecentlyMandated && emp.lastMandated) {
        const since = daysBetween(emp.lastMandated, slotDate);
        if (!Number.isNaN(since) && since >= 0 && since <= settings.recentDays) return false;
      }
      if (settings.exemptMaxConsecutive && (emp.consecutiveMandatory ?? 0) >= settings.maxConsecutive) return false;
    }
    return true;
  });
}

/** Build the ranked call list for a vacancy: exempt the pool, then rank it. */
export function buildCallList(
  employees: OtEmployee[],
  mode: OtMode,
  settings: OtSettings,
  slotDate: string,
): OtEmployee[] {
  return rankByCriteria(filterOtPool(employees, mode, settings, slotDate), settings.priorityOrder);
}

export type AwardWindow = "early" | "award" | "overdue";

export type OtTiming = { awardDaysOut: number; completeByDaysOut: number };

/**
 * Classify where an open slot sits relative to its shift date.
 *  - early:   more than awardDaysOut away — interest is informational only
 *  - award:   within the award window — admin may build the call list / mandate
 *  - overdue: at/inside completeByDaysOut and still open — urgent, escalate
 */
export function classifyAward(daysUntil: number, timing: OtTiming): AwardWindow {
  if (daysUntil > timing.awardDaysOut) return "early";
  if (daysUntil > timing.completeByDaysOut) return "award";
  return "overdue";
}

// --- Auto-distribution (shift-fill, distinct from OT) -----------------------

export type DistributionWeights = {
  seniorityWeight: number;
  hoursWeight: number;
  customWeight: number;
  customLabel: string;
};

export type DistributionEmployee = {
  employeeId: string;
  name: string;
  seniority: number;      // larger = more senior
  hours: number;          // hoursThisPeriod
  crossTrained: boolean;  // earns the custom weight when true
};

export type OpenSlot = { slotId: string; date: string; role: string; hours: number };

export type DistributionAssignment = {
  slotId: string;
  employeeId: string;
  score: number;
  hours: number;
};

/**
 * Score = seniority/maxSeniority*seniorityWeight
 *       + (1 - hours/maxHours)*hoursWeight
 *       + (crossTrained ? customWeight : 0)
 * Normalizers use the current candidate set; guard against divide-by-zero.
 */
export function scoreCandidate(
  emp: DistributionEmployee,
  maxSeniority: number,
  maxHours: number,
  weights: DistributionWeights,
): number {
  const seniorityTerm = maxSeniority > 0 ? (emp.seniority / maxSeniority) * weights.seniorityWeight : 0;
  const hoursTerm = maxHours > 0 ? (1 - emp.hours / maxHours) * weights.hoursWeight : weights.hoursWeight;
  const crossTerm = emp.crossTrained ? weights.customWeight : 0;
  return seniorityTerm + hoursTerm + crossTerm;
}

/**
 * Greedily fill each open slot with the highest-scoring role-eligible employee
 * who is not already working that day (across both existing bookings and slots
 * filled earlier in this run). Assigned hours accrue to the employee so later
 * slots see updated load. `eligibility[slotId]` lists eligible employee ids for
 * that slot's role; `busyByDate[date]` seeds employees already booked that day.
 *
 * Deterministic: slots are processed in the given order and ties break by name.
 * Returns only the slots that could be filled.
 */
export function autoDistribute(
  openSlots: OpenSlot[],
  employees: DistributionEmployee[],
  weights: DistributionWeights,
  eligibility: Record<string, string[]>,
  busyByDate: Record<string, string[]> = {},
): DistributionAssignment[] {
  const byId = new Map(employees.map((e) => [e.employeeId, { ...e }]));
  const busy: Record<string, Set<string>> = {};
  for (const [date, ids] of Object.entries(busyByDate)) busy[date] = new Set(ids);
  const maxSeniority = Math.max(0, ...employees.map((e) => e.seniority));

  const assignments: DistributionAssignment[] = [];
  for (const slot of openSlots) {
    const eligibleIds = new Set(eligibility[slot.slotId] ?? []);
    const dayBusy = (busy[slot.date] ??= new Set());
    const candidates = employees
      .map((e) => byId.get(e.employeeId)!)
      .filter((e) => eligibleIds.has(e.employeeId) && !dayBusy.has(e.employeeId));
    if (!candidates.length) continue;
    const maxHours = Math.max(0, ...candidates.map((e) => e.hours));
    let best: DistributionEmployee | null = null;
    let bestScore = -Infinity;
    for (const candidate of candidates) {
      const score = scoreCandidate(candidate, maxSeniority, maxHours, weights);
      if (score > bestScore || (score === bestScore && best && candidate.name.localeCompare(best.name) < 0)) {
        best = candidate;
        bestScore = score;
      }
    }
    if (!best) continue;
    assignments.push({ slotId: slot.slotId, employeeId: best.employeeId, score: bestScore, hours: slot.hours });
    dayBusy.add(best.employeeId);
    const record = byId.get(best.employeeId)!;
    record.hours += slot.hours;
  }
  return assignments;
}
