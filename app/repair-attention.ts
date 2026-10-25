type Repair = Record<string, unknown>;
const stages = new Set(["new", "assigned", "in_repair", "waiting_parts", "closed"]);

export function repairStage(repair: Repair) {
  const status = repair.status === "open" ? "new" : String(repair.status ?? "");
  return stages.has(status) ? status : "unknown";
}

export function repairAttention(repair: Repair, now = Date.now()) {
  if (repairStage(repair) === "closed") return [];
  const reasons: string[] = [];
  const hasOwner = [repair.assigned_to, ...(Array.isArray(repair.assigned_employee_ids) ? repair.assigned_employee_ids : []), ...(Array.isArray(repair.assigned_employee_names) ? repair.assigned_employee_names : [])]
    .some((owner) => typeof owner === "string" && owner.trim().length > 0);
  if (!hasOwner) reasons.push("Owner not recorded");
  if (repairStage(repair) === "unknown") reasons.push("Status needs review");
  const due = typeof repair.due_at === "string" && repair.due_at.trim() ? Date.parse(repair.due_at) : NaN;
  if (Number.isFinite(due)) {
    if (due < now) reasons.push("Past recorded due date");
  } else {
    reasons.push("Due date not recorded or invalid");
  }
  return reasons;
}
