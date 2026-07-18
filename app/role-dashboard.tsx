"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Employee = { id: string; name: string; rank: string; phone?: string | null; email?: string | null; driverStatus?: string | null };
type Entry = { employeeId: string; category: string; hours: number };
type DashboardData = {
  viewer: { isAdmin: boolean; displayName: string; employeeId: string | null };
  employees: Employee[];
  entries: Entry[];
  period: { startDate: string; endDate: string; status: string };
  grossPayroll: number;
  reviewCount: number;
  employeeGross: number;
};
type LogSnapshot = { staffing: Array<{ employeeId?: string }>; calls: unknown[]; approvals: Array<{ signInAt?: string; signOutAt?: string; signInEquipment?: string; signOutEquipment?: string }> };

function displayName(value: string) {
  const [last, first] = value.split(",").map((part) => part.trim());
  return first ? `${first} ${last}` : value;
}
function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value); }
function chicagoDate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export default function RoleDashboard({ data, onNavigate }: { data: DashboardData; onNavigate: (page: "Payroll" | "Daily Log" | "My Timesheet" | "Employees" | "Policies" | "Box Cards") => void }) {
  const [log, setLog] = useState<LogSnapshot | null>(null);
  const [resourceCounts, setResourceCounts] = useState({ policies: 0, boxCards: 0 });
  const ownEmployee = data.employees.find((employee) => employee.id === data.viewer.employeeId) ?? data.employees[0];
  const rank = ownEmployee?.rank.toLowerCase() ?? "";
  const isOfficer = !data.viewer.isAdmin && ["chief", "captain", "lieutenant"].some((title) => rank.includes(title));
  const role = data.viewer.isAdmin ? "Administrator" : isOfficer ? "Officer" : "Employee";

  const loadSupportingData = useCallback(async () => {
    const requests: Promise<void>[] = [fetch("/api/resources?type=policy").then(async (response) => { const result = await response.json() as { items?: unknown[] }; setResourceCounts((current) => ({ ...current, policies: result.items?.length ?? 0 })); }), fetch("/api/resources?type=boxCard").then(async (response) => { const result = await response.json() as { items?: unknown[] }; setResourceCounts((current) => ({ ...current, boxCards: result.items?.length ?? 0 })); })];
    if (data.viewer.isAdmin || isOfficer) requests.push(fetch(`/api/logbook?date=${chicagoDate()}`).then(async (response) => { if (response.ok) setLog(await response.json() as LogSnapshot); }));
    await Promise.all(requests);
  }, [data.viewer.isAdmin, isOfficer]);
  useEffect(() => { const timer = window.setTimeout(() => { void loadSupportingData(); }, 0); return () => window.clearTimeout(timer); }, [loadSupportingData]);

  const ownHours = useMemo(() => data.entries.filter((entry) => entry.employeeId === ownEmployee?.id && entry.category !== "actingOfficer").reduce((sum, entry) => sum + entry.hours, 0), [data.entries, ownEmployee?.id]);
  const missingProfiles = data.employees.filter((employee) => !employee.email || !employee.phone || !employee.driverStatus);
  const staffingCount = log?.staffing.filter((row) => row.employeeId).length ?? 0;
  const approvalCount = log?.approvals.reduce((sum, approval) => sum + (approval.signInAt ? 1 : 0) + (approval.signOutAt ? 1 : 0), 0) ?? 0;
  const equipmentIssues = log?.approvals.reduce((sum, approval) => sum + [approval.signInEquipment, approval.signOutEquipment].filter((value) => value && /(missing|out.of.service|oos)/i.test(value)).length, 0) ?? 0;

  return <section className="role-dashboard">
    <div className="dashboard-welcome"><div><p className="eyebrow">{role} dashboard</p><h1>Welcome, {displayName(data.viewer.displayName)}</h1><p>{data.viewer.isAdmin ? "Payroll, personnel, and department operations at a glance." : isOfficer ? "Today’s staffing, handoffs, equipment, and your current pay period." : "Your current pay period and department resources."}</p></div><span className={`role-badge ${role.toLowerCase()}`}>{role}</span></div>

    {data.viewer.isAdmin ? <>
      <div className="dashboard-metrics"><article><span>Payroll status</span><strong>{data.period.status}</strong><small>{data.period.startDate} – {data.period.endDate}</small></article><article><span>Calculated gross</span><strong>{money(data.grossPayroll)}</strong><small>{data.employees.length} employees</small></article><article className={data.reviewCount ? "metric-warning" : ""}><span>Need payroll review</span><strong>{data.reviewCount}</strong><small>{data.reviewCount ? "Open exceptions" : "No exceptions"}</small></article><article className={missingProfiles.length ? "metric-warning" : ""}><span>Incomplete profiles</span><strong>{missingProfiles.length}</strong><small>Missing email, phone, or driver status</small></article></div>
      <div className="dashboard-columns"><section className="content-card dashboard-panel"><div className="dashboard-panel-head"><div><h2>Today’s operations</h2><p>{chicagoDate()}</p></div><button onClick={() => onNavigate("Daily Log")}>Open Daily Log</button></div><div className="dashboard-stat-list"><div><span>Personnel listed</span><strong>{staffingCount}</strong></div><div><span>Calls recorded</span><strong>{log?.calls.length ?? 0}</strong></div><div><span>Handoff approvals</span><strong>{approvalCount} / 6</strong></div><div className={equipmentIssues ? "attention" : ""}><span>Equipment issues</span><strong>{equipmentIssues}</strong></div></div></section><section className="content-card dashboard-panel"><div className="dashboard-panel-head"><div><h2>Action required</h2><p>Items needing administrator attention</p></div></div>{missingProfiles.length || data.reviewCount ? <div className="action-list">{data.reviewCount > 0 && <button onClick={() => onNavigate("Payroll")}><span>Review payroll exceptions</span><strong>{data.reviewCount} →</strong></button>}{missingProfiles.length > 0 && <button onClick={() => onNavigate("Employees")}><span>Complete employee information</span><strong>{missingProfiles.length} →</strong></button>}{approvalCount < 6 && <button onClick={() => onNavigate("Daily Log")}><span>Complete today’s handoffs</span><strong>{6 - approvalCount} →</strong></button>}</div> : <div className="dashboard-clear">✓ Nothing needs attention.</div>}</section></div>
    </> : <>
      <div className="dashboard-metrics employee-metrics"><article><span>Pay period hours</span><strong>{ownHours.toFixed(1)}</strong><small>{data.period.startDate} – {data.period.endDate}</small></article><article><span>Calculated pay</span><strong>{money(data.employeeGross)}</strong><small>Current period</small></article><article><span>Policies</span><strong>{resourceCounts.policies}</strong><small>Available to review</small></article><article><span>Box Cards</span><strong>{resourceCounts.boxCards}</strong><small>Available to search</small></article></div>
      {isOfficer && <section className="content-card officer-today"><div className="dashboard-panel-head"><div><h2>Officer view · Today</h2><p>Shift readiness and handoff status</p></div></div><div className="dashboard-stat-list four"><div><span>Personnel listed</span><strong>{staffingCount}</strong></div><div><span>Calls</span><strong>{log?.calls.length ?? 0}</strong></div><div><span>Handoff approvals</span><strong>{approvalCount} / 6</strong></div><div className={equipmentIssues ? "attention" : ""}><span>Equipment issues</span><strong>{equipmentIssues}</strong></div></div></section>}
      <section className="dashboard-quick"><h2>Quick access</h2><div><button onClick={() => onNavigate("My Timesheet")}><span>◷</span><strong>My Timesheet</strong><small>Review current hours and pay</small></button><button onClick={() => onNavigate("Policies")}><span>▤</span><strong>Policies</strong><small>Search department policies</small></button><button onClick={() => onNavigate("Box Cards")}><span>⌂</span><strong>Box Cards</strong><small>Find building response information</small></button></div></section>
    </>}
  </section>;
}
