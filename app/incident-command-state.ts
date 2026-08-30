export const commandPositions = ["Incident Commander", "Operations", "Safety", "Accountability", "Division / Group"] as const;
export const tacticalAssignments = ["Staging", "Fire Attack", "Primary Search", "Secondary Search", "Ventilation", "Exposure", "Water Supply", "RIT", "Rehab", "Command"] as const;
export const unitStatuses = ["Responding", "Staged", "On scene", "Rehab", "Released"] as const;
export const searchPhases = ["primary", "secondary", "final"] as const;
export const searchStatuses = ["not_started", "in_progress", "confirmed"] as const;
export const supportResources = ["Water", "Gas", "Electric", "Board up"] as const;
export const supportStatuses = ["not_reported", "needed", "called", "en_route", "on_scene"] as const;
export const benchmarkLabels = ["Command established", "Water supply established", "Primary search complete", "Secondary search complete", "Fire control", "All clear", "Incident terminated"] as const;

export type CommandPosition = typeof commandPositions[number];
export type TacticalAssignment = typeof tacticalAssignments[number];
export type UnitStatus = typeof unitStatuses[number];
export type SearchPhase = typeof searchPhases[number];
export type SearchStatus = typeof searchStatuses[number];
export type SupportResource = typeof supportResources[number];
export type SupportStatus = typeof supportStatuses[number];

export type CommandUnitState = {
  assignment: TacticalAssignment;
  status: UnitStatus;
  floor: string;
  side: "" | "A" | "B" | "C" | "D";
  crewStrength: number | null;
};

export type TacticalHazard = {
  id: string;
  label: string;
  floor: string;
  side: "" | "A" | "B" | "C" | "D";
  createdAt: string;
  createdBy: string;
};

export type IncidentCommandState = {
  revision: number;
  radioChannel: string;
  positions: Record<CommandPosition, string>;
  manualUnits: string[];
  units: Record<string, CommandUnitState>;
  par: {
    intervalMinutes: number;
    status: "paused" | "running";
    startedAt: string | null;
    remainingSeconds: number;
    confirmations: Record<string, { confirmedBy: string; confirmedAt: string }>;
  };
  building: { floorCount: number | null; basement: "unknown" | "present" | "none" };
  searches: Record<string, Partial<Record<SearchPhase, SearchStatus>>>;
  rit: { unitId: string; chiefEmployeeId: string; readiness: "not_reported" | "assembling" | "ready" };
  rehab: { unitIds: string[]; chiefEmployeeId: string; assignmentNote: string };
  hazards: TacticalHazard[];
  support: Record<SupportResource, SupportStatus>;
  benchmarks: Record<string, { recordedAt: string; recordedBy: string }>;
  mayday: { active: boolean; activatedAt: string | null; activatedBy: string; resolvedAt: string | null; resolvedBy: string };
  closeout: { endedAt: string | null; endedBy: string };
  updatedAt: string | null;
  updatedBy: string;
};

export type CommandAction =
  | { action: "set-radio"; radioChannel: string }
  | { action: "assign-position"; position: CommandPosition; assignee: string }
  | { action: "add-manual-unit"; unitId: string }
  | { action: "assign-unit"; unitId: string; assignment: TacticalAssignment; status?: UnitStatus; floor?: string; side?: CommandUnitState["side"]; crewStrength?: number | null }
  | { action: "set-par-interval"; intervalMinutes: number }
  | { action: "toggle-par" }
  | { action: "reset-par" }
  | { action: "confirm-par-unit"; unitId: string }
  | { action: "set-building"; floorCount: number | null; basement: IncidentCommandState["building"]["basement"] }
  | { action: "set-search"; level: string; phase: SearchPhase; status: SearchStatus }
  | { action: "set-rit"; unitId: string; chiefEmployeeId: string; readiness: IncidentCommandState["rit"]["readiness"] }
  | { action: "set-rehab"; unitIds: string[]; chiefEmployeeId: string; assignmentNote?: string }
  | { action: "add-hazard"; label: string; floor: string; side: TacticalHazard["side"] }
  | { action: "remove-hazard"; hazardId: string }
  | { action: "set-support"; resource: SupportResource; status: SupportStatus }
  | { action: "record-benchmark"; benchmark: typeof benchmarkLabels[number] }
  | { action: "set-mayday"; active: boolean; confirmation: string }
  | { action: "end-call"; confirmation: string };

const emptyPositions = () => Object.fromEntries(commandPositions.map((position) => [position, ""])) as Record<CommandPosition, string>;
const emptySupport = () => Object.fromEntries(supportResources.map((resource) => [resource, "not_reported"])) as Record<SupportResource, SupportStatus>;

export function emptyIncidentCommandState(): IncidentCommandState {
  return {
    revision: 0,
    radioChannel: "",
    positions: emptyPositions(),
    manualUnits: [],
    units: {},
    par: { intervalMinutes: 15, status: "paused", startedAt: null, remainingSeconds: 15 * 60, confirmations: {} },
    building: { floorCount: null, basement: "unknown" },
    searches: {},
    rit: { unitId: "", chiefEmployeeId: "", readiness: "not_reported" },
    rehab: { unitIds: [], chiefEmployeeId: "", assignmentNote: "" },
    hazards: [],
    support: emptySupport(),
    benchmarks: {},
    mayday: { active: false, activatedAt: null, activatedBy: "", resolvedAt: null, resolvedBy: "" },
    closeout: { endedAt: null, endedBy: "" },
    updatedAt: null,
    updatedBy: "",
  };
}

export function parseRespondingUnits(value: unknown) {
  return [...new Set(String(value ?? "").toUpperCase().split(/[^A-Z0-9-]+/).map((unit) => unit.trim()).filter(Boolean))];
}

export function normalizeManualUnit(value: unknown) {
  const unitId = String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase().slice(0, 32);
  if (!unitId || !/^[A-Z0-9][A-Z0-9 .#/-]*$/.test(unitId)) throw new Error("Enter a valid unit name or identifier.");
  return unitId;
}

export function normalizeIncidentCommandState(value: unknown): IncidentCommandState {
  const fallback = emptyIncidentCommandState();
  if (!value || typeof value !== "object") return fallback;
  const candidate = value as Partial<IncidentCommandState>;
  const interval = [10, 15, 20, 30].includes(Number(candidate.par?.intervalMinutes)) ? Number(candidate.par?.intervalMinutes) : 15;
  return {
    ...fallback,
    ...candidate,
    revision: Math.max(0, Number(candidate.revision) || 0),
    radioChannel: String(candidate.radioChannel ?? "").slice(0, 80),
    positions: Object.fromEntries(commandPositions.map((position) => [position, String(candidate.positions?.[position] ?? "").slice(0, 120)])) as Record<CommandPosition, string>,
    manualUnits: Array.isArray(candidate.manualUnits) ? [...new Set(candidate.manualUnits.map((unit) => normalizeManualUnit(unit)))] : [],
    units: candidate.units && typeof candidate.units === "object" ? candidate.units : {},
    par: {
      ...fallback.par,
      ...(candidate.par ?? {}),
      intervalMinutes: interval,
      remainingSeconds: Math.max(0, Number(candidate.par?.remainingSeconds) || interval * 60),
      confirmations: candidate.par?.confirmations ?? {},
    },
    building: { ...fallback.building, ...(candidate.building ?? {}) },
    searches: candidate.searches ?? {},
    rit: { ...fallback.rit, ...(candidate.rit ?? {}) },
    rehab: { ...fallback.rehab, ...(candidate.rehab ?? {}), assignmentNote: String(candidate.rehab?.assignmentNote ?? "").slice(0, 120) },
    hazards: Array.isArray(candidate.hazards) ? candidate.hazards.filter((hazard) => hazard && typeof hazard === "object").map((hazard) => ({
      id: String(hazard.id ?? "").slice(0, 80),
      label: String(hazard.label ?? "").slice(0, 80),
      floor: String(hazard.floor ?? "").slice(0, 40),
      side: (["A", "B", "C", "D"].includes(String(hazard.side)) ? String(hazard.side) : "") as TacticalHazard["side"],
      createdAt: String(hazard.createdAt ?? ""),
      createdBy: String(hazard.createdBy ?? "").slice(0, 120),
    })).filter((hazard) => hazard.id && hazard.label) : [],
    support: { ...fallback.support, ...(candidate.support ?? {}) },
    benchmarks: candidate.benchmarks ?? {},
    mayday: { ...fallback.mayday, ...(candidate.mayday ?? {}) },
    closeout: { ...fallback.closeout, ...(candidate.closeout ?? {}) },
  };
}

type ReduceContext = { actor: string; now: string; validPersonnel: Set<string>; validUnits: Set<string>; validLevels: Set<string> };
type ReduceResult = { state: IncidentCommandState; eventType: string; summary: string };

function oneOf<T extends readonly string[]>(values: T, value: unknown, label: string): T[number] {
  if (!values.includes(String(value) as T[number])) throw new Error(`Select a valid ${label}.`);
  return String(value) as T[number];
}

function validEmployee(value: string, context: ReduceContext) {
  if (value && !context.validPersonnel.has(value)) throw new Error("Select an authorized active employee.");
  return value;
}

function validChiefAssignee(value: string, context: ReduceContext) {
  const assignee = String(value ?? "").trim();
  if (!assignee || context.validPersonnel.has(assignee)) return assignee;
  if (assignee.startsWith("manual:")) {
    const label = assignee.slice(7).trim().replace(/\s+/g, " ").slice(0, 80);
    if (!label) throw new Error("Enter a chief name or unit.");
    return `manual:${label}`;
  }
  throw new Error("Select a roster member or enter a chief name or unit.");
}

function validUnit(value: string, context: ReduceContext) {
  if (!value || !context.validUnits.has(value)) throw new Error("Select an incident or manually added unit.");
  return value;
}

function validCommandAssignee(value: string, context: ReduceContext) {
  const assignee = String(value ?? "").trim();
  if (!assignee) return "";
  if (context.validPersonnel.has(assignee)) return assignee;
  if (assignee.startsWith("unit:")) {
    const unitId = validUnit(assignee.slice(5).trim().toUpperCase(), context);
    return `unit:${unitId}`;
  }
  if (assignee.startsWith("manual:")) {
    const label = assignee.slice(7).trim().replace(/\s+/g, " ").slice(0, 80);
    if (!label) throw new Error("Enter a name or unit for the command position.");
    return `manual:${label}`;
  }
  throw new Error("Select an on-scene unit or enter a name or unit.");
}

function remainingParSeconds(state: IncidentCommandState, now: string) {
  if (state.par.status !== "running" || !state.par.startedAt) return state.par.remainingSeconds;
  const elapsed = Math.max(0, Math.floor((Date.parse(now) - Date.parse(state.par.startedAt)) / 1000));
  return Math.max(0, state.par.remainingSeconds - elapsed);
}

export function reduceIncidentCommandState(current: IncidentCommandState, mutation: CommandAction, context: ReduceContext): ReduceResult {
  const state = structuredClone(normalizeIncidentCommandState(current));
  let eventType: string = mutation.action;
  let summary: string = mutation.action;

  if (state.closeout.endedAt) throw new Error("This incident is closed. Reopen the active incident from CAD before making more changes.");

  if (mutation.action === "set-radio") {
    state.radioChannel = mutation.radioChannel.trim().slice(0, 80);
    summary = state.radioChannel ? `Radio channel set to ${state.radioChannel}` : "Radio channel cleared";
  } else if (mutation.action === "assign-position") {
    const position = oneOf(commandPositions, mutation.position, "command position");
    state.positions[position] = validCommandAssignee(mutation.assignee, context);
    summary = `${position} ${mutation.assignee ? "assigned" : "cleared"}`;
  } else if (mutation.action === "add-manual-unit") {
    const unitId = normalizeManualUnit(mutation.unitId);
    if (context.validUnits.has(unitId) || state.manualUnits.includes(unitId)) throw new Error(`${unitId} is already listed on this incident.`);
    state.manualUnits = [...state.manualUnits, unitId];
    state.units[unitId] = { assignment: "Staging", status: "On scene", floor: "", side: "", crewStrength: null };
    summary = `${unitId} manually added on scene`;
  } else if (mutation.action === "assign-unit") {
    const unitId = validUnit(mutation.unitId, context);
    const existing = state.units[unitId] ?? { assignment: "Staging", status: "Responding", floor: "", side: "", crewStrength: null };
    const crewStrength = mutation.crewStrength == null ? existing.crewStrength : Math.max(1, Math.min(20, Math.round(Number(mutation.crewStrength))));
    const floor = String(mutation.floor ?? existing.floor).slice(0, 40);
    if (floor && !context.validLevels.has(floor)) throw new Error("Select a valid tactical level.");
    state.units[unitId] = {
      assignment: oneOf(tacticalAssignments, mutation.assignment, "tactical assignment"),
      status: mutation.status ? oneOf(unitStatuses, mutation.status, "unit status") : existing.status,
      floor,
      side: mutation.side && ["A", "B", "C", "D"].includes(mutation.side) ? mutation.side : "",
      crewStrength: Number.isFinite(crewStrength) ? crewStrength : null,
    };
    if (state.units[unitId].assignment === "Rehab") {
      state.units[unitId].status = "Rehab";
      state.rehab.unitIds = [...new Set([...state.rehab.unitIds, unitId])];
    } else {
      state.rehab.unitIds = state.rehab.unitIds.filter((candidate) => candidate !== unitId);
    }
    if (state.units[unitId].assignment === "Primary Search" && floor && (state.searches[floor]?.primary ?? "not_started") === "not_started") {
      state.searches[floor] = { ...(state.searches[floor] ?? {}), primary: "in_progress" };
      summary = `${unitId} assigned to Primary Search on ${floor}; primary search started`;
    } else {
      summary = `${unitId} assigned to ${state.units[unitId].assignment}${floor ? ` on ${floor}` : ""}${state.units[unitId].side ? ` Side ${state.units[unitId].side}` : ""}`;
    }
  } else if (mutation.action === "set-par-interval") {
    const interval = Number(mutation.intervalMinutes);
    if (![10, 15, 20, 30].includes(interval)) throw new Error("Select a valid PAR interval.");
    state.par = { intervalMinutes: interval, status: "paused", startedAt: null, remainingSeconds: interval * 60, confirmations: {} };
    summary = `PAR interval set to ${interval} minutes`;
  } else if (mutation.action === "toggle-par") {
    if (state.par.status === "running") {
      state.par.remainingSeconds = remainingParSeconds(state, context.now);
      state.par.status = "paused";
      state.par.startedAt = null;
      summary = "PAR countdown paused";
    } else {
      state.par.status = "running";
      state.par.startedAt = context.now;
      summary = "PAR countdown resumed";
    }
  } else if (mutation.action === "reset-par") {
    state.par = { ...state.par, status: "running", startedAt: context.now, remainingSeconds: state.par.intervalMinutes * 60, confirmations: {} };
    summary = "PAR countdown reset; confirmations cleared";
  } else if (mutation.action === "confirm-par-unit") {
    const unitId = validUnit(mutation.unitId, context);
    state.par.confirmations[unitId] = { confirmedBy: context.actor, confirmedAt: context.now };
    summary = `PAR confirmed for ${unitId}`;
  } else if (mutation.action === "set-building") {
    const floorCount = mutation.floorCount == null ? null : Math.max(1, Math.min(99, Math.round(Number(mutation.floorCount))));
    state.building = { floorCount, basement: oneOf(["unknown", "present", "none"] as const, mutation.basement, "basement status") };
    summary = "Tactical building profile updated";
  } else if (mutation.action === "set-search") {
    if (!context.validLevels.has(mutation.level)) throw new Error("Select a valid tactical level.");
    const phase = oneOf(searchPhases, mutation.phase, "search phase");
    const status = oneOf(searchStatuses, mutation.status, "search status");
    state.searches[mutation.level] = { ...(state.searches[mutation.level] ?? {}), [phase]: status };
    summary = `${mutation.level} ${phase} search marked ${status.replaceAll("_", " ")}`;
  } else if (mutation.action === "set-rit") {
    state.rit = {
      unitId: mutation.unitId ? validUnit(mutation.unitId, context) : "",
      chiefEmployeeId: validEmployee(mutation.chiefEmployeeId, context),
      readiness: oneOf(["not_reported", "assembling", "ready"] as const, mutation.readiness, "RIT readiness"),
    };
    summary = `RIT status set to ${state.rit.readiness.replaceAll("_", " ")}`;
  } else if (mutation.action === "set-rehab") {
    const unitIds = [...new Set(mutation.unitIds.map((unit) => validUnit(unit, context)))];
    state.rehab = {
      unitIds,
      chiefEmployeeId: validChiefAssignee(mutation.chiefEmployeeId, context),
      assignmentNote: String(mutation.assignmentNote ?? "").trim().replace(/\s+/g, " ").slice(0, 120),
    };
    for (const unitId of unitIds) {
      const existing = state.units[unitId] ?? { assignment: "Staging" as const, status: "On scene" as const, floor: "", side: "" as const, crewStrength: null };
      state.units[unitId] = { ...existing, assignment: "Rehab", status: "Rehab", floor: "", side: "" };
    }
    summary = `Rehab assignment updated (${state.rehab.unitIds.length} unit${state.rehab.unitIds.length === 1 ? "" : "s"})`;
  } else if (mutation.action === "add-hazard") {
    const label = String(mutation.label ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
    if (!label) throw new Error("Select or type a hazard.");
    const floor = String(mutation.floor ?? "").slice(0, 40);
    if (floor && !context.validLevels.has(floor)) throw new Error("Select a valid hazard level.");
    const side = mutation.side && ["A", "B", "C", "D"].includes(mutation.side) ? mutation.side : "";
    if (!floor && !side) throw new Error("Place the hazard inside a level or on an exterior side.");
    state.hazards.push({ id: crypto.randomUUID(), label, floor, side, createdAt: context.now, createdBy: context.actor });
    summary = `${label} hazard added ${side ? `to Side ${side}` : `inside ${floor}`}`;
  } else if (mutation.action === "remove-hazard") {
    const hazard = state.hazards.find((candidate) => candidate.id === mutation.hazardId);
    if (!hazard) throw new Error("That hazard is no longer on the board.");
    state.hazards = state.hazards.filter((candidate) => candidate.id !== mutation.hazardId);
    summary = `${hazard.label} hazard removed`;
  } else if (mutation.action === "set-support") {
    const resource = oneOf(supportResources, mutation.resource, "support resource");
    state.support[resource] = oneOf(supportStatuses, mutation.status, "support status");
    summary = `${resource} marked ${state.support[resource].replaceAll("_", " ")}`;
  } else if (mutation.action === "record-benchmark") {
    const benchmark = oneOf(benchmarkLabels, mutation.benchmark, "incident benchmark");
    state.benchmarks[benchmark] = { recordedAt: context.now, recordedBy: context.actor };
    summary = `${benchmark} recorded`;
  } else if (mutation.action === "set-mayday") {
    const expected = mutation.active ? "CONFIRM MAYDAY" : "RESOLVE MAYDAY";
    if (mutation.confirmation !== expected) throw new Error(`Enter ${expected} to continue.`);
    if (mutation.active) {
      state.mayday = { active: true, activatedAt: context.now, activatedBy: context.actor, resolvedAt: null, resolvedBy: "" };
      summary = "MAYDAY / emergency traffic activated";
    } else {
      state.mayday = { ...state.mayday, active: false, resolvedAt: context.now, resolvedBy: context.actor };
      summary = "MAYDAY / emergency traffic resolved";
    }
    eventType = mutation.active ? "mayday-activated" : "mayday-resolved";
  } else if (mutation.action === "end-call") {
    if (mutation.confirmation !== "END INCIDENT") throw new Error("Enter END INCIDENT to continue.");
    if (state.mayday.active) throw new Error("Resolve the active MAYDAY before ending the incident.");
    state.closeout = { endedAt: context.now, endedBy: context.actor };
    state.par = { ...state.par, status: "paused", startedAt: null, remainingSeconds: remainingParSeconds(state, context.now) };
    state.benchmarks["Incident terminated"] = { recordedAt: context.now, recordedBy: context.actor };
    eventType = "incident-ended";
    summary = "Incident command board ended and locked for reporting";
  }

  state.revision += 1;
  state.updatedAt = context.now;
  state.updatedBy = context.actor;
  return { state, eventType, summary };
}

export function tacticalLevels(state: IncidentCommandState, approvedFloorCount?: number | null) {
  const count = state.building.floorCount || approvedFloorCount || 0;
  const levels = Array.from({ length: count }, (_, index) => `Floor ${count - index}`);
  if (state.building.basement === "present") levels.push("Basement");
  return levels.length ? levels : ["Level unknown"];
}
