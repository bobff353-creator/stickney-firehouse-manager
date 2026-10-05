import type { PortalPage, PortalRecord } from "./portal-navigation";

export type ShiftPacket = {
  asOf: string;
  date: string;
  currentShift: string;
  staffingSource: string;
  onDuty: Array<{ employeeId: string; name: string; rank: string; timeIn: string; timeOut: string; actingOfficer: number }>;
  officerInCharge: string | null;
  staffing: { filled: number; required: number; complete: boolean };
  equipmentIssues: Array<{ id?: string; item: string; status: string; detail: string }>;
  checksDue: number | null;
  fleet: Array<{ id: string; name: string; status: string }> | null;
  fleetIssuesAvailable: boolean;
  activeCalls: Array<{ reportNumber?: string; callType: string; address: string }> | null;
  approvals: { logs: number | null; payroll: number | null };
  previousShift: { officer: string | null; note: string } | null;
  nextShift: { employeeId: string; workDate: string; startTime: string; endTime: string; role: string } | null;
};
export type AttentionItem = {
  id: string; severity: "critical" | "warning" | "normal"; category: string;
  title: string; detail: string; page: PortalPage; record?: PortalRecord;
};
export type ReadinessPart = { id: string; label: string; state: "ready" | "attention" | "unknown"; detail: string; percent?: number; page?: PortalPage };

// Read-only projection: reference saved source records; never infer assignments,
// create a shift, seed units or change a check from a dashboard visit.
export function shiftOverview(packet: ShiftPacket, allowedPages: readonly PortalPage[]) {
  const can = (page: PortalPage) => allowedPages.includes(page);
  const items: AttentionItem[] = [];
  const parts: ReadinessPart[] = [];
  const { filled, required } = packet.staffing;
  const validStaffing = Number.isFinite(filled) && filled >= 0 && Number.isFinite(required) && required > 0;
  parts.push({ id: "staffing", label: "Staffing", state: validStaffing ? filled >= required ? "ready" : "attention" : "unknown", detail: validStaffing ? `${filled} of ${required} positions · current portal target` : "Staffing target unavailable", percent: validStaffing ? Math.min(100, Math.round(filled / required * 100)) : undefined, page: can("Scheduling") ? "Scheduling" : undefined });
  if (validStaffing && filled < required && can("Scheduling")) items.push({ id: "staffing", severity: "warning", category: "Staffing", title: `${required - filled} staffing position${required - filled === 1 ? "" : "s"} unfilled`, detail: "Review the current crew and schedule.", page: "Scheduling" });
  if (can("Daily Log")) {
    parts.push({ id: "officer", label: "Officer sign-in", state: packet.officerInCharge ? "ready" : "attention", detail: packet.officerInCharge || "No officer sign-in recorded", page: "Daily Log" });
    if (packet.approvals.logs) items.push({ id: "handoff", severity: "warning", category: "Handoff", title: `${packet.approvals.logs} shift handoff action${packet.approvals.logs === 1 ? "" : "s"}`, detail: "Review officer sign-in and the previous period’s sign-out.", page: "Daily Log" });
  }
  if (can("Inventory")) {
    const fleet = packet.fleet;
    const knownFleet = Boolean(fleet?.length) && fleet!.every(unit => ["in_service", "out_of_service"].includes(unit.status));
    const available = fleet?.filter(unit => unit.status === "in_service").length ?? 0;
    parts.push({ id: "fleet", label: "Apparatus service", state: knownFleet ? available === fleet!.length ? "ready" : "attention" : "unknown", detail: fleet === null ? "Fleet status could not be verified" : !fleet.length ? "No apparatus records available" : `${available} of ${fleet.length} loaded apparatus in service`, percent: knownFleet ? Math.round(available / fleet!.length * 100) : undefined, page: "Inventory" });
    for (const unit of fleet ?? []) if (unit.status === "out_of_service") items.push({ id: `fleet-${unit.id}`, severity: "critical", category: "Apparatus", title: `${unit.name} · Out of service`, detail: "Review the saved service status before using this apparatus.", page: "Inventory", record: { adminTask: "service" } });
    parts.push({ id: "checks", label: "Required checks", state: packet.checksDue === null ? "unknown" : packet.checksDue > 0 ? "attention" : "ready", detail: packet.checksDue === null ? "Check schedules could not be verified" : `${packet.checksDue} checks remaining in the loaded daily schedule`, page: "Inventory" });
    if (packet.checksDue) items.push({ id: "checks", severity: "warning", category: "Checks", title: `${packet.checksDue} checks to complete`, detail: "Open the due-check list and continue saved work.", page: "Inventory" });
    parts.push({ id: "equipment", label: "Equipment issues", state: !packet.fleetIssuesAvailable ? "unknown" : packet.equipmentIssues.length ? "attention" : "ready", detail: !packet.fleetIssuesAvailable ? "Fleet issue status could not be verified" : `${packet.equipmentIssues.length} reported issues in the loaded briefing`, page: "Inventory" });
    for (const [index, issue] of packet.equipmentIssues.entries()) items.push({ id: `issue-${issue.id || index}`, severity: /critical|high priority/i.test(issue.status) ? "critical" : "warning", category: "Equipment", title: issue.item, detail: `${issue.status}${issue.detail ? ` · ${issue.detail}` : ""}`, page: "Inventory", record: { adminTask: "service" } });
  }
  if (can("Payroll") && packet.approvals.payroll) items.push({ id: "payroll", severity: "normal", category: "Approval", title: `${packet.approvals.payroll} payroll periods awaiting review`, detail: "Review and finalize through the existing payroll workflow.", page: "Payroll" });
  const order = { critical: 0, warning: 1, normal: 2 };
  items.sort((a, b) => order[a.severity] - order[b.severity] || a.id.localeCompare(b.id));
  // This is a component summary, not an arbitrary department-wide score. Limited
  // module access cannot turn unobserved sources into an operational all-clear.
  const state = parts.some(part => part.state === "attention") ? "attention" : parts.some(part => part.state === "unknown") || !can("Inventory") || !can("Daily Log") ? "unknown" : "ready";
  return { items, parts, state };
}

export function shiftPacketStale(packet: Pick<ShiftPacket, "asOf"> | null, now: number, failed: boolean) {
  const time = Date.parse(packet?.asOf || "");
  return failed || !Number.isFinite(time) || now - time > 120_000 || time > now + 60_000;
}
