"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { formatEmployeeName } from "./employee-names";
import { matchingTimeBlock, scheduleTimeBlocks } from "./schedule-time";
import { qualifiedForScheduleRole } from "./schedule-eligibility";

type Employee = { id:string; name:string; rank:string; email:string; phone:string; scheduleSmsOptIn:number; actingOfficerEligible:number; driverStatus:string };
type TestMember = { id:string; name:string; rank:string; effectivePermissions:string[] };
type Assignment = {
  id:string; employeeId:string|null; employeeName?:string; workDate:string; startTime:string; endTime:string; role:string;
  source:string; status:string; emergency:number; requiredRank:string; claimDeadline:string; notes:string;
};
type Rotation = {
  id:string; name:string; startDate:string; endDate:string; startTime:string; endTime:string; cycleDays:number;
  dutyDays:string; role:string; coveragePlanId:string; members:string; active:number;
};
type Request = {
  id:string; requestType:string; employeeId:string; employeeName:string; assignmentId?:string; targetEmployeeId?:string;
  targetEmployeeName?:string; startDate:string; endDate:string; role:string; repeatMode:string; repeatInterval:number; status:string; targetStatus:string; notes:string;
};
type Notification = { id:string; title:string; message:string; email:number; sms:number; deliveryStatus:string; readAt?:string; createdAt:string };
type NotificationRule = { eventType:string; label:string; active:number|boolean; emailEnabled:number|boolean; smsEnabled:number|boolean; deliveryTimings:string; updatedAt:string };
type CoverageRule = { id:string; planId:string; name:string; role:string; minimumStaff:number; startTime:string; endTime:string; daysOfWeek:string; active:number };
type CoverageGap = {
  date:string; ruleId:string; name:string; role:string; startTime:string; endTime:string; minimumStaff:number; scheduled:number; shortBy:number;
};
type ShiftPattern = {
  id:string; name:string; color:string; startDate:string; startTime:string; endTime:string; recurrenceDays:number; coveragePlanId:string; active:number;
};
type StaffingOverride = {
  id:string; patternId:string; name:string; conditionType:string; role:string; minimumStaff:number; active:number;
};
type ScheduleData = {
  viewer:{ employeeId:string|null; isAdmin:boolean; rank:string; profileEmail:string; phone:string; smsOptIn:boolean; actingOfficerEligible:boolean };
  employees:Employee[]; assignments:Assignment[]; rotations:Rotation[]; requests:Request[]; notifications:Notification[];
  coverageRules:CoverageRule[]; coverageGaps:CoverageGap[]; shiftPatterns:ShiftPattern[]; staffingOverrides:StaffingOverride[]; notificationRules:NotificationRule[];
  tradeEligibility:Record<string,string[]>;
  settings:{ openShiftsVisibleThrough:string };
};

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const plusDays = (value:string, count:number) => {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + count);
  return date.toLocaleDateString("en-CA");
};
const requestLabels:Record<string,string> = {
  availability: "Availability", time_off: "Time Off", shift_claim: "Open Shift", trade: "Trade / Give Away",
};
const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const stationRosterMarks:Record<string,string> = {
  calendar: "▦", patterns: "◫", coverage: "◆", rotations: "↻", open: "+", requests: "⇄", request: "✓", alerts: "●",
};
const stationShiftColors = [
  { name: "Engine red", value: "#C83E32", family: "Red" },
  { name: "Ember red", value: "#E25A45", family: "Red" },
  { name: "Brass gold", value: "#C9942E", family: "Gold" },
  { name: "Station gold", value: "#E0B24C", family: "Gold" },
  { name: "Midnight black", value: "#172126", family: "Black" },
  { name: "Graphite black", value: "#303A3F", family: "Black" },
] as const;
const stationColor = (value:string) => ({ red: "#C83E32", gold: "#C9942E", black: "#172126", blue: "#2D6CDF", green: "#168A70", purple: "#6B5CA5", orange: "#D97832" }[value.toLowerCase()] || value || "#303A3F");
const initials = (value:string) => value.split(/\s|@/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "FD";
const departmentPositions = [
  "Duty Crew",
  "Chief Officer",
  "Officer/AO",
  "Driver/Engineer",
  "Ambulance Driver",
  "Ambulance Attendant",
  "Interior Firefighter",
  "Exterior Firefighter",
  "Firefighter",
  "Paramedic",
  "EMT",
  "Fire Prevention",
  "Detail",
];
const friendlyDate = (value:string) => new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const daysBetween = (start:string, end:string) => Math.floor((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86400000);
const patternOccurs = (pattern:ShiftPattern, date:string) => {
  const offset = daysBetween(pattern.startDate, date);
  return Boolean(pattern.active) && offset >= 0 && offset % pattern.recurrenceDays === 0;
};
const qualifiedForPosition = (employee:Pick<Employee,"rank"|"actingOfficerEligible"|"driverStatus">, role:string) =>
  qualifiedForScheduleRole(employee, role);
const employeeQualificationLabels = (employee:Employee) => {
  const labels = [employee.rank || "Member"];
  if (employee.actingOfficerEligible) labels.push("Acting Officer");
  if (employee.driverStatus) labels.push(employee.driverStatus);
  return [...new Set(labels.filter(Boolean))];
};

function TimeBlockSelect({ startTime, endTime, onChange }:{ startTime:string; endTime:string; onChange:(startTime:string,endTime:string)=>void }) {
  return <label className="wide"><span>Quick time block</span><select value={matchingTimeBlock(startTime, endTime)} onChange={(event) => {
    const block = scheduleTimeBlocks.find((item) => item.id === event.target.value);
    if (block) onChange(block.startTime, block.endTime);
  }}>
    {scheduleTimeBlocks.map((block) => <option key={block.id} value={block.id}>{block.label}</option>)}
    <option value="custom">Custom start and end</option>
  </select><small>Selecting Afternoon automatically enters 12:00 PM through 6:00 PM.</small></label>;
}

export default function Scheduling({ testMember = null }:{ testMember?:TestMember|null }) {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [tab, setTab] = useState("calendar");
  const [month, setMonth] = useState(today().slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today());
  const [selectedDayPanelOpen, setSelectedDayPanelOpen] = useState(false);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [rotation, setRotation] = useState({
    name: "Red", employeeId: "", coveragePlanId: "", role: "", startDate: today(), endDate: plusDays(today(), 365), cycleDays: "3",
  });
  const [shift, setShift] = useState({
    employeeId: "", workDate: today(), startTime: "06:00", endTime: "18:00", role: "Firefighter",
    emergency: false, requiredRank: "", claimDeadline: "", notes: "",
  });
  const [request, setRequest] = useState({
    requestType: "availability", assignmentId: "", targetEmployeeId: "", startDate: today(), endDate: today(),
    startTime: "06:00", endTime: "18:00", role: "Firefighter", repeatMode: "none", repeatInterval: "2", notes: "",
  });
  const [coverage, setCoverage] = useState({
    name: "24-hour minimum staffing", startTime: "06:00", endTime: "06:00",
  });
  const [coveragePositions, setCoveragePositions] = useState([
    { id: "position-1", role: "Officer/AO", minimumStaff: "1" },
    { id: "position-2", role: "Driver/Engineer", minimumStaff: "1" },
  ]);
  const [coverageDays, setCoverageDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [shiftPattern, setShiftPattern] = useState({
    name: "Red", color: "#C83E32", startDate: today(), recurrenceDays: "3", coveragePlanId: "",
  });
  const [staffingOverride, setStaffingOverride] = useState({
    patternId: "", conditionType: "weekend", role: "Firefighter", minimumStaff: "5",
  });

  const load = useCallback(async () => {
    const response = await fetch(testMember ? `/api/scheduling?testEmployeeId=${encodeURIComponent(testMember.id)}` : "/api/scheduling");
    const payload = await response.json() as ScheduleData & { error?:string };
    if (!response.ok) throw new Error(payload.error || "Unable to load scheduling");
    setData(payload);
  }, [testMember]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch((reason) => setError(reason.message)); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function act(payload:Record<string,unknown>, success:string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/scheduling", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(testMember ? { ...payload, testEmployeeId: testMember.id } : payload),
      });
      const result = await response.json() as { error?:string; assignmentsCreated?:number };
      if (!response.ok) throw new Error(result.error || "Unable to save");
      setMessage(result.assignmentsCreated != null ? `${success} · ${result.assignmentsCreated} assignments created` : success);
      await load();
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const days = useMemo(() => {
    const first = new Date(`${month}-01T12:00:00`);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date.toLocaleDateString("en-CA");
    });
  }, [month]);
  const calendarTitle = useMemo(() => new Date(`${month}-01T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" }), [month]);

  const isCommandView = Boolean(data?.viewer.isAdmin && !testMember);
  const portalEmployeeId = testMember?.id ?? data?.viewer.employeeId ?? null;
  const portalEmployee = data?.employees.find((employee) => employee.id === portalEmployeeId);
  const portalRank = testMember?.rank ?? data?.viewer.rank ?? "";
  const portalActingOfficerEligible = Boolean(portalEmployee?.actingOfficerEligible ?? data?.viewer.actingOfficerEligible);
  const portalDriverStatus = portalEmployee?.driverStatus ?? "";
  const portalAssignments = useMemo(() => (data?.assignments ?? []).filter((item) => isCommandView || item.employeeId === portalEmployeeId || item.status === "open"), [data, isCommandView, portalEmployeeId]);
  const portalRequests = useMemo(() => (data?.requests ?? []).filter((item) => isCommandView || item.employeeId === portalEmployeeId || item.targetEmployeeId === portalEmployeeId || (item.requestType === "trade" && !item.targetEmployeeId && Boolean(item.assignmentId && portalEmployeeId && data?.tradeEligibility?.[item.assignmentId]?.includes(portalEmployeeId)))), [data, isCommandView, portalEmployeeId]);
  const roles = useMemo(() => [...new Set(portalAssignments.map((item) => item.role).filter(Boolean))].sort(), [portalAssignments]);
  const filteredAssignments = useMemo(() => portalAssignments.filter((item) =>
    (!employeeFilter || item.employeeId === employeeFilter) &&
    (!roleFilter || item.role === roleFilter) &&
    (!statusFilter || item.status === statusFilter)
  ), [employeeFilter, portalAssignments, roleFilter, statusFilter]);
  const openShiftsVisibleThrough = data?.settings?.openShiftsVisibleThrough ?? plusDays(today(), 120);
  const openShifts = portalAssignments.filter((item) => item.status === "open" && (isCommandView || item.workDate <= openShiftsVisibleThrough));
  const ownAssignments = portalAssignments.filter((item) => item.employeeId === portalEmployeeId);
  const upcomingOwnAssignments = ownAssignments.filter((item) => item.workDate >= today());
  const selectedTradeAssignment = ownAssignments.find((item) => item.id === request.assignmentId);
  const eligibleTradeEmployeeIds = new Set(data?.tradeEligibility?.[request.assignmentId] ?? []);
  const eligibleTradeEmployees = (data?.employees ?? []).filter((employee) => eligibleTradeEmployeeIds.has(employee.id));
  const portalIsEligibleForTrade = (item:Request) => Boolean(item.assignmentId && portalEmployeeId && data?.tradeEligibility?.[item.assignmentId]?.includes(portalEmployeeId));
  const incomingTrades = portalRequests.filter((item) => item.requestType === "trade" && item.status === "pending" && (item.targetEmployeeId === portalEmployeeId || (!item.targetEmployeeId && portalIsEligibleForTrade(item))));
  const selectedDayOwnAssignments = ownAssignments.filter((item) => item.workDate === selectedDate);
  const selectedDayOpenShifts = openShifts.filter((item) => item.workDate === selectedDate);
  const selectedDayIncomingTrades = incomingTrades.filter((item) => item.startDate === selectedDate);
  const upcomingGaps = data?.coverageGaps.filter((gap) => gap.date >= today()).slice(0, 20) ?? [];
  const ranks = [...new Set(data?.employees.map((employee) => employee.rank) ?? [])].sort();
  const unread = data?.notifications.filter((item) => !item.readAt).length ?? 0;
  const coveragePlans = useMemo(() => {
    const plans = new Map<string, CoverageRule[]>();
    for (const rule of data?.coverageRules.filter((item) => item.active) ?? []) {
      const key = rule.planId || [rule.name, rule.startTime, rule.endTime, rule.daysOfWeek].join("|");
      plans.set(key, [...(plans.get(key) ?? []), rule]);
    }
    return [...plans.entries()];
  }, [data]);
  const selectedRotationPlan = coveragePlans.find(([, rules]) => (rules[0].planId || rules[0].id) === rotation.coveragePlanId)?.[1] ?? [];
  const selectedRotationRule = selectedRotationPlan.find((rule) => rule.role === rotation.role) ?? selectedRotationPlan[0];
  const tabs = isCommandView
    ? [["calendar", "Schedule"], ["patterns", "Shift editor"], ["open", "Open shifts"], ["requests", "Requests & trades"], ["alerts", "Personnel & reminders"]]
    : [["calendar", "Calendar"], ["request", "Requests"], ["open", "Open shifts & trades"], ["alerts", "Reminder settings"]];

  function changeMonth(offset:number) {
    const date = new Date(`${month}-01T12:00:00`);
    date.setMonth(date.getMonth() + offset);
    setMonth(date.toLocaleDateString("en-CA").slice(0, 7));
  }

  function updateNotificationRule(eventType:string, update:Partial<NotificationRule>) {
    setData((current) => current ? {
      ...current,
      notificationRules: current.notificationRules.map((rule) => rule.eventType === eventType ? { ...rule, ...update } : rule),
    } : current);
  }

  function toggleNotificationTiming(rule:NotificationRule, timing:string) {
    const selected = new Set<string>(JSON.parse(rule.deliveryTimings || '["immediate"]'));
    if (selected.has(timing)) {
      if (selected.size > 1) selected.delete(timing);
    } else selected.add(timing);
    updateNotificationRule(rule.eventType, { deliveryTimings: JSON.stringify([...selected]) });
  }
  function moveCalendar(offset:number) {
    changeMonth(offset);
    setSelectedDayPanelOpen(false);
  }
  function goToday() {
    const current = today();
    setSelectedDate(current);
    setMonth(current.slice(0, 7));
    setSelectedDayPanelOpen(false);
  }

  function startNewCoveragePlan(announce = true, planNumber = coveragePlans.length + 1) {
    setCoverage({ name: `Minimum Staffing Plan ${planNumber}`, startTime: "06:00", endTime: "06:00" });
    setCoveragePositions([
      { id: `position-${Date.now()}-1`, role: "Officer/AO", minimumStaff: "1" },
      { id: `position-${Date.now()}-2`, role: "Driver/Engineer", minimumStaff: "1" },
    ]);
    setCoverageDays([0, 1, 2, 3, 4, 5, 6]);
    if (announce) setMessage("New staffing plan ready.");
  }

  async function saveCoveragePlan() {
    const saved = await act({
      action: "saveCoverageRule",
      ...coverage,
      positions: coveragePositions.map((position) => ({ role: position.role, minimumStaff: Number(position.minimumStaff) })),
      daysOfWeek: coverageDays,
    }, "Minimum staffing plan saved");
    if (saved) startNewCoveragePlan(false, coveragePlans.length + 2);
  }

  if (!data) {
    return <div className="schedule-page employee-schedule-portal"><section className="content-card"><p>{error || "Loading department schedule…"}</p></section></div>;
  }

  function startSelectedDayRequest(requestType:"availability"|"trade") {
    const assignment = selectedDayOwnAssignments[0];
    setRequest((current) => ({
      ...current,
      requestType,
      assignmentId: requestType === "trade" ? assignment?.id || "" : "",
      targetEmployeeId: "",
      startDate: selectedDate,
      endDate: selectedDate,
      startTime: assignment?.startTime || current.startTime,
      endTime: assignment?.endTime || current.endTime,
      role: assignment?.role || current.role,
      repeatMode: "none",
    }));
    setTab("request");
  }

  const pendingRequests = data.requests.filter((item) => item.status === "pending").length;
  const profileName = portalEmployee?.name || data.viewer.profileEmail || "Signed-in member";

  return <div className={`station-roster-scope schedule-page employee-schedule-portal ${tab === "calendar" ? "calendar-active" : ""}`} data-test-interactive={testMember ? "true" : undefined}>
    <datalist id="schedule-position-options">{departmentPositions.map((position) => <option key={position} value={position}/>)}</datalist>
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-row"><div className="brand-mark">SR</div><div><strong>Station Roster</strong><span>Fire & EMS scheduling</span></div></div>
        <div className="workspace-label">Workspace</div>
        <nav className="main-nav" aria-label={isCommandView ? "Administrator scheduling" : "Employee scheduling"}>
          {tabs.map(([key, label]) => {
            const count = key === "requests" ? pendingRequests : key === "open" ? openShifts.length + incomingTrades.length : key === "alerts" ? unread : 0;
            return <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}><span className="nav-mark">{stationRosterMarks[key] || "•"}</span><span>{label}</span>{count > 0 && <b>{count}</b>}</button>;
          })}
        </nav>
        {isCommandView && <div className="readiness-card"><span className="live-dot"/><strong>Live department roster</strong><p>{data.employees.length} active members and {data.shiftPatterns.length} repeating shift rules.</p><div className="progress"><i style={{ width: `${Math.min(100, 35 + data.shiftPatterns.length * 8)}%` }}/></div></div>}
        <div className="sidebar-bottom"><div className="profile-row"><div className="avatar">{initials(profileName)}</div><div><strong>{formatEmployeeName(profileName)}</strong><span>{isCommandView ? "Administrator" : portalRank || "Employee"}</span></div><span aria-hidden="true">•••</span></div></div>
      </aside>
      <section className="content-area">
        <header className="topbar"><div><span className="mobile-brand">Station Roster</span><h1>{isCommandView ? "Scheduling command" : "My schedule"}</h1><p>{isCommandView ? "Build the roster, fill vacancies, and keep every seat covered." : "See your shifts, request openings, and manage trades."}</p></div><div className="top-actions"><button className="notice-button" aria-label="Scheduling notifications" onClick={() => setTab("alerts")}>●{unread > 0 && <span>{unread}</span>}</button>{isCommandView && <button className="primary-button" onClick={() => setTab("patterns")}>+ New shift</button>}</div></header>

        <div className="metric-grid">
          <button className="metric-card" onClick={() => setTab("calendar")}><span className="metric-icon coral">▦</span><div><span>{isCommandView ? "Active personnel" : "Upcoming shifts"}</span><strong>{isCommandView ? data.employees.length : upcomingOwnAssignments.length}</strong><small>{isCommandView ? "Roster available" : "Confirmed assignments"}</small></div></button>
          <button className="metric-card" onClick={() => setTab(isCommandView ? "requests" : "request")}><span className="metric-icon blue">✓</span><div><span>Pending requests</span><strong>{pendingRequests}</strong><small>Awaiting review</small></div></button>
          <button className="metric-card" onClick={() => setTab("open")}><span className="metric-icon gold">⇄</span><div><span>Open opportunities</span><strong>{openShifts.length + incomingTrades.length}</strong><small>Shifts and eligible trades</small></div></button>
          <button className="metric-card" onClick={() => setTab("alerts")}><span className="metric-icon green">◷</span><div><span>Reminder settings</span><strong>{unread}</strong><small>Unread scheduling notices</small></div></button>
        </div>
    {error && <div className="error-banner">{error}</div>}
    {message && <div className="work-detail-message">{message}</div>}

    {!isCommandView && <section className="employee-schedule-overview" aria-label="Employee schedule overview">
      <article><span>Next assigned shift</span>{upcomingOwnAssignments[0] ? <><strong>{friendlyDate(upcomingOwnAssignments[0].workDate)}</strong><small>{upcomingOwnAssignments[0].startTime}-{upcomingOwnAssignments[0].endTime} · {upcomingOwnAssignments[0].role}</small></> : <strong>No upcoming assignment</strong>}<button onClick={() => setTab("calendar")}>View my calendar</button></article>
      <article><span>Build my schedule</span><strong>Availability & time off</strong><small>Submit one-time or every-N-days requests for chief review.</small><button onClick={() => setTab("request")}>Create schedule request</button></article>
      <article className={incomingTrades.length ? "attention" : ""}><span>Open opportunities</span><strong>{openShifts.length} shift{openShifts.length === 1 ? "" : "s"} · {incomingTrades.length} trade{incomingTrades.length === 1 ? "" : "s"}</strong><small>Request eligible openings or respond to a trade offered to you.</small><button onClick={() => setTab("open")}>Review openings</button></article>
    </section>}

    {tab === "calendar" && <section className="content-card schedule-calendar-card">
      <div className="schedule-command-bar">
        <div className="schedule-calendar-head">
          <button aria-label="Previous month" onClick={() => moveCalendar(-1)}>‹</button>
          <h2>{calendarTitle}</h2>
          <button aria-label="Next month" onClick={() => moveCalendar(1)}>›</button>
          <button className="today-button" onClick={goToday}>Today</button>
        </div>
        <strong className="schedule-month-only">One-month view</strong>
      </div>
      <div className="schedule-filters">
        {isCommandView && <select aria-label="Filter employee" value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}>
          <option value="">All employees</option>
          {data.employees.map((employee) => <option key={employee.id} value={employee.id}>{formatEmployeeName(employee.name)}</option>)}
        </select>}
        <select aria-label="Filter position" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
          <option value="">All positions</option>
          {roles.map((role) => <option key={role}>{role}</option>)}
        </select>
        <select aria-label="Filter status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">Assigned + open</option><option value="assigned">Assigned</option><option value="open">Open only</option>
        </select>
        {(employeeFilter || roleFilter || statusFilter) && <button onClick={() => { setEmployeeFilter(""); setRoleFilter(""); setStatusFilter(""); }}>Clear filters</button>}
      </div>
      <>
        <div className="schedule-weekdays">{weekdayLabels.map((label) => <b key={label}>{label}</b>)}</div>
        {selectedDayPanelOpen && !isCommandView && <section className="employee-day-workspace" aria-label={`Schedule actions for ${friendlyDate(selectedDate)}`}>
          <header><div><span>Selected day</span><h3>{friendlyDate(selectedDate)}</h3><p>Review your assignment, submit a request, or respond to an available shift.</p></div><button onClick={() => setSelectedDayPanelOpen(false)}>Close day details</button></header>
          <div className="employee-day-actions">
            <button onClick={() => startSelectedDayRequest("availability")}><strong>Request Schedule</strong><span>Offer availability or request to work this day</span></button>
            <button disabled={!selectedDayOwnAssignments.length} title={selectedDayOwnAssignments.length ? undefined : "You do not have an assigned shift on this date."} onClick={() => startSelectedDayRequest("trade")}><strong>Request Trade</strong><span>{selectedDayOwnAssignments.length ? "Offer your assigned shift to an eligible member" : "No assigned shift is available to trade"}</span></button>
          </div>
          <div className="employee-day-opportunities">
            <section><header><h4>Open shifts</h4><b>{selectedDayOpenShifts.length}</b></header>{selectedDayOpenShifts.length ? selectedDayOpenShifts.map((item) => { const eligible = qualifiedForPosition({ rank: portalRank, actingOfficerEligible: portalActingOfficerEligible ? 1 : 0, driverStatus: portalDriverStatus }, item.role); return <article key={item.id}><div><strong>{item.role}</strong><span>{item.startTime}-{item.endTime}{item.requiredRank ? ` · ${item.requiredRank} required` : ""}</span></div><button disabled={busy || !eligible} onClick={() => void act({ action: "submitRequest", requestType: "shift_claim", assignmentId: item.id, startDate: item.workDate, endDate: item.workDate, startTime: item.startTime, endTime: item.endTime, role: item.role }, "Shift request sent")}>{eligible ? "Request Open Shift" : "Not eligible"}</button></article>; }) : <p>No open shifts are posted for this date.</p>}</section>
            <section><header><h4>Available trades</h4><b>{selectedDayIncomingTrades.length}</b></header>{selectedDayIncomingTrades.length ? selectedDayIncomingTrades.map((item) => <article key={item.id}><div><strong>{item.role}</strong><span>Offered by {formatEmployeeName(item.employeeName)}{item.notes ? ` · ${item.notes}` : ""}</span></div><button disabled={busy} onClick={() => void act({ action: "respondTrade", id: item.id, decision: "accepted" }, "Trade accepted and sent for chief approval")}>Pick Up Trade</button></article>) : <p>No eligible trades are offered for this date.</p>}</section>
          </div>
        </section>}
        <div className="schedule-calendar view-month">
          {days.map((date) => {
            if (date.slice(0, 7) !== month) return <article key={date} className="outside schedule-empty-day" aria-hidden="true"/>;
            const gaps = data?.coverageGaps.filter((gap) => gap.date === date) ?? [];
            const patterns = data?.shiftPatterns.filter((pattern) => patternOccurs(pattern, date)) ?? [];
            return <article key={date} data-shift-color={patterns[0]?.color || "none"} style={{ "--station-shift-color": stationColor(patterns[0]?.color || "") } as CSSProperties} className={`${date === today() ? "today" : ""} ${gaps.length ? "understaffed" : ""}`}>
              <header><button className="schedule-date-button" aria-label={`Open details for ${friendlyDate(date)}`} onClick={() => { setSelectedDate(date); setSelectedDayPanelOpen(true); }}>{Number(date.slice(8))}</button>{gaps.length > 0 && <b title={gaps.map((gap) => `${gap.role}: short ${gap.shortBy}`).join(", ")}>−{gaps.reduce((sum, gap) => sum + gap.shortBy, 0)} staff</b>}</header>
              <div>{filteredAssignments.filter((item) => item.workDate === date).map((item) => <span key={item.id} className={`${item.status} ${item.emergency ? "emergency" : ""}`}>
                <strong>{item.status === "open" ? "OPEN" : formatEmployeeName(item.employeeName || "")}</strong>
                <small>{item.role} · {item.startTime}-{item.endTime}</small>
              </span>)}</div>
            </article>;
          })}
        </div>
      </>
    </section>}

    {tab === "patterns" && isCommandView && <section className="shift-pattern-command">
      <article className="content-card schedule-form">
        <div className="section-header"><div><p className="eyebrow">Step 1</p><h2>Create shift reference</h2><p>Name and color the shift, choose its first day, then set how often it repeats.</p></div></div>
        <div className="schedule-fields">
          <label><span>Shift reference *</span><input value={shiftPattern.name} onChange={(event) => setShiftPattern({ ...shiftPattern, name: event.target.value })}/><small>Use a preset or enter a department-specific name.</small></label>
          <fieldset className="color-palette-fieldset wide"><legend>Calendar color *</legend><div className="color-palette">{stationShiftColors.map((color) => <label key={color.value} className={shiftPattern.color === color.value ? "selected" : ""}><input type="radio" name="shift-pattern-color" value={color.value} checked={shiftPattern.color === color.value} onChange={() => setShiftPattern({ ...shiftPattern, color: color.value })}/><span className="color-swatch" style={{ background: color.value }}><i>✓</i></span><strong>{color.name}</strong><small>{color.family}</small></label>)}</div></fieldset>
          <label><span>First assigned day *</span><input type="date" value={shiftPattern.startDate} onChange={(event) => setShiftPattern({ ...shiftPattern, startDate: event.target.value })}/></label>
          <label><span>Repeats every *</span><div className="input-unit"><input type="number" min="1" max="365" value={shiftPattern.recurrenceDays} onChange={(event) => setShiftPattern({ ...shiftPattern, recurrenceDays: event.target.value })}/><b>days</b></div><small>Examples: 3, 4, 5, or 6 days.</small></label>
          <label className="wide"><span>Shift requirements *</span><select value={shiftPattern.coveragePlanId} onChange={(event) => setShiftPattern({ ...shiftPattern, coveragePlanId: event.target.value })}><option value="">Select minimum staffing plan</option>{coveragePlans.map(([planId, rules]) => <option key={planId} value={rules[0].planId || rules[0].id}>{rules[0].name} · {rules.map((rule) => `${rule.minimumStaff} ${rule.role}`).join(", ")}</option>)}</select><small>The selected plan controls required positions and staffing for every occurrence.</small></label>
        </div>
        <button className="primary-action" disabled={busy} onClick={() => void act({ action: "saveShiftPattern", ...shiftPattern, recurrenceDays: Number(shiftPattern.recurrenceDays) }, "Shift reference added to calendar")}>Save Shift Pattern</button>
      </article>

      <article className="content-card schedule-form">
        <div className="section-header"><div><p className="eyebrow">Step 2</p><h2>Weekend & holiday staffing</h2><p>Set a higher minimum when this shift falls on a weekend or department holiday.</p></div></div>
        <div className="schedule-fields">
          <label className="wide"><span>Shift reference *</span><select value={staffingOverride.patternId} onChange={(event) => setStaffingOverride({ ...staffingOverride, patternId: event.target.value })}><option value="">Select shift reference</option>{data.shiftPatterns.map((pattern) => <option key={pattern.id} value={pattern.id}>{pattern.name} · every {pattern.recurrenceDays} days</option>)}</select></label>
          <label><span>Special day *</span><select value={staffingOverride.conditionType} onChange={(event) => setStaffingOverride({ ...staffingOverride, conditionType: event.target.value })}><option value="weekend">Weekend</option><option value="holiday">Department holiday</option></select></label>
          <label><span>Position *</span><input list="schedule-position-options" value={staffingOverride.role} onChange={(event) => setStaffingOverride({ ...staffingOverride, role: event.target.value })}/></label>
          <label><span>Required minimum *</span><input type="number" min="1" max="50" value={staffingOverride.minimumStaff} onChange={(event) => setStaffingOverride({ ...staffingOverride, minimumStaff: event.target.value })}/></label>
        </div>
        <button className="primary-action" disabled={busy} onClick={() => void act({ action: "saveStaffingOverride", ...staffingOverride, minimumStaff: Number(staffingOverride.minimumStaff) }, "Special staffing rule saved")}>Add Special Requirement</button>
      </article>

      <article className="content-card shift-pattern-list">
        <div className="section-header"><div><h2>Active shift references</h2><p>These labels are painted onto the Department Schedule calendar.</p></div></div>
        {data.shiftPatterns.length ? data.shiftPatterns.map((pattern) => {
          const requirements = data.coverageRules.filter((rule) => rule.active && (rule.planId || rule.id) === pattern.coveragePlanId);
          const specials = data.staffingOverrides.filter((item) => item.patternId === pattern.id);
          return <div className="shift-pattern-row" key={pattern.id}><i data-color={pattern.color} style={{ background: stationColor(pattern.color) }}/><div><strong>{pattern.name}</strong><span>Starts {friendlyDate(pattern.startDate)} · every {pattern.recurrenceDays} days · {pattern.startTime}–{pattern.endTime}</span><small>{requirements.map((rule) => `${rule.minimumStaff} ${rule.role}`).join(" · ") || "Staffing plan unavailable"}</small>{specials.map((item) => <em key={item.id}>{item.conditionType}: {item.minimumStaff} {item.role}<button aria-label={`Remove ${item.name}`} onClick={() => void act({ action: "deleteStaffingOverride", id: item.id }, "Special staffing rule removed")}>×</button></em>)}</div><button className="danger-link" onClick={() => void act({ action: "deactivateShiftPattern", id: pattern.id }, "Shift reference ended")}>End pattern</button></div>;
        }) : <p className="schedule-empty">No shift references have been created yet.</p>}
      </article>
    </section>}

    {tab === "patterns" && isCommandView && <section className="schedule-two-col station-riding-assignments">
      <article className="content-card schedule-form">
        <div className="section-header"><div><h2>Create minimum staffing plan</h2><p>Each save creates a separate plan. Add as many plans as the department needs.</p></div></div>
        <div className="schedule-fields">
          <label><span>Plan name *</span><input value={coverage.name} onChange={(event) => setCoverage({ ...coverage, name: event.target.value })}/></label>
          <TimeBlockSelect startTime={coverage.startTime} endTime={coverage.endTime} onChange={(startTime, endTime) => setCoverage({ ...coverage, startTime, endTime })}/>
          <label><span>Coverage starts *</span><input type="time" value={coverage.startTime} onChange={(event) => setCoverage({ ...coverage, startTime: event.target.value })}/></label>
          <label><span>Coverage ends *</span><input type="time" value={coverage.endTime} onChange={(event) => setCoverage({ ...coverage, endTime: event.target.value })}/></label>
        </div>
        <div className="coverage-position-builder">
          <header><div><strong>Required positions</strong><small>Add as many different staffing positions as this plan needs.</small></div><button type="button" onClick={() => setCoveragePositions((current) => [...current, { id: `position-${Date.now()}-${current.length}`, role: "Exterior Firefighter", minimumStaff: "1" }])}>+ Add Position</button></header>
          {coveragePositions.map((position, index) => <div key={position.id}>
            <label><span>Position {index + 1}</span><select value={departmentPositions.includes(position.role) ? position.role : "Custom"} onChange={(event) => setCoveragePositions((current) => current.map((item) => item.id === position.id ? { ...item, role: event.target.value === "Custom" ? "" : event.target.value } : item))}>
              {departmentPositions.filter((item) => item !== "Duty Crew").map((item) => <option key={item}>{item}</option>)}
              <option value="Custom">Custom position…</option>
            </select></label>
            {!departmentPositions.includes(position.role) && <label><span>Custom position name</span><input autoFocus value={position.role} placeholder="Enter position" onChange={(event) => setCoveragePositions((current) => current.map((item) => item.id === position.id ? { ...item, role: event.target.value } : item))}/></label>}
            <label><span>Minimum needed</span><input type="number" min="1" max="50" value={position.minimumStaff} onChange={(event) => setCoveragePositions((current) => current.map((item) => item.id === position.id ? { ...item, minimumStaff: event.target.value } : item))}/></label>
            <button type="button" aria-label={`Remove position ${index + 1}`} disabled={coveragePositions.length === 1} onClick={() => setCoveragePositions((current) => current.filter((item) => item.id !== position.id))}>Remove</button>
          </div>)}
        </div>
        <fieldset className="coverage-days"><legend>Applies on *</legend>{weekdayLabels.map((label, day) => <label key={label}><input type="checkbox" checked={coverageDays.includes(day)} onChange={(event) => setCoverageDays((current) => event.target.checked ? [...current, day] : current.filter((item) => item !== day))}/><span>{label}</span></label>)}</fieldset>
        <button className="primary-action" disabled={busy || coveragePositions.some((position) => !position.role.trim() || Number(position.minimumStaff) < 1)} onClick={() => void saveCoveragePlan()}>Save as New Staffing Plan</button>
      </article>
      <article className="content-card">
        <div className="section-header"><div><h2>Saved staffing plans</h2><p>{coveragePlans.length} active plan{coveragePlans.length === 1 ? "" : "s"} · create, keep, and end plans independently.</p></div><button className="secondary-action" onClick={() => startNewCoveragePlan()}>+ New Plan</button></div>
        <div className="coverage-rules">
          {coveragePlans.map(([key, rules]) => <article key={key}>
            <div><strong>{rules[0].name}</strong><p>{rules.map((rule) => `${rule.minimumStaff} × ${rule.role}`).join(" · ")}</p><small>{rules[0].startTime}-{rules[0].endTime} · {rules[0].daysOfWeek.split(",").map((day) => weekdayLabels[Number(day)]).join(", ")}</small></div>
            <button disabled={busy} onClick={() => void act({ action: "deleteCoverageRule", ids: rules.map((rule) => rule.id) }, "Minimum staffing plan ended")}>End Plan</button>
          </article>)}
          {!data.coverageRules.some((rule) => rule.active) && <p className="schedule-empty">Add a rule to start automatic staffing checks.</p>}
        </div>
        <div className="coverage-gap-list">
          <h3>Upcoming staffing gaps</h3>
          {upcomingGaps.map((gap) => <article key={`${gap.ruleId}-${gap.date}`}><time>{friendlyDate(gap.date)}</time><div><strong>{gap.role}</strong><small>{gap.scheduled} scheduled · {gap.minimumStaff} required</small></div><b>Short {gap.shortBy}</b></article>)}
          {!upcomingGaps.length && <p className="coverage-clear">✓ All active coverage rules are satisfied.</p>}
        </div>
      </article>
    </section>}

    {tab === "patterns" && isCommandView && <section className="schedule-two-col station-repeating-shifts">
      <article className="content-card schedule-form">
        <div className="section-header"><div><h2>Add employee rotation</h2><p>Pick the employee and staffing plan, choose the first day and repeat interval, then fill the schedule automatically.</p></div></div>
        {!coveragePlans.length && <div className="schedule-setup-callout"><strong>Create a minimum staffing plan first.</strong><span>Employee rotations use the plan’s positions and working hours.</span><button onClick={() => setTab("coverage")}>Go to Coverage</button></div>}
        <div className="schedule-fields">
          <label><span>Employee *</span><select value={rotation.employeeId} onChange={(event) => setRotation({ ...rotation, employeeId: event.target.value })}><option value="">Select employee</option>{data.employees.filter((employee) => qualifiedForPosition(employee, rotation.role)).map((employee) => <option key={employee.id} value={employee.id}>{formatEmployeeName(employee.name)} · {employee.rank}{employee.actingOfficerEligible ? " · AO eligible" : ""}</option>)}</select></label>
          <label><span>Staffing plan *</span><select value={rotation.coveragePlanId} disabled={!coveragePlans.length} onChange={(event) => {
            const planId = event.target.value;
            const plan = coveragePlans.find(([, rules]) => (rules[0].planId || rules[0].id) === planId)?.[1] ?? [];
            setRotation({ ...rotation, coveragePlanId: planId, role: plan[0]?.role ?? "" });
          }}><option value="">Select staffing plan</option>{coveragePlans.map(([key, rules]) => <option key={key} value={rules[0].planId || rules[0].id}>{rules[0].name} · {rules[0].startTime}-{rules[0].endTime}</option>)}</select></label>
          <label><span>Position in plan *</span><select value={rotation.role} disabled={!selectedRotationPlan.length} onChange={(event) => setRotation({ ...rotation, role: event.target.value })}><option value="">Select position</option>{selectedRotationPlan.map((rule) => <option key={rule.id} value={rule.role}>{rule.role} · minimum {rule.minimumStaff}</option>)}</select></label>
          <label><span>Shift name *</span><select value={rotation.name} onChange={(event) => setRotation({ ...rotation, name: event.target.value })}><option>Red</option><option>Gold</option><option>Black</option></select></label>
          <label><span>Start day *</span><input type="date" value={rotation.startDate} onChange={(event) => {
            const startDate = event.target.value;
            setRotation({ ...rotation, startDate, endDate: rotation.endDate < startDate ? plusDays(startDate, 365) : rotation.endDate });
          }}/></label>
          <label><span>Repeats *</span><select value={rotation.cycleDays} onChange={(event) => setRotation({ ...rotation, cycleDays: event.target.value })}>{Array.from({ length: 60 }, (_, index) => index + 1).map((days) => <option key={days} value={days}>{days === 1 ? "Every day" : `Every ${days} days`}</option>)}</select></label>
          <label><span>Fill schedule through *</span><input type="date" min={rotation.startDate} value={rotation.endDate} onChange={(event) => setRotation({ ...rotation, endDate: event.target.value })}/><small>Defaults to one year. You can shorten or extend it.</small></label>
        </div>
        {selectedRotationRule && <div className="rotation-summary"><span>Will schedule</span><strong>{data.employees.find((employee) => employee.id === rotation.employeeId) ? formatEmployeeName(data.employees.find((employee) => employee.id === rotation.employeeId)?.name || "") : "Selected employee"}</strong><b>{rotation.role || "Select position"} · {selectedRotationRule.startTime}-{selectedRotationRule.endTime} · {Number(rotation.cycleDays) === 1 ? "every day" : `every ${rotation.cycleDays} days`}</b></div>}
        <button className={`primary-action shift-${rotation.name.toLowerCase()}`} disabled={busy || !rotation.employeeId || !rotation.coveragePlanId || !rotation.role || !coveragePlans.length} onClick={() => void act({ action: "createRotation", name: rotation.name, coveragePlanId: rotation.coveragePlanId, role: rotation.role, startDate: rotation.startDate, endDate: rotation.endDate, cycleDays: Number(rotation.cycleDays), employeeIds: [rotation.employeeId] }, `Schedule filled for ${rotation.name} shift`)}>Fill Schedule With Rotation</button>
      </article>
      <article className="content-card">
        <div className="section-header"><div><h2>Rotation manager</h2><p>Ending a rotation removes only future generated assignments and preserves history.</p></div></div>
        <div className="rotation-list">{data.rotations.map((item) => <article key={item.id} className={item.active ? "" : "inactive"}>
          <header><strong><i className={`shift-color shift-${item.name.toLowerCase()}`}/>{item.name} Shift</strong><span>{item.active ? "Active" : "Ended"}</span></header>
          <p>{item.members}</p>
          <dl><div><dt>Dates</dt><dd>{item.startDate} to {item.endDate}</dd></div><div><dt>Hours</dt><dd>{item.startTime}-{item.endTime}</dd></div><div><dt>Repeats</dt><dd>{item.cycleDays === 1 ? "Every day" : `Every ${item.cycleDays} days`}</dd></div><div><dt>Position</dt><dd>{item.role}</dd></div><div><dt>Staffing plan</dt><dd>{coveragePlans.find(([, rules]) => (rules[0].planId || rules[0].id) === item.coveragePlanId)?.[1][0]?.name || "Legacy plan"}</dd></div></dl>
          {Boolean(item.active) && <footer><button disabled={busy} onClick={() => void act({ action: "deactivateRotation", id: item.id }, "Rotation ended; future generated assignments removed")}>End Rotation</button></footer>}
        </article>)}</div>
      </article>
    </section>}

    {tab === "open" && <section className="schedule-two-col">
      {isCommandView && <article className="content-card schedule-form">
        <div className="section-header"><div><h2>Add assignment or open shift</h2><p>Leave employee blank to publish a qualified open shift.</p></div></div>
        <div className="schedule-fields">
          <label><span>Employee</span><select value={shift.employeeId} onChange={(event) => setShift({ ...shift, employeeId: event.target.value })}>
            <option value="">Open to employees</option>{data.employees.filter((employee) => qualifiedForPosition(employee, shift.role)).map((employee) => <option key={employee.id} value={employee.id}>{formatEmployeeName(employee.name)} · {employee.rank}{employee.actingOfficerEligible ? " · AO eligible" : ""}</option>)}
          </select></label>
          <TimeBlockSelect startTime={shift.startTime} endTime={shift.endTime} onChange={(startTime, endTime) => setShift({ ...shift, startTime, endTime })}/>
          {[
            ["Position", "role", "text"], ["Date", "workDate", "date"], ["Start", "startTime", "time"], ["End", "endTime", "time"],
          ].map(([label, key, type]) => <label key={key}><span>{label} *</span><input type={type} list={key === "role" ? "schedule-position-options" : undefined} value={String(shift[key as keyof typeof shift])} onChange={(event) => setShift({ ...shift, [key]: event.target.value })}/></label>)}
          {!shift.employeeId && <><label><span>Required rank</span><select value={shift.requiredRank} onChange={(event) => setShift({ ...shift, requiredRank: event.target.value })}><option value="">Any rank</option>{ranks.map((rank) => <option key={rank}>{rank}</option>)}</select></label>
          <label><span>Response deadline</span><input type="datetime-local" value={shift.claimDeadline} onChange={(event) => setShift({ ...shift, claimDeadline: event.target.value })}/></label></>}
          <label className="schedule-check"><input type="checkbox" checked={shift.emergency} onChange={(event) => setShift({ ...shift, emergency: event.target.checked })}/><span>Emergency coverage alert</span></label>
          <label className="wide"><span>Instructions / qualifications</span><textarea rows={3} value={shift.notes} onChange={(event) => setShift({ ...shift, notes: event.target.value })}/></label>
        </div>
        <button className="primary-action" disabled={busy} onClick={() => void act({ action: "createShift", ...shift }, shift.employeeId ? "Assignment added" : "Open shift published")}>{shift.emergency ? "Send Emergency Coverage Alert" : shift.employeeId ? "Add Assignment" : "Publish Open Shift"}</button>
      </article>}
      <article className="content-card">
        <div className="section-header"><div><h2>Open shifts</h2><p>Only eligible members can request rank-qualified shifts before the deadline.</p></div></div>
        <div className="open-shift-list">
          {!openShifts.length && <p className="schedule-empty">No open shifts.</p>}
          {openShifts.map((item) => <article key={item.id} className={item.emergency ? "emergency" : ""}><div>
            <span>{item.emergency ? "Emergency coverage" : "Open shift"}</span><strong>{item.workDate} · {item.startTime}-{item.endTime}</strong>
            <p>{item.role}{item.requiredRank ? ` · ${item.requiredRank} required` : ""}{item.notes ? ` · ${item.notes}` : ""}</p>
            {item.claimDeadline && <small>Respond by {item.claimDeadline.replace("T", " ")}</small>}
          </div>{!isCommandView && (() => { const eligible = qualifiedForPosition({ rank: portalRank, actingOfficerEligible: portalActingOfficerEligible ? 1 : 0, driverStatus: portalDriverStatus }, item.role); return <button disabled={busy || !eligible} title={eligible ? undefined : "Your employee record is not cleared for this position."} onClick={() => void act({ action: "submitRequest", requestType: "shift_claim", assignmentId: item.id, startDate: item.workDate, endDate: item.workDate, startTime: item.startTime, endTime: item.endTime, role: item.role }, "Shift request sent")}>{eligible ? "Request Shift" : "Not eligible"}</button>; })()}</article>)}
        </div>
      </article>
      {!isCommandView && <article className="content-card">
        <div className="section-header"><div><h2>Trades offered to me</h2><p>Accepting sends the trade to chief approval; it does not change the schedule by itself.</p></div></div>
        <div className="request-list">
          {!incomingTrades.length && <p className="schedule-empty">No open trades are waiting for you.</p>}
          {incomingTrades.map((item) => { const offeredToAnyone = !item.targetEmployeeId; return <article key={item.id}><header><div><strong>{offeredToAnyone ? "Trade open to eligible members" : "Trade offer"}</strong><span>{formatEmployeeName(item.employeeName)} · {friendlyDate(item.startDate)}</span></div><b className={item.status}>{offeredToAnyone ? "eligible" : item.targetStatus}</b></header><p>{item.role}{item.notes ? ` · ${item.notes}` : ""}</p>{["pending", "open"].includes(item.targetStatus) && <footer>{!offeredToAnyone && <button disabled={busy} onClick={() => void act({ action: "respondTrade", id: item.id, decision: "declined" }, "Trade declined")}>Decline</button>}<button disabled={busy} onClick={() => void act({ action: "respondTrade", id: item.id, decision: "accepted" }, "Trade accepted and sent for chief approval")}>Accept & Send for Approval</button></footer>}</article>; })}
        </div>
      </article>}
    </section>}

    {(tab === "request" || tab === "requests") && <section className="schedule-two-col">
      {!isCommandView && <article className="content-card schedule-form">
        <div className="section-header"><div><h2>Build and submit my schedule</h2><p>Enter when you can work or need time off. Recurring requests remain pending until reviewed.</p></div></div>
        <div className="schedule-fields">
          <label><span>Request type</span><select value={request.requestType} onChange={(event) => setRequest({ ...request, requestType: event.target.value, assignmentId: "", targetEmployeeId: "" })}>{Object.entries(requestLabels).filter(([key]) => key !== "shift_claim").map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          {request.requestType === "trade" && <>
            <label><span>Your shift *</span><select value={request.assignmentId} onChange={(event) => { const assignment = ownAssignments.find((item) => item.id === event.target.value); setRequest({ ...request, assignmentId: event.target.value, targetEmployeeId: "", startDate: assignment?.workDate || today(), endDate: assignment?.workDate || today(), startTime: assignment?.startTime || "", endTime: assignment?.endTime || "", role: assignment?.role || "" }); }}><option value="">Select shift</option>{upcomingOwnAssignments.map((item) => <option key={item.id} value={item.id}>{item.workDate} · {item.startTime}-{item.endTime} · {item.role}</option>)}</select></label>
            <label><span>Send request to *</span><select disabled={!selectedTradeAssignment || eligibleTradeEmployees.length === 0} value={request.targetEmployeeId} onChange={(event) => setRequest({ ...request, targetEmployeeId: event.target.value })}><option value="">{!selectedTradeAssignment ? "Select your shift first" : eligibleTradeEmployees.length ? `Anyone eligible (${eligibleTradeEmployees.length})` : "No eligible employees available"}</option>{eligibleTradeEmployees.map((employee) => <option key={employee.id} value={employee.id}>{formatEmployeeName(employee.name)} · {employee.rank}{employee.actingOfficerEligible ? " · AO eligible" : ""}</option>)}</select><small>Only members cleared for this role and not already working an overlapping shift are listed.</small></label>
          </>}
          {["availability", "time_off"].includes(request.requestType) && <>
            {[["Start date", "startDate", "date"], ["End date", "endDate", "date"], ["From", "startTime", "time"], ["To", "endTime", "time"], ["Position", "role", "text"]].map(([label, key, type]) => <label key={key}><span>{label}</span><input type={type} value={String(request[key as keyof typeof request])} onChange={(event) => setRequest({ ...request, [key]: event.target.value })}/></label>)}
            <label><span>Repeat</span><select value={request.repeatMode} onChange={(event) => setRequest({ ...request, repeatMode: event.target.value })}><option value="none">Does not repeat</option><option value="interval">Repeat every set number of days</option></select></label>
            {request.repeatMode === "interval" && <label><span>Repeat every *</span><div className="input-unit"><input type="number" min="2" max="365" value={request.repeatInterval} onChange={(event) => setRequest({ ...request, repeatInterval: event.target.value })}/><b>days</b></div><small>Examples: every 2, 3, 4, 5, or 6 days.</small></label>}
          </>}
          <label className="wide"><span>Notes</span><textarea rows={4} value={request.notes} onChange={(event) => setRequest({ ...request, notes: event.target.value })}/></label>
        </div>
        <button className="primary-action" disabled={busy || (request.requestType === "trade" && (!selectedTradeAssignment || eligibleTradeEmployees.length === 0)) || (request.repeatMode === "interval" && (Number(request.repeatInterval) < 2 || Number(request.repeatInterval) > 365))} onClick={() => void act({ action: "submitRequest", ...request, repeatInterval: Number(request.repeatInterval) }, request.requestType === "trade" && !request.targetEmployeeId ? "Trade request sent to all eligible members" : "Schedule request submitted for review")}>Submit My Schedule Request</button>
      </article>}
      <article className="content-card">
        <div className="section-header"><div><h2>{isCommandView ? "All employee requests" : "My requests and trades"}</h2></div></div>
        <div className="request-list">{portalRequests.map((item) => {
          const needsMyTradeResponse = item.requestType === "trade" && item.targetEmployeeId === portalEmployeeId && item.status === "pending" && item.targetStatus === "pending";
          return <article key={item.id}><header><div><strong>{requestLabels[item.requestType] || item.requestType}</strong><span>{formatEmployeeName(item.employeeName)} · {item.startDate}</span></div><b className={item.status}>{item.status}</b></header>
            <p>{item.role}{item.repeatMode === "interval" && item.repeatInterval ? ` · repeats every ${item.repeatInterval} days through ${item.endDate}` : ""}{item.requestType === "trade" ? ` · requested member: ${item.targetEmployeeName ? formatEmployeeName(item.targetEmployeeName) : "Anyone eligible"}` : ""}{item.notes ? ` · ${item.notes}` : ""}</p>
            {item.requestType === "trade" && <small className={`trade-status ${item.targetStatus}`}>Member response: {item.targetStatus.replace("_", " ")}</small>}
            {needsMyTradeResponse && <footer><button onClick={() => void act({ action: "respondTrade", id: item.id, decision: "declined" }, "Trade declined")}>Decline Trade</button><button onClick={() => void act({ action: "respondTrade", id: item.id, decision: "accepted" }, "Trade accepted and sent for chief approval")}>Accept Trade</button></footer>}
            {isCommandView && item.status === "pending" && <footer><button onClick={() => void act({ action: "reviewRequest", id: item.id, decision: "denied" }, "Request denied")}>Deny</button><button disabled={item.requestType === "trade" && item.targetStatus !== "accepted"} title={item.requestType === "trade" && item.targetStatus !== "accepted" ? "Waiting for requested member" : ""} onClick={() => void act({ action: "reviewRequest", id: item.id, decision: "approved" }, "Request approved")}>Approve</button></footer>}
          </article>;
        })}</div>
      </article>
    </section>}

    {tab === "alerts" && <section className="content-card">
      <div className="section-header"><div><h2>Scheduling notifications</h2><p>Choose each alert, its channels, and more than one delivery time when needed.</p></div></div>
      {isCommandView && <section className="station-personnel-card" aria-label="Scheduling personnel">
        <div className="section-header"><div><h3>Personnel & qualifications</h3><p>Current employee eligibility used by riding assignments, open shifts, and trades. Employee identity records remain managed in the portal Personnel area.</p></div><b>{data.employees.length} members</b></div>
        <div className="station-personnel-list">{data.employees.map((employee) => <article key={employee.id}>
          <span className="person-avatar">{initials(employee.name)}</span>
          <div><strong>{formatEmployeeName(employee.name)}</strong><small>{employee.email || "No email on file"}</small><div className="tag-list">{employeeQualificationLabels(employee).map((label) => <span key={label}>{label}</span>)}</div></div>
        </article>)}</div>
      </section>}
      {!isCommandView && <div className="employee-alert-preferences">
        <div><span>Email updates</span><strong>{(testMember ? portalEmployee?.email : data?.viewer.profileEmail) || "No employee email saved"}</strong><small>{(testMember ? portalEmployee?.email : data?.viewer.profileEmail) ? "Shift assignments, open-shift responses, trades, and request decisions use this saved employee email automatically." : "Ask an administrator to add your login email in Employee Information."}</small></div>
        <label className={!(testMember ? portalEmployee?.phone : data?.viewer.phone) ? "disabled" : ""}><input type="checkbox" checked={testMember ? Boolean(portalEmployee?.scheduleSmsOptIn) : Boolean(data?.viewer.smsOptIn)} disabled={!(testMember ? portalEmployee?.phone : data?.viewer.phone) || busy} onChange={(event) => data && setData(testMember ? { ...data, employees: data.employees.map((employee) => employee.id === testMember.id ? { ...employee, scheduleSmsOptIn: event.target.checked ? 1 : 0 } : employee) } : { ...data, viewer: { ...data.viewer, smsOptIn: event.target.checked } })}/><span><strong>Text updates</strong><small>{(testMember ? portalEmployee?.phone : data?.viewer.phone) ? `Send eligible scheduling texts to ${testMember ? portalEmployee?.phone : data?.viewer.phone}.` : "A mobile number must be saved before text updates can be enabled."}</small></span></label>
        <button className="primary-action compact" disabled={busy} onClick={() => data && void act({ action: "saveMyNotificationPreferences", smsOptIn: testMember ? Boolean(portalEmployee?.scheduleSmsOptIn) : data.viewer.smsOptIn }, "My alert preferences saved")}>Save My Alert Preferences</button>
      </div>}
      {isCommandView && <div className="schedule-notification-setup">
        <div className="visibility-setting"><label>Employees can view open shifts through<input type="date" min={today()} value={data.settings.openShiftsVisibleThrough} onChange={(event) => setData({ ...data, settings: { ...data.settings, openShiftsVisibleThrough: event.target.value } })}/></label><p>Open positions after this date remain available to administrators but are hidden from employee open-shift lists.</p><button className="primary-action compact" disabled={busy} onClick={() => void act({ action: "saveScheduleSettings", openShiftsVisibleThrough: data.settings.openShiftsVisibleThrough }, "Open-shift visibility cutoff saved")}>Save Visibility Cutoff</button></div>
        <div className="notification-setup-head"><div><strong>Notification setup</strong><p>Text is queued only for employees who elected to receive texts in their Employee profile.</p></div><button className="primary-action compact" disabled={busy} onClick={() => void act({ action: "saveNotificationRules", rules: data.notificationRules.map((rule) => ({ ...rule, deliveryTimings: JSON.parse(rule.deliveryTimings) })) }, "Notification setup saved")}>Save Notification Setup</button></div>
        <div className="notification-rule-list">{data.notificationRules.map((rule) => {
          const timings = new Set<string>(JSON.parse(rule.deliveryTimings || '["immediate"]'));
          return <article key={rule.eventType} className={rule.active ? "" : "disabled"}>
            <header><label><input type="checkbox" checked={Boolean(rule.active)} onChange={(event) => updateNotificationRule(rule.eventType, { active: event.target.checked })}/><span><strong>{rule.label}</strong><small>Turn this task notification on or off</small></span></label></header>
            <div className="notification-channels"><span>Send by</span><label><input type="checkbox" checked={Boolean(rule.emailEnabled)} onChange={(event) => updateNotificationRule(rule.eventType, { emailEnabled: event.target.checked })}/> Email</label><label><input type="checkbox" checked={Boolean(rule.smsEnabled)} onChange={(event) => updateNotificationRule(rule.eventType, { smsEnabled: event.target.checked })}/> Text</label></div>
            <div className="notification-timings"><span>Alert times (select multiple)</span>{[
              ["immediate", "Immediately"], ["48_hours_before", "48 hours before"], ["24_hours_before", "24 hours before"], ["12_hours_before", "12 hours before"], ["2_hours_before", "2 hours before"],
            ].map(([value, label]) => <label key={value}><input type="checkbox" checked={timings.has(value)} onChange={() => toggleNotificationTiming(rule, value)}/>{label}</label>)}</div>
          </article>;
        })}</div>
      </div>}
      <h3 className="notification-history-title">Notification history</h3>
      <div className="notification-list">{data?.notifications.map((item) => <article key={item.id} className={item.readAt ? "read" : ""}><div><strong>{item.title}</strong><p>{item.message}</p><small>In-app{item.email ? " · Email queued" : ""}{item.sms ? " · Text queued" : ""}</small></div>{!item.readAt && <button onClick={() => void act({ action: "markRead", id: item.id }, "Marked read")}>Mark Read</button>}</article>)}</div>
    </section>}
      </section>
    </main>
  </div>;
}
