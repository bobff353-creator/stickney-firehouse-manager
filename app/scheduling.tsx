"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEmployeeName } from "./employee-names";

type Employee = { id:string; name:string; rank:string; email:string; phone:string };
type Assignment = {
  id:string; employeeId:string|null; employeeName?:string; workDate:string; startTime:string; endTime:string; role:string;
  source:string; status:string; emergency:number; requiredRank:string; claimDeadline:string; notes:string;
};
type Rotation = {
  id:string; name:string; startDate:string; endDate:string; startTime:string; endTime:string; cycleDays:number;
  dutyDays:string; role:string; members:string; active:number;
};
type Request = {
  id:string; requestType:string; employeeId:string; employeeName:string; assignmentId?:string; targetEmployeeId?:string;
  targetEmployeeName?:string; startDate:string; endDate:string; role:string; status:string; targetStatus:string; notes:string;
};
type Notification = { id:string; title:string; message:string; email:number; sms:number; deliveryStatus:string; readAt?:string; createdAt:string };
type CoverageRule = { id:string; name:string; role:string; minimumStaff:number; startTime:string; endTime:string; daysOfWeek:string; active:number };
type CoverageGap = {
  date:string; ruleId:string; name:string; role:string; startTime:string; endTime:string; minimumStaff:number; scheduled:number; shortBy:number;
};
type ScheduleData = {
  viewer:{ employeeId:string|null; isAdmin:boolean };
  employees:Employee[]; assignments:Assignment[]; rotations:Rotation[]; requests:Request[]; notifications:Notification[];
  coverageRules:CoverageRule[]; coverageGaps:CoverageGap[];
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

export default function Scheduling() {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [tab, setTab] = useState("calendar");
  const [month, setMonth] = useState(today().slice(0, 7));
  const [viewMode, setViewMode] = useState<"calendar"|"agenda">("calendar");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [rotation, setRotation] = useState({
    name: "", startDate: today(), endDate: plusDays(today(), 90), startTime: "06:00", endTime: "06:00",
    cycleDays: "3", dutyDays: "0", role: "Duty Crew",
  });
  const [shift, setShift] = useState({
    employeeId: "", workDate: today(), startTime: "06:00", endTime: "18:00", role: "Firefighter",
    emergency: false, requiredRank: "", claimDeadline: "", notes: "",
  });
  const [request, setRequest] = useState({
    requestType: "availability", assignmentId: "", targetEmployeeId: "", startDate: today(), endDate: today(),
    startTime: "06:00", endTime: "18:00", role: "Firefighter", repeatMode: "none", notes: "",
  });
  const [coverage, setCoverage] = useState({
    name: "24-hour minimum staffing", startTime: "06:00", endTime: "06:00",
  });
  const [coveragePositions, setCoveragePositions] = useState([
    { id: "position-1", role: "Officer/AO", minimumStaff: "1" },
    { id: "position-2", role: "Driver/Engineer", minimumStaff: "1" },
  ]);
  const [coverageDays, setCoverageDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  const load = useCallback(async () => {
    const response = await fetch("/api/scheduling");
    const payload = await response.json() as ScheduleData & { error?:string };
    if (!response.ok) throw new Error(payload.error || "Unable to load scheduling");
    setData(payload);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch((reason) => setError(reason.message)); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function act(payload:Record<string,unknown>, success:string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/scheduling", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
      });
      const result = await response.json() as { error?:string; assignmentsCreated?:number };
      if (!response.ok) throw new Error(result.error || "Unable to save");
      setMessage(result.assignmentsCreated != null ? `${success} · ${result.assignmentsCreated} assignments created` : success);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save");
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

  const roles = useMemo(() => [...new Set(data?.assignments.map((item) => item.role).filter(Boolean) ?? [])].sort(), [data]);
  const filteredAssignments = useMemo(() => (data?.assignments ?? []).filter((item) =>
    (!employeeFilter || item.employeeId === employeeFilter) &&
    (!roleFilter || item.role === roleFilter) &&
    (!statusFilter || item.status === statusFilter)
  ), [data, employeeFilter, roleFilter, statusFilter]);
  const monthAssignments = filteredAssignments.filter((item) => item.workDate.slice(0, 7) === month);
  const openShifts = data?.assignments.filter((item) => item.status === "open") ?? [];
  const ownAssignments = data?.assignments.filter((item) => item.employeeId === data.viewer.employeeId) ?? [];
  const upcomingGaps = data?.coverageGaps.filter((gap) => gap.date >= today()).slice(0, 20) ?? [];
  const ranks = [...new Set(data?.employees.map((employee) => employee.rank) ?? [])].sort();
  const unread = data?.notifications.filter((item) => !item.readAt).length ?? 0;
  const coveragePlans = useMemo(() => {
    const plans = new Map<string, CoverageRule[]>();
    for (const rule of data?.coverageRules.filter((item) => item.active) ?? []) {
      const key = [rule.name, rule.startTime, rule.endTime, rule.daysOfWeek].join("|");
      plans.set(key, [...(plans.get(key) ?? []), rule]);
    }
    return [...plans.entries()];
  }, [data]);
  const tabs = data?.viewer.isAdmin
    ? [["calendar", "Department Schedule"], ["coverage", "Coverage"], ["rotations", "Rotations"], ["open", "Add / Open Shifts"], ["requests", "Requests & Trades"], ["alerts", `Notifications${unread ? ` (${unread})` : ""}`]]
    : [["calendar", "My Schedule"], ["request", "Request / Availability"], ["open", "Open Shifts"], ["alerts", `Notifications${unread ? ` (${unread})` : ""}`]];

  function changeMonth(offset:number) {
    const date = new Date(`${month}-01T12:00:00`);
    date.setMonth(date.getMonth() + offset);
    setMonth(date.toLocaleDateString("en-CA").slice(0, 7));
  }

  return <div className="schedule-page">
    <datalist id="schedule-position-options">{departmentPositions.map((position) => <option key={position} value={position}/>)}</datalist>
    <section className="schedule-hero">
      <div>
        <p className="eyebrow">Department scheduling</p>
        <h1>{data?.viewer.isAdmin ? "Scheduling Command" : "My Schedule"}</h1>
        <p>{data?.viewer.isAdmin
          ? "Control rotations, watch staffing coverage, qualify open shifts, approve requests, and notify members."
          : "View assignments, submit availability, request qualified open shifts, and arrange confirmed trades."}</p>
      </div>
      <div className="schedule-metrics">
        <span><b>{data?.assignments.filter((item) => item.workDate >= today()).length ?? 0}</b>upcoming</span>
        <span><b>{openShifts.length}</b>open</span>
        <span className={data?.coverageGaps.length ? "warning" : ""}><b>{data?.coverageGaps.length ?? 0}</b>coverage gaps</span>
        <span><b>{data?.requests.filter((item) => item.status === "pending").length ?? 0}</b>pending</span>
      </div>
    </section>

    <nav className="schedule-tabs">
      {tabs.map(([key, label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}
    </nav>
    {error && <div className="error-banner">{error}</div>}
    {message && <div className="work-detail-message">{message}</div>}

    {tab === "calendar" && <section className="content-card schedule-calendar-card">
      <div className="schedule-command-bar">
        <div className="schedule-calendar-head">
          <button aria-label="Previous month" onClick={() => changeMonth(-1)}>‹</button>
          <h2>{new Date(`${month}-01T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
          <button aria-label="Next month" onClick={() => changeMonth(1)}>›</button>
          <button className="today-button" onClick={() => setMonth(today().slice(0, 7))}>Today</button>
        </div>
        <div className="schedule-view-toggle">
          <button className={viewMode === "calendar" ? "active" : ""} onClick={() => setViewMode("calendar")}>Calendar</button>
          <button className={viewMode === "agenda" ? "active" : ""} onClick={() => setViewMode("agenda")}>Agenda</button>
        </div>
      </div>
      <div className="schedule-filters">
        {data?.viewer.isAdmin && <select aria-label="Filter employee" value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}>
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
      {viewMode === "calendar" ? <>
        <div className="schedule-weekdays">{weekdayLabels.map((label) => <b key={label}>{label}</b>)}</div>
        <div className="schedule-calendar">
          {days.map((date) => {
            const gaps = data?.coverageGaps.filter((gap) => gap.date === date) ?? [];
            return <article key={date} className={`${date.slice(0, 7) === month ? "" : "outside"} ${date === today() ? "today" : ""} ${gaps.length ? "understaffed" : ""}`}>
              <header><span>{Number(date.slice(8))}</span>{gaps.length > 0 && <b title={gaps.map((gap) => `${gap.role}: short ${gap.shortBy}`).join(", ")}>−{gaps.reduce((sum, gap) => sum + gap.shortBy, 0)} staff</b>}</header>
              <div>{filteredAssignments.filter((item) => item.workDate === date).map((item) => <span key={item.id} className={`${item.status} ${item.emergency ? "emergency" : ""}`}>
                <strong>{item.status === "open" ? "OPEN" : formatEmployeeName(item.employeeName || "")}</strong>
                <small>{item.role} · {item.startTime}-{item.endTime}</small>
              </span>)}</div>
            </article>;
          })}
        </div>
      </> : <div className="schedule-agenda">
        {monthAssignments.length === 0 && <p className="schedule-empty">No assignments match these filters.</p>}
        {monthAssignments.map((item) => <article key={item.id} className={`${item.status} ${item.emergency ? "emergency" : ""}`}>
          <time>{friendlyDate(item.workDate)}</time>
          <div><strong>{item.status === "open" ? "Open shift" : formatEmployeeName(item.employeeName || "")}</strong><p>{item.role} · {item.startTime}-{item.endTime}</p></div>
          <span>{item.emergency ? "Emergency" : item.status}</span>
        </article>)}
      </div>}
    </section>}

    {tab === "coverage" && data?.viewer.isAdmin && <section className="schedule-two-col">
      <article className="content-card schedule-form">
        <div className="section-header"><div><h2>Minimum staffing plan</h2><p>Select every position that must be filled and the minimum needed for each one.</p></div></div>
        <div className="schedule-fields">
          <label><span>Rule name *</span><input value={coverage.name} onChange={(event) => setCoverage({ ...coverage, name: event.target.value })}/></label>
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
        <button className="primary-action" disabled={busy || coveragePositions.some((position) => !position.role.trim() || Number(position.minimumStaff) < 1)} onClick={() => void act({ action: "saveCoverageRule", ...coverage, positions: coveragePositions.map((position) => ({ role: position.role, minimumStaff: Number(position.minimumStaff) })), daysOfWeek: coverageDays }, "Minimum staffing plan saved")}>Save Minimum Staffing Plan</button>
      </article>
      <article className="content-card">
        <div className="section-header"><div><h2>Coverage watch</h2><p>Next 63 days · warnings update from assigned shifts.</p></div></div>
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

    {tab === "rotations" && data?.viewer.isAdmin && <section className="schedule-two-col">
      <article className="content-card schedule-form">
        <div className="section-header"><div><h2>Create rotating shift</h2><p>Customize dates, times, position, cycle, duty pattern, and members.</p></div></div>
        <div className="schedule-fields">
          {[
            ["Rotation name", "name", "text"], ["Position", "role", "text"], ["Start date", "startDate", "date"], ["End date", "endDate", "date"],
            ["Start time", "startTime", "time"], ["End time", "endTime", "time"], ["Cycle length (days)", "cycleDays", "number"], ["Duty days in cycle", "dutyDays", "text"],
          ].map(([label, key, type]) => <label key={key}><span>{label} *</span><input type={type} list={key === "role" ? "schedule-position-options" : undefined} value={String(rotation[key as keyof typeof rotation])} onChange={(event) => setRotation({ ...rotation, [key]: event.target.value })}/>{key === "dutyDays" && <small>For 24/48 use cycle 3 and duty day 0. Multiple duty days: 0,2,4.</small>}</label>)}
        </div>
        <fieldset className="schedule-member-select"><legend>Employees *</legend>
          {data.employees.map((employee) => <label key={employee.id}><input type="checkbox" checked={members.includes(employee.id)} onChange={(event) => setMembers((current) => event.target.checked ? [...current, employee.id] : current.filter((id) => id !== employee.id))}/><span>{formatEmployeeName(employee.name)}<small>{employee.rank}</small></span></label>)}
        </fieldset>
        <button className="primary-action" disabled={busy || !rotation.name || !members.length} onClick={() => void act({ action: "createRotation", ...rotation, cycleDays: Number(rotation.cycleDays), employeeIds: members }, "Rotation created")}>Create Rotation & Assign Schedule</button>
      </article>
      <article className="content-card">
        <div className="section-header"><div><h2>Rotation manager</h2><p>Ending a rotation removes only future generated assignments and preserves history.</p></div></div>
        <div className="rotation-list">{data.rotations.map((item) => <article key={item.id} className={item.active ? "" : "inactive"}>
          <header><strong>{item.name}</strong><span>{item.active ? "Active" : "Ended"}</span></header>
          <p>{item.members}</p>
          <dl><div><dt>Dates</dt><dd>{item.startDate} to {item.endDate}</dd></div><div><dt>Hours</dt><dd>{item.startTime}-{item.endTime}</dd></div><div><dt>Pattern</dt><dd>Days {item.dutyDays} of {item.cycleDays}</dd></div><div><dt>Position</dt><dd>{item.role}</dd></div></dl>
          {Boolean(item.active) && <footer><button disabled={busy} onClick={() => void act({ action: "deactivateRotation", id: item.id }, "Rotation ended; future generated assignments removed")}>End Rotation</button></footer>}
        </article>)}</div>
      </article>
    </section>}

    {tab === "open" && <section className="schedule-two-col">
      {data?.viewer.isAdmin && <article className="content-card schedule-form">
        <div className="section-header"><div><h2>Add assignment or open shift</h2><p>Leave employee blank to publish a qualified open shift.</p></div></div>
        <div className="schedule-fields">
          <label><span>Employee</span><select value={shift.employeeId} onChange={(event) => setShift({ ...shift, employeeId: event.target.value })}>
            <option value="">Open to employees</option>{data.employees.map((employee) => <option key={employee.id} value={employee.id}>{formatEmployeeName(employee.name)} · {employee.rank}</option>)}
          </select></label>
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
          </div>{!data.viewer.isAdmin && <button disabled={busy} onClick={() => void act({ action: "submitRequest", requestType: "shift_claim", assignmentId: item.id, startDate: item.workDate, endDate: item.workDate, startTime: item.startTime, endTime: item.endTime, role: item.role }, "Shift request sent")}>Request Shift</button>}</article>)}
        </div>
      </article>
    </section>}

    {(tab === "request" || tab === "requests") && <section className="schedule-two-col">
      {!data?.viewer.isAdmin && <article className="content-card schedule-form">
        <div className="section-header"><div><h2>Schedule request</h2><p>Trades require the selected member to accept before chief approval.</p></div></div>
        <div className="schedule-fields">
          <label><span>Request type</span><select value={request.requestType} onChange={(event) => setRequest({ ...request, requestType: event.target.value, assignmentId: "" })}>{Object.entries(requestLabels).filter(([key]) => key !== "shift_claim").map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          {request.requestType === "trade" && <>
            <label><span>Your shift *</span><select value={request.assignmentId} onChange={(event) => { const assignment = ownAssignments.find((item) => item.id === event.target.value); setRequest({ ...request, assignmentId: event.target.value, startDate: assignment?.workDate || today(), endDate: assignment?.workDate || today(), startTime: assignment?.startTime || "", endTime: assignment?.endTime || "", role: assignment?.role || "" }); }}><option value="">Select shift</option>{ownAssignments.map((item) => <option key={item.id} value={item.id}>{item.workDate} · {item.startTime}-{item.endTime} · {item.role}</option>)}</select></label>
            <label><span>Requested member *</span><select value={request.targetEmployeeId} onChange={(event) => setRequest({ ...request, targetEmployeeId: event.target.value })}><option value="">Select member</option>{data.employees.filter((employee) => employee.id !== data.viewer.employeeId).map((employee) => <option key={employee.id} value={employee.id}>{formatEmployeeName(employee.name)} · {employee.rank}</option>)}</select></label>
          </>}
          {["availability", "time_off"].includes(request.requestType) && <>
            {[["Start date", "startDate", "date"], ["End date", "endDate", "date"], ["From", "startTime", "time"], ["To", "endTime", "time"], ["Position", "role", "text"]].map(([label, key, type]) => <label key={key}><span>{label}</span><input type={type} value={String(request[key as keyof typeof request])} onChange={(event) => setRequest({ ...request, [key]: event.target.value })}/></label>)}
            <label><span>Repeat</span><select value={request.repeatMode} onChange={(event) => setRequest({ ...request, repeatMode: event.target.value })}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label>
          </>}
          <label className="wide"><span>Notes</span><textarea rows={4} value={request.notes} onChange={(event) => setRequest({ ...request, notes: event.target.value })}/></label>
        </div>
        <button className="primary-action" disabled={busy} onClick={() => void act({ action: "submitRequest", ...request }, "Request sent")}>Submit Request</button>
      </article>}
      <article className="content-card">
        <div className="section-header"><div><h2>{data?.viewer.isAdmin ? "All employee requests" : "My requests and trades"}</h2></div></div>
        <div className="request-list">{data?.requests.map((item) => {
          const needsMyTradeResponse = item.requestType === "trade" && item.targetEmployeeId === data.viewer.employeeId && item.status === "pending" && item.targetStatus === "pending";
          return <article key={item.id}><header><div><strong>{requestLabels[item.requestType] || item.requestType}</strong><span>{formatEmployeeName(item.employeeName)} · {item.startDate}</span></div><b className={item.status}>{item.status}</b></header>
            <p>{item.role}{item.targetEmployeeName ? ` · requested member: ${formatEmployeeName(item.targetEmployeeName)}` : ""}{item.notes ? ` · ${item.notes}` : ""}</p>
            {item.requestType === "trade" && <small className={`trade-status ${item.targetStatus}`}>Member response: {item.targetStatus.replace("_", " ")}</small>}
            {needsMyTradeResponse && <footer><button onClick={() => void act({ action: "respondTrade", id: item.id, decision: "declined" }, "Trade declined")}>Decline Trade</button><button onClick={() => void act({ action: "respondTrade", id: item.id, decision: "accepted" }, "Trade accepted and sent for chief approval")}>Accept Trade</button></footer>}
            {data.viewer.isAdmin && item.status === "pending" && <footer><button onClick={() => void act({ action: "reviewRequest", id: item.id, decision: "denied" }, "Request denied")}>Deny</button><button disabled={item.requestType === "trade" && item.targetStatus !== "accepted"} title={item.requestType === "trade" && item.targetStatus !== "accepted" ? "Waiting for requested member" : ""} onClick={() => void act({ action: "reviewRequest", id: item.id, decision: "approved" }, "Request approved")}>Approve</button></footer>}
          </article>;
        })}</div>
      </article>
    </section>}

    {tab === "alerts" && <section className="content-card">
      <div className="section-header"><div><h2>Scheduling notifications</h2><p>In-app notices are immediate. Email and text are queued from employee contact records.</p></div></div>
      <div className="notification-list">{data?.notifications.map((item) => <article key={item.id} className={item.readAt ? "read" : ""}><div><strong>{item.title}</strong><p>{item.message}</p><small>In-app{item.email ? " · Email queued" : ""}{item.sms ? " · Text queued" : ""}</small></div>{!item.readAt && <button onClick={() => void act({ action: "markRead", id: item.id }, "Marked read")}>Mark Read</button>}</article>)}</div>
    </section>}
  </div>;
}
