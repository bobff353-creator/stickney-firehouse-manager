import { airCheckLines } from "./inventory-air-checks.ts";
import { equipmentDueForCheck } from "./inventory-check-recurrence.ts";
import { apparatusCheckRequired, chicagoCalendarDate, scheduledCheckCompleted } from "./lib/fleet-projections.ts";

export type CheckType = "daily" | "weekly" | "inventory" | "air_pack" | "drug";
type Row = Record<string, string | number | boolean | string[] | null>;
type QueueRecords = {
  apparatus: Row[];
  equipment: Row[];
  inspectionSchedules: Row[];
  checks: Row[];
  checkItems: Row[];
  scbaTemplates: Row[];
  scbaEntries: Row[];
};
export type RigJob = {
  type: CheckType;
  activeId: string;
  pending: number;
  total: number;
  configured: number;
  dueTime: string;
  signOutRequired: boolean;
};

export const rigCheckLabels: Record<CheckType, string> = {
  daily: "Daily check",
  weekly: "Weekly mechanical check",
  inventory: "Inventory count",
  air_pack: "Air packs & bottles",
  drug: "Drug inventory",
};

function checkType(value: unknown): value is CheckType {
  return typeof value === "string" && Object.hasOwn(rigCheckLabels, value);
}

export function rigQueue(data: QueueRecords, apparatusId: string, now = new Date()) {
  const due: RigJob[] = [];
  const unfinished: RigJob[] = [];
  const exempt: CheckType[] = [];
  const rig = data.apparatus.find(row => row.id === apparatusId);
  if (!rig) return { due, unfinished, exempt };

  const date = chicagoCalendarDate(now);
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const checks = data.checks.filter(row => row.apparatus_id === apparatusId);
  const equipment = data.equipment.filter(row => row.apparatus_id === apparatusId);
  const airTemplate = data.scbaTemplates.find(row => row.apparatus_id === apparatusId && row.active !== false);
  const shown = new Set<string>();

  function job(type: CheckType, active?: Row, schedule?: Row): RigJob {
    const rows = type === "air_pack" ? data.scbaEntries : data.checkItems;
    const items = active ? rows.filter(row => row.check_id === active.id) : [];
    return {
      type,
      activeId: active ? String(active.id) : "",
      pending: items.filter(row => row.result === "pending").length,
      total: items.length,
      configured: schedule ? type === "air_pack" ? airCheckLines(airTemplate, equipment, apparatusId).length
        : equipment.filter(row => equipmentDueForCheck(row, type, now)).length : 0,
      dueTime: String(schedule?.end_time || "").slice(0, 5),
      signOutRequired: schedule?.require_officer_signoff === true,
    };
  }

  for (const schedule of data.inspectionSchedules) {
    const type = schedule.check_type;
    if (schedule.apparatus_id !== apparatusId || Number(schedule.day_of_week) !== day || schedule.active === false || !checkType(type)) continue;
    if (!apparatusCheckRequired(rig.status, type)) {
      exempt.push(type);
      continue;
    }
    const matches = checks.filter(row => row.check_type === type);
    if (matches.some(row => scheduledCheckCompleted(row, type, date))) continue;
    const active = matches.find(row => row.status === "in_progress");
    if (active) shown.add(String(active.id));
    due.push(job(type, active, schedule));
  }
  for (const check of checks) {
    const type = check.check_type;
    if (check.status === "in_progress" && checkType(type) && apparatusCheckRequired(rig.status, type) && !shown.has(String(check.id))) {
      unfinished.push(job(type, check));
    }
  }
  due.sort((left, right) => Number(Boolean(right.activeId)) - Number(Boolean(left.activeId)) || left.dueTime.localeCompare(right.dueTime));
  return { due, unfinished, exempt };
}

export function otherRigChecks(data: QueueRecords, apparatusId: string, now = new Date()): RigJob[] {
  const rig = data.apparatus.find(row => row.id === apparatusId);
  if (!rig) return [];
  const queue = rigQueue(data, apparatusId, now);
  const shown = new Set([...queue.due, ...queue.unfinished].map(job => job.type));
  const equipment = data.equipment.filter(row => row.apparatus_id === apparatusId && !row.retired_at);
  const template = data.scbaTemplates.find(row => row.apparatus_id === apparatusId && row.active !== false);
  return (Object.keys(rigCheckLabels) as CheckType[]).flatMap(type => {
    if (shown.has(type) || !apparatusCheckRequired(rig.status, type)) return [];
    const configured = type === "air_pack" ? airCheckLines(template, equipment, apparatusId).length
      : equipment.filter(row => equipmentDueForCheck(row, type, now)).length;
    return configured ? [{ type, activeId: "", pending: 0, total: 0, configured, dueTime: "", signOutRequired: false }] : [];
  });
}
