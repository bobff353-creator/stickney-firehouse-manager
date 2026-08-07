"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { normalizeScheduleTime } from "./schedule-time";

type TestMember = { id: string; name: string; rank: string; effectivePermissions: string[] };

type Employee = {
  id: string; name: string; rank: string; roles: string;
  otHours?: number; mandatoryHours?: number; hoursThisPeriod?: number;
  notifyEmail?: number; notifyText?: number; startDate?: string;
};
type ShiftType = { id: string; name: string; startTime: string; endTime: string; anchorDate: string; repeatEveryDays: number; color: string; active: number; sortOrder: number };
type ShiftTypeRole = { id: string; shiftTypeId: string; role: string; count: number };
type Entry = { id: string; entryDate: string; shiftTypeId: string };
type Slot = { id: string; entryId: string; role: string; employeeId: string | null; employeeName?: string; status: string; sortOrder: number; entryDate: string; shiftTypeId: string };
type Standing = { id: string; employeeId: string; employeeName: string; shiftTypeId: string; role: string; active: number };
type Trade = { id: string; slotId: string; role: string; fromEmployeeId: string; fromEmployeeName: string; targetEmployeeId: string | null; targetEmployeeName?: string; acceptedByEmployeeId: string | null; note: string; status: string; createdAt: string; entryDate: string };
type Claim = { id: string; slotId: string; role: string; employeeId: string; employeeName: string; note: string; status: string; createdAt: string; entryDate: string };
type TimeOff = { id: string; employeeId: string; employeeName: string; type: string; approverEmployeeId: string; approverName?: string; note: string; status: string; createdAt: string };
type TimeOffDate = { requestId: string; offDate: string };
type ReminderRule = { id: string; type: string; label: string; offsets: string; emailEnabled: number; textEnabled: number; target: string; enabled: number };
type OtSetting = { exemptOffDuty: boolean; exemptAlreadyScheduled: boolean; exemptDeclined: boolean; exemptRecentlyMandated: boolean; recentDays: number; exemptMaxConsecutive: boolean; maxConsecutive: number; priorityOrder: string[] };
type OtOffer = { id: string; slotId: string; employeeId: string; employeeName: string; mode: string; status: string; rank: number };
type OtInterest = { id: string; slotId: string; employeeId: string; response: string };
type Weights = { seniorityWeight: number; hoursWeight: number; customWeight: number; customLabel: string };
type Notice = { openShifts: number; overdueShifts: number; pendingTrades: number; pendingClaims: number; pendingTimeOff: number };

type Data = {
  viewer: { employeeId: string | null; isAdmin: boolean; rank: string; roles: string[]; name: string };
  today: string;
  roles: string[];
  employees: Employee[];
  shiftTypes: ShiftType[];
  shiftTypeRoles: ShiftTypeRole[];
  entries: Entry[];
  slots: Slot[];
  standingAssignments: Standing[];
  trades: Trade[];
  claims: Claim[];
  timeOff: TimeOff[];
  timeOffDates: TimeOffDate[];
  reminderRules: ReminderRule[];
  otSettings: { voluntary: OtSetting; mandatory: OtSetting } | null;
  otTiming: { awardDaysOut: number; completeByDaysOut: number };
  distributionWeights: Weights;
  otInterest: OtInterest[];
  otOffers: OtOffer[];
  awardBySlot: Record<string, { daysUntil: number; window: string }>;
  otStandings: Record<string, { voluntary: string[]; mandatory: string[] }>;
  notice: Notice;
};

const OT_CRITERIA: Record<string, string> = {
  leastOT: "Least overtime worked",
  leastMandatory: "Least mandatory time",
  mostSeniority: "Most seniority",
  leastSeniority: "Least seniority",
};
const timeOffTypes = [
  { id: "vacation", label: "Vacation" }, { id: "recovery", label: "Recovery" }, { id: "floating", label: "Floating" },
  { id: "sick", label: "Sick" }, { id: "official_business", label: "Official Business" },
];
const parseRoles = (value: string): string[] => { try { const p = JSON.parse(value || "[]"); return Array.isArray(p) ? p.map(String) : []; } catch { return []; } };
const friendlyDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const windowLabel: Record<string, string> = { early: "Early interest", award: "Award window", overdue: "Overdue" };
const shiftColorHex: Record<string, string> = {
  red: "#ef3340", black: "#2d3744", gold: "#f0a51a", blue: "#3182bd",
  green: "#22a55b", purple: "#805ad5", orange: "#ed8936",
};
const monthTitle = (value: string) => new Date(`${value.slice(0, 7)}-01T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
const shiftInitial = (name: string) => name.trim().charAt(0).toUpperCase() || "S";
const fourDigitTime = (value: string) => value.replace(":", "").slice(0, 4);

export default function StationScheduler({ testMember = null }: { testMember?: TestMember | null }) {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState("calendar");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayIso());

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/station-scheduler", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to load the scheduler.");
      setData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load the scheduler.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/station-scheduler", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to save.");
      if (payload.note) setNotice(String(payload.note));
      await load();
      return payload;
    } catch (actError) {
      setError(actError instanceof Error ? actError.message : "Unable to save.");
      return null;
    } finally {
      setBusy(false);
    }
  }, [load]);

  const employeeName = useCallback((id: string | null | undefined) => data?.employees.find((e) => e.id === id)?.name ?? "", [data]);
  const shiftTypeName = useCallback((id: string) => data?.shiftTypes.find((s) => s.id === id)?.name ?? "", [data]);

  if (error && !data) return <div className="scheduler"><p className="error">{error}</p></div>;
  if (!data) return <div className="scheduler"><p>Loading the scheduler…</p></div>;

  const isAdmin = data.viewer.isAdmin;
  const adminTabs = [
    ["calendar", "Calendar"], ["shiftTypes", "Shift Builder"], ["roster", "Roster & Assignments"],
    ["trades", "Trades"], ["requests", "Requests"], ["distribution", "Auto-Distribution"],
    ["overtime", "Overtime"], ["timeoff", "Time Off"], ["reminders", "Reminders"],
  ] as const;
  const employeeTabs = [
    ["calendar", "Calendar"], ["myrequests", "My Requests"], ["otlist", "Overtime List"], ["timeoff", "Time Off"],
  ] as const;
  const tabs = isAdmin ? adminTabs : employeeTabs;

  return (
    <div className="scheduler">
      <header className="scheduler-brand">
        <div className="scheduler-brand-mark" aria-hidden="true">S</div>
        <div>
          <strong>Stickney Scheduler</strong>
          <span>Fire · EMS · Department staffing</span>
        </div>
        <span className="scheduler-live-dot" title="Connected to department records" aria-label="Connected to department records" />
      </header>
      <div className="scheduler-view-bar" aria-label="Current scheduler view">
        <span className={isAdmin ? "current" : ""}>Admin</span>
        <span className={!isAdmin ? "current" : ""}>Employee</span>
        <strong>{data.viewer.name || "Department member"}</strong>
      </div>
      <NoticeStrip notice={data.notice} isAdmin={isAdmin} upcoming={data.slots.filter((s) => s.employeeId === data.viewer.employeeId && s.entryDate >= data.today).length} />
      {error && <p className="error">{error}</p>}
      {notice && <p className="success">{notice}</p>}
      <nav className="scheduler-tabs">
        {tabs.map(([id, label]) => (
          <button key={id} className={tab === id ? "current" : ""} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>

      {tab === "calendar" && <CalendarScreen data={data} isAdmin={isAdmin} selectedDate={selectedDate} setSelectedDate={setSelectedDate} act={act} busy={busy} employeeName={employeeName} shiftTypeName={shiftTypeName} />}
      {tab === "shiftTypes" && isAdmin && <ShiftBuilder data={data} act={act} busy={busy} />}
      {tab === "roster" && isAdmin && <RosterScreen data={data} act={act} busy={busy} shiftTypeName={shiftTypeName} />}
      {tab === "requests" && isAdmin && <RequestsScreen data={data} act={act} busy={busy} employeeName={employeeName} mode="claims" />}
      {tab === "trades" && isAdmin && <RequestsScreen data={data} act={act} busy={busy} employeeName={employeeName} mode="trades" />}
      {tab === "timeoff" && <TimeOffScreen data={data} isAdmin={isAdmin} act={act} busy={busy} />}
      {tab === "overtime" && isAdmin && <OvertimeScreen data={data} act={act} busy={busy} employeeName={employeeName} />}
      {tab === "distribution" && isAdmin && <DistributionScreen data={data} act={act} busy={busy} />}
      {tab === "reminders" && isAdmin && <RemindersScreen data={data} act={act} busy={busy} />}
      {tab === "myrequests" && !isAdmin && <MyRequestsScreen data={data} act={act} busy={busy} />}
      {tab === "otlist" && !isAdmin && <OtListScreen data={data} act={act} busy={busy} />}
    </div>
  );
}

function NoticeStrip({ notice, isAdmin, upcoming }: { notice: Notice; isAdmin: boolean; upcoming: number }) {
  const chips = isAdmin ? [
    ["open", "Open shifts", notice.openShifts],
    ["trades", "Trades awaiting review", notice.pendingTrades],
    ["requests", "Pending requests", notice.pendingClaims + notice.pendingTimeOff],
  ] : [
    ["open", "Open shifts", notice.openShifts],
    ["trades", "Open trades", notice.pendingTrades],
    ["upcoming", "My upcoming shifts", upcoming],
  ];
  return <div className={`scheduler-notice${notice.overdueShifts ? " urgent" : ""}`}>
    {chips.map(([tone, label, count]) => <span key={String(tone)} className={`notice-chip ${tone}`}>{label}<b>{count}</b></span>)}
    {notice.overdueShifts > 0 && <span className="notice-overdue">{notice.overdueShifts} past deadline</span>}
  </div>;
}

function CalendarScreen({ data, isAdmin, selectedDate, setSelectedDate, act, busy, employeeName, shiftTypeName }: {
  data: Data; isAdmin: boolean; selectedDate: string; setSelectedDate: (d: string) => void;
  act: (b: Record<string, unknown>) => Promise<unknown>; busy: boolean; employeeName: (id: string | null | undefined) => string; shiftTypeName: (id: string) => string;
}) {
  const [newShiftType, setNewShiftType] = useState("");
  const myId = data.viewer.employeeId;
  const eligibleRoles = data.viewer.roles;
  const entriesByDate = useMemo(() => {
    const grouped = new Map<string, Entry[]>();
    for (const entry of data.entries) grouped.set(entry.entryDate, [...(grouped.get(entry.entryDate) ?? []), entry]);
    return grouped;
  }, [data.entries]);
  const slotsByDate = useMemo(() => {
    const grouped = new Map<string, Slot[]>();
    for (const slot of data.slots) grouped.set(slot.entryDate, [...(grouped.get(slot.entryDate) ?? []), slot]);
    return grouped;
  }, [data.slots]);
  const daySlots = slotsByDate.get(selectedDate) ?? [];
  const monthKey = selectedDate.slice(0, 7);
  const firstDay = new Date(`${monthKey}-01T12:00:00`);
  const daysInMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: firstDay.getDay() + daysInMonth }, (_, index) => index < firstDay.getDay() ? null : index - firstDay.getDay() + 1);
  const dateForDay = (day: number) => `${monthKey}-${String(day).padStart(2, "0")}`;
  const changeMonth = (delta: number) => {
    const next = new Date(firstDay.getFullYear(), firstDay.getMonth() + delta, 1, 12);
    setSelectedDate(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`);
  };

  return (
    <div className="scheduler-grid">
      <section className="wide scheduler-month-card">
        <div className="scheduler-month-head">
          <h3>{monthTitle(selectedDate)}</h3>
          <div><button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)}>‹</button><button type="button" aria-label="Next month" onClick={() => changeMonth(1)}>›</button></div>
        </div>
        <div className="scheduler-legend">
          {data.shiftTypes.filter((s) => s.active).slice(0, 5).map((s) => <span key={s.id}><i style={{ background: shiftColorHex[s.color] ?? s.color }} />{s.name} · {s.startTime}–{s.endTime}</span>)}
          <span><i className="open-dot" />Open slot</span>
        </div>
        <div className="scheduler-weekdays" aria-hidden="true">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <span key={d}>{d}</span>)}</div>
        <div className="scheduler-month" role="grid" aria-label={monthTitle(selectedDate)}>
          {cells.map((day, index) => {
            if (!day) return <span className="calendar-blank" key={`blank-${index}`} />;
            const date = dateForDay(day);
            const entries = entriesByDate.get(date) ?? [];
            const slots = slotsByDate.get(date) ?? [];
            const hasOpen = slots.some((slot) => slot.status === "open");
            return <button type="button" role="gridcell" key={date} className={`${date === selectedDate ? "selected " : ""}${date === data.today ? "today" : ""}`} onClick={() => setSelectedDate(date)} aria-label={`Open ${friendlyDate(date)}`}>
              <span>{day}{hasOpen && <i className="open-dot" />}</span>
              <em>{entries.slice(0, 2).map((entry) => { const shift = data.shiftTypes.find((s) => s.id === entry.shiftTypeId); return <b key={entry.id} style={{ color: shiftColorHex[shift?.color ?? ""] ?? shift?.color }}>{shiftInitial(shift?.name ?? "Shift")}</b>; })}</em>
            </button>;
          })}
        </div>
      </section>

      <section className="wide scheduler-day-card">
        <div className="entry-head"><div><span className="section-kicker">Selected day</span><h3>{friendlyDate(selectedDate)}</h3></div><input aria-label="Choose another date" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} /></div>
        {isAdmin && <div className="inline-form add-day-shift">
          <select aria-label="Shift type to add" value={newShiftType} onChange={(e) => setNewShiftType(e.target.value)}>
            <option value="">Add a shift to this day…</option>
            {data.shiftTypes.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.startTime}–{s.endTime}</option>)}
          </select>
          <button disabled={busy || !newShiftType} onClick={async () => { await act({ action: "createEntry", date: selectedDate, shiftTypeId: newShiftType }); setNewShiftType(""); }}>Add shift</button>
        </div>}
        {!daySlots.length && <p className="muted">No shifts scheduled for this day.</p>}
        {(entriesByDate.get(selectedDate) ?? []).map((entry) => {
          const slots = daySlots.filter((s) => s.entryId === entry.id);
          return (
            <div key={entry.id} className="entry-card">
              <div className="entry-head">
                <strong>{shiftTypeName(entry.shiftTypeId)}</strong>
                {isAdmin && <button className="link danger" disabled={busy} onClick={() => act({ action: "deleteEntry", entryId: entry.id })}>Remove</button>}
              </div>
              <ul className="slot-list">
                {slots.map((slot) => {
                  const award = data.awardBySlot[slot.id];
                  const canClaim = !isAdmin && slot.status === "open" && eligibleRoles.includes(slot.role);
                  const canTrade = !isAdmin && slot.status === "filled" && slot.employeeId === myId;
                  return (
                    <li key={slot.id} className={slot.status === "open" ? `open${award?.window === "overdue" ? " urgent" : ""}` : ""}>
                      <span className="slot-role">{slot.role}</span>
                      <span className="slot-holder">{slot.status === "filled" ? employeeName(slot.employeeId) : (award ? windowLabel[award.window] : "Open")}</span>
                      {isAdmin && slot.status === "open" && (
                        <select disabled={busy} defaultValue="" onChange={(e) => e.target.value && act({ action: "assignSlot", slotId: slot.id, employeeId: e.target.value })}>
                          <option value="">Assign…</option>
                          {data.employees.filter((emp) => parseRoles(emp.roles).includes(slot.role)).map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                        </select>
                      )}
                      {isAdmin && slot.status === "filled" && <button className="link" disabled={busy} onClick={() => act({ action: "clearSlot", slotId: slot.id })}>Clear</button>}
                      {canClaim && <button className="link" disabled={busy} onClick={() => act({ action: "submitClaim", slotId: slot.id })}>Request</button>}
                      {canTrade && <button className="link" disabled={busy} onClick={() => act({ action: "submitTrade", slotId: slot.id, targetEmployeeId: "" })}>Offer trade</button>}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function ShiftBuilder({ data, act, busy }: { data: Data; act: (b: Record<string, unknown>) => Promise<unknown>; busy: boolean }) {
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("0600");
  const [endTime, setEndTime] = useState("0600");
  const [anchorDate, setAnchorDate] = useState(todayIso());
  const [repeatEveryDays, setRepeatEveryDays] = useState(1);
  const [color, setColor] = useState("red");
  const staffingDefaults = useCallback(() => Object.fromEntries(data.roles.map((role) => [role, role === "FF/Attendant" ? 2 : 1])), [data.roles]);
  const [roleCounts, setRoleCounts] = useState<Record<string, number>>(() => staffingDefaults());
  const [formError, setFormError] = useState("");

  const roleReqs = Object.entries(roleCounts).filter(([, count]) => count > 0).map(([role, count]) => ({ role, count }));
  const save = async () => {
    setFormError("");
    const normStart = normalizeScheduleTime(startTime), normEnd = normalizeScheduleTime(endTime);
    if (!name.trim()) { setFormError("Enter a shift name before saving."); return; }
    if (!normStart || !normEnd) { setFormError("Enter Start and End as four-digit 24-hour times, such as 0600 or 1800."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate)) { setFormError("Choose the first day this shift pattern starts."); return; }
    if (!Number.isInteger(repeatEveryDays) || repeatEveryDays < 1 || repeatEveryDays > 365) { setFormError("Repeat every must be a whole number from 1 to 365 days."); return; }
    if (!roleReqs.length) { setFormError("Set at least one required role before saving."); return; }
    const result = await act({ action: "saveShiftType", name: name.trim(), startTime: normStart, endTime: normEnd, anchorDate, repeatEveryDays, color, roleRequirements: roleReqs });
    if (result) { setName(""); setStartTime("0600"); setEndTime("0600"); setAnchorDate(todayIso()); setRepeatEveryDays(1); setRoleCounts(staffingDefaults()); }
  };

  return (
    <div className="scheduler-grid">
      <section className="wide shift-type-list">
        <h3>Existing shift types</h3>
        {!data.shiftTypes.filter((s) => s.active).length && <p className="muted">No shift types yet.</p>}
        {data.shiftTypes.filter((s) => s.active).map((s) => (
          <div key={s.id} className="entry-card shift-type-card" style={{ borderLeftColor: shiftColorHex[s.color] ?? s.color }}>
            <div className="entry-head"><div><strong>{s.name}</strong><span>{fourDigitTime(s.startTime)}–{fourDigitTime(s.endTime)}</span>{s.anchorDate && s.repeatEveryDays > 0 && <span>Starts {friendlyDate(s.anchorDate)} · repeats every {s.repeatEveryDays} {s.repeatEveryDays === 1 ? "day" : "days"}</span>}</div>
              <button className="link danger" aria-label={`Retire ${s.name}`} disabled={busy} onClick={() => act({ action: "deactivateShiftType", id: s.id })}>Retire</button>
            </div>
            <div className="role-badges">{data.shiftTypeRoles.filter((r) => r.shiftTypeId === s.id).map((r) => <span key={r.id}>{r.count}× {r.role}</span>)}</div>
          </div>
        ))}
      </section>
      <section className="wide new-shift-card">
        <h3>New shift type</h3>
        <label><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Red Shift" /></label>
        <div className="two-field-row"><label><span>Start (24-hour)</span><input value={startTime} onChange={(e) => setStartTime(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" maxLength={4} placeholder="0600" aria-describedby="shift-time-help" /></label>
          <label><span>End (24-hour)</span><input value={endTime} onChange={(e) => setEndTime(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" maxLength={4} placeholder="0600" aria-describedby="shift-time-help" /></label></div>
        <p id="shift-time-help" className="form-help">Enter four digits: 0600 is 6:00 AM and 1800 is 6:00 PM. Matching Start and End creates a 24-hour shift.</p>
        <fieldset className="shift-pattern-fields"><legend>Shift pattern</legend>
          <div className="two-field-row">
            <label><span>First shift day</span><input type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} /></label>
            <label><span>Repeat every</span><span className="number-with-suffix"><input type="number" min={1} max={365} step={1} value={repeatEveryDays} onChange={(e) => setRepeatEveryDays(Number(e.target.value))} /><b>{repeatEveryDays === 1 ? "day" : "days"}</b></span></label>
          </div>
          <p className="form-help">Use 1 for every day, 2 for every other day, 3 for every third day, and so on.</p>
        </fieldset>
        <fieldset className="color-picker"><legend>Color</legend>
          {["red", "blue", "green", "orange", "purple", "gold", "black"].map((c) => <button key={c} type="button" className={color === c ? "selected" : ""} style={{ background: shiftColorHex[c] }} aria-label={`Use ${c}`} onClick={() => setColor(c)} />)}
        </fieldset>
        <fieldset><legend>Role requirements</legend>
          {data.roles.map((role) => (
            <label key={role} className="row"><span>{role}</span>
              <input type="number" min={0} max={20} value={roleCounts[role] ?? 0} onChange={(e) => setRoleCounts((c) => ({ ...c, [role]: Number(e.target.value) }))} />
            </label>
          ))}
        </fieldset>
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <button disabled={busy} onClick={save}>{busy ? "Saving…" : "Save shift type"}</button>
      </section>
    </div>
  );
}

function RosterScreen({ data, act, busy, shiftTypeName }: { data: Data; act: (b: Record<string, unknown>) => Promise<unknown>; busy: boolean; shiftTypeName: (id: string) => string }) {
  const [standEmp, setStandEmp] = useState("");
  const [standType, setStandType] = useState("");
  const [standRole, setStandRole] = useState("");

  return (
    <div className="scheduler-grid">
      <section className="wide">
        <h3>Members</h3>
        <table className="scheduler-table">
          <thead><tr><th>Name</th><th>Rank</th><th>Roles</th><th>Email</th><th>Text</th></tr></thead>
          <tbody>
            {data.employees.map((emp) => {
              const roles = parseRoles(emp.roles);
              return (
                <tr key={emp.id}>
                  <td>{emp.name}</td>
                  <td>{emp.rank}</td>
                  <td>
                    <div className="role-checks">
                      {data.roles.map((role) => (
                        <label key={role} className="chip"><input type="checkbox" checked={roles.includes(role)} disabled={busy}
                          onChange={(e) => { const next = e.target.checked ? [...roles, role] : roles.filter((r) => r !== role); act({ action: "saveEmployeeScheduler", employeeId: emp.id, roles: next }); }} />{role}</label>
                      ))}
                    </div>
                  </td>
                  <td><input type="checkbox" checked={emp.notifyEmail !== 0} disabled={busy} onChange={(e) => act({ action: "saveEmployeeScheduler", employeeId: emp.id, roles, notifyEmail: e.target.checked, notifyText: emp.notifyText === 1 })} /></td>
                  <td><input type="checkbox" checked={emp.notifyText === 1} disabled={busy} onChange={(e) => act({ action: "saveEmployeeScheduler", employeeId: emp.id, roles, notifyEmail: emp.notifyEmail !== 0, notifyText: e.target.checked })} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <section>
        <h3>Standing assignments</h3>
        <p className="muted">Auto-fills matching open slots on this shift type going forward.</p>
        <label className="wide"><span>Member</span><select value={standEmp} onChange={(e) => setStandEmp(e.target.value)}><option value="">Select…</option>{data.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
        <label className="wide"><span>Shift type</span><select value={standType} onChange={(e) => setStandType(e.target.value)}><option value="">Select…</option>{data.shiftTypes.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="wide"><span>Role</span><select value={standRole} onChange={(e) => setStandRole(e.target.value)}><option value="">Select…</option>{data.roles.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
        <button disabled={busy || !standEmp || !standType || !standRole} onClick={async () => { const r = await act({ action: "saveStandingAssignment", employeeId: standEmp, shiftTypeId: standType, role: standRole }); if (r) { setStandEmp(""); setStandType(""); setStandRole(""); } }}>Add standing assignment</button>
        <ul className="plain-list">
          {data.standingAssignments.map((s) => (
            <li key={s.id}>{s.employeeName} → {shiftTypeName(s.shiftTypeId)} · {s.role} <button className="link danger" disabled={busy} onClick={() => act({ action: "removeStandingAssignment", id: s.id })}>Remove</button></li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function RequestsScreen({ data, act, busy, employeeName, mode }: { data: Data; act: (b: Record<string, unknown>) => Promise<unknown>; busy: boolean; employeeName: (id: string | null | undefined) => string; mode: "claims" | "trades" }) {
  const slotDate = (slotId: string) => data.slots.find((s) => s.id === slotId)?.entryDate ?? "";
  return (
    <div className="scheduler-grid">
      {mode === "claims" && <section className="wide">
        <h3>Open-shift claims</h3>
        {!data.claims.filter((c) => c.status === "pending").length && <p className="muted">No pending claims.</p>}
        {data.claims.filter((c) => c.status === "pending").map((c) => (
          <div key={c.id} className="entry-card">
            <div className="entry-head"><strong>{c.employeeName}</strong> <span>{c.role} · {friendlyDate(c.entryDate)}</span></div>
            {c.note && <p className="muted">{c.note}</p>}
            <div className="row-actions">
              <button disabled={busy} onClick={() => act({ action: "reviewClaim", id: c.id, decision: "approved" })}>Approve</button>
              <button className="danger" disabled={busy} onClick={() => act({ action: "reviewClaim", id: c.id, decision: "denied" })}>Deny</button>
            </div>
          </div>
        ))}
      </section>}
      {mode === "trades" && <section className="wide">
        <h3>Trades</h3>
        {!data.trades.filter((t) => ["pending", "awaiting_acceptance"].includes(t.status)).length && <p className="muted">No pending trades.</p>}
        {data.trades.filter((t) => ["pending", "awaiting_acceptance"].includes(t.status)).map((t) => (
          <div key={t.id} className="entry-card">
            <div className="entry-head"><strong>{t.fromEmployeeName}</strong> <span>{t.role} · {friendlyDate(t.entryDate || slotDate(t.slotId))}</span></div>
            <p className="muted">{t.targetEmployeeId ? `Directed to ${t.targetEmployeeName}` : "Open to all eligible"} · {t.acceptedByEmployeeId ? `Accepted by ${employeeName(t.acceptedByEmployeeId)}` : "Awaiting acceptance"}</p>
            <div className="row-actions">
              <button disabled={busy || !t.acceptedByEmployeeId} onClick={() => act({ action: "reviewTrade", id: t.id, decision: "approved" })}>Approve</button>
              <button className="danger" disabled={busy} onClick={() => act({ action: "reviewTrade", id: t.id, decision: "denied" })}>Deny</button>
            </div>
          </div>
        ))}
      </section>}
    </div>
  );
}

function TimeOffScreen({ data, isAdmin, act, busy }: { data: Data; isAdmin: boolean; act: (b: Record<string, unknown>) => Promise<unknown>; busy: boolean }) {
  const myId = data.viewer.employeeId;
  const [type, setType] = useState("vacation");
  const [approver, setApprover] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const datesByRequest = (id: string) => data.timeOffDates.filter((d) => d.requestId === id).map((d) => d.offDate);

  // Member's own upcoming scheduled days (from filled slots assigned to them).
  const myScheduledDays = useMemo(() => {
    if (!myId) return [] as string[];
    const mine = new Set(data.slots.filter((s) => s.employeeId === myId && s.entryDate >= data.today).map((s) => s.entryDate));
    return [...mine].sort();
  }, [data, myId]);

  const officers = data.employees.filter((e) => parseRoles(e.roles).includes("Officer/AO"));

  return (
    <div className="scheduler-grid">
      {!isAdmin && (
        <section>
          <h3>Request time off</h3>
          <label className="wide"><span>Type</span><select value={type} onChange={(e) => setType(e.target.value)}>{timeOffTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
          <fieldset><legend>Your scheduled days</legend>
            {!myScheduledDays.length && <p className="muted">You have no upcoming scheduled shifts to request off.</p>}
            {myScheduledDays.map((day) => (
              <label key={day} className="chip"><input type="checkbox" checked={picked.includes(day)} onChange={(e) => setPicked((p) => e.target.checked ? [...p, day] : p.filter((d) => d !== day))} />{friendlyDate(day)}</label>
            ))}
          </fieldset>
          <label className="wide"><span>Approver (Officer/AO)</span><select value={approver} onChange={(e) => setApprover(e.target.value)}><option value="">Select…</option>{officers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
          <button disabled={busy || !picked.length || !approver} onClick={async () => { const r = await act({ action: "submitTimeOff", type, approverEmployeeId: approver, dates: picked }); if (r) { setPicked([]); setApprover(""); } }}>Submit request</button>
        </section>
      )}
      <section className="wide">
        <h3>{isAdmin ? "All time-off requests" : "My requests"}</h3>
        {!data.timeOff.length && <p className="muted">No requests.</p>}
        {data.timeOff.map((r) => {
          const canReview = r.status === "pending" && (isAdmin || r.approverEmployeeId === myId);
          return (
            <div key={r.id} className="entry-card">
              <div className="entry-head"><strong>{r.employeeName}</strong> <span>{timeOffTypes.find((t) => t.id === r.type)?.label ?? r.type} · {r.status}</span></div>
              <p className="muted">{datesByRequest(r.id).map(friendlyDate).join(", ")} · Approver: {r.approverName ?? ""}</p>
              {r.note && <p className="muted">{r.note}</p>}
              {canReview && (
                <div className="row-actions">
                  <button disabled={busy} onClick={() => act({ action: "reviewTimeOff", id: r.id, decision: "approved" })}>Approve</button>
                  <button className="danger" disabled={busy} onClick={() => act({ action: "reviewTimeOff", id: r.id, decision: "denied" })}>Deny</button>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function PriorityEditor({ order, onChange }: { order: string[]; onChange: (next: string[]) => void }) {
  const all = Object.keys(OT_CRITERIA);
  const current = order.filter((id) => all.includes(id));
  const move = (index: number, delta: number) => {
    const next = [...current];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  return (
    <div className="priority-editor">
      <ol>
        {current.map((id, index) => (
          <li key={id}>{OT_CRITERIA[id]}
            <span className="row-actions">
              <button className="link" onClick={() => move(index, -1)} disabled={index === 0}>↑</button>
              <button className="link" onClick={() => move(index, 1)} disabled={index === current.length - 1}>↓</button>
              <button className="link danger" onClick={() => onChange(current.filter((c) => c !== id))}>×</button>
            </span>
          </li>
        ))}
      </ol>
      <div className="inline-form">
        <select defaultValue="" onChange={(e) => { if (e.target.value) { onChange([...current, e.target.value]); e.target.value = ""; } }}>
          <option value="">Add criterion…</option>
          {all.filter((id) => !current.includes(id)).map((id) => <option key={id} value={id}>{OT_CRITERIA[id]}</option>)}
        </select>
      </div>
    </div>
  );
}

function OtModeEditor({ mode, setting, act, busy }: { mode: "voluntary" | "mandatory"; setting: OtSetting; act: (b: Record<string, unknown>) => Promise<unknown>; busy: boolean }) {
  const [draft, setDraft] = useState<OtSetting>(setting);
  useEffect(() => { setDraft(setting); }, [setting]);
  const update = (patch: Partial<OtSetting>) => setDraft((d) => ({ ...d, ...patch }));
  return (
    <section>
      <h3>{mode === "voluntary" ? "Voluntary" : "Mandatory"} rules</h3>
      <label className="row"><span>Exempt off-duty / on leave</span><input type="checkbox" checked={draft.exemptOffDuty} onChange={(e) => update({ exemptOffDuty: e.target.checked })} /></label>
      <label className="row"><span>Exempt already working that day</span><input type="checkbox" checked={draft.exemptAlreadyScheduled} onChange={(e) => update({ exemptAlreadyScheduled: e.target.checked })} /></label>
      {mode === "voluntary" && <label className="row"><span>Exempt those who declined this vacancy</span><input type="checkbox" checked={draft.exemptDeclined} onChange={(e) => update({ exemptDeclined: e.target.checked })} /></label>}
      {mode === "mandatory" && <>
        <label className="row"><span>Exempt recently mandated within</span><input type="number" min={0} max={365} value={draft.recentDays} onChange={(e) => update({ recentDays: Number(e.target.value) })} /> days</label>
        <label className="row"><span>Enable recently-mandated exemption</span><input type="checkbox" checked={draft.exemptRecentlyMandated} onChange={(e) => update({ exemptRecentlyMandated: e.target.checked })} /></label>
        <label className="row"><span>Exempt at/over consecutive shifts</span><input type="number" min={1} max={30} value={draft.maxConsecutive} onChange={(e) => update({ maxConsecutive: Number(e.target.value) })} /></label>
        <label className="row"><span>Enable max-consecutive exemption</span><input type="checkbox" checked={draft.exemptMaxConsecutive} onChange={(e) => update({ exemptMaxConsecutive: e.target.checked })} /></label>
      </>}
      <h4>Priority order</h4>
      <PriorityEditor order={draft.priorityOrder} onChange={(priorityOrder) => update({ priorityOrder })} />
      <button disabled={busy} onClick={() => act({ action: "saveOtSettings", mode, ...draft })}>Save {mode} rules</button>
    </section>
  );
}

function OvertimeScreen({ data, act, busy, employeeName }: { data: Data; act: (b: Record<string, unknown>) => Promise<unknown>; busy: boolean; employeeName: (id: string | null | undefined) => string }) {
  const [awardDaysOut, setAward] = useState(data.otTiming.awardDaysOut);
  const [completeBy, setCompleteBy] = useState(data.otTiming.completeByDaysOut);
  const [callSlot, setCallSlot] = useState("");
  const [callMode, setCallMode] = useState<"voluntary" | "mandatory">("voluntary");
  const openSlots = data.slots.filter((s) => s.status === "open");
  const offersForSlot = (slotId: string) => data.otOffers.filter((o) => o.slotId === slotId).sort((a, b) => a.rank - b.rank);

  return (
    <div className="scheduler-grid">
      <section>
        <h3>Award timing</h3>
        <label className="row"><span>Awardable this many days out</span><input type="number" min={1} value={awardDaysOut} onChange={(e) => setAward(Number(e.target.value))} /></label>
        <label className="row"><span>Must be filled by (days out)</span><input type="number" min={0} value={completeBy} onChange={(e) => setCompleteBy(Number(e.target.value))} /></label>
        <button disabled={busy} onClick={() => act({ action: "saveOtTiming", awardDaysOut, completeByDaysOut: completeBy })}>Save timing</button>
      </section>
      {data.otSettings && <OtModeEditor mode="voluntary" setting={data.otSettings.voluntary} act={act} busy={busy} />}
      {data.otSettings && <OtModeEditor mode="mandatory" setting={data.otSettings.mandatory} act={act} busy={busy} />}

      <section className="wide">
        <h3>Build call list</h3>
        <div className="inline-form">
          <select value={callSlot} onChange={(e) => setCallSlot(e.target.value)}>
            <option value="">Choose an open shift…</option>
            {openSlots.map((s) => <option key={s.id} value={s.id}>{friendlyDate(s.entryDate)} · {s.role} {data.awardBySlot[s.id]?.window === "overdue" ? "(overdue)" : ""}</option>)}
          </select>
          <select value={callMode} onChange={(e) => setCallMode(e.target.value as "voluntary" | "mandatory")}>
            <option value="voluntary">Voluntary</option><option value="mandatory">Mandatory</option>
          </select>
          <button disabled={busy || !callSlot} onClick={() => act({ action: "buildOtCallList", slotId: callSlot, mode: callMode })}>Build ranked list</button>
        </div>
        {callSlot && (
          <ol className="call-list">
            {offersForSlot(callSlot).map((o) => (
              <li key={o.id}>
                <span>{o.employeeName}</span>
                <span className={`badge ${o.status}`}>{o.status}</span>
                <button className="link" disabled={busy || o.status === "accepted" || o.status === "mandated"} onClick={() => act({ action: "awardOtOffer", slotId: callSlot, employeeId: o.employeeId, mode: callMode })}>{callMode === "mandatory" ? "Mandate" : "Award"}</button>
              </li>
            ))}
            {!offersForSlot(callSlot).length && <p className="muted">No eligible members after exemptions.</p>}
          </ol>
        )}
      </section>

      <section className="wide">
        <h3>Standings by role</h3>
        {data.roles.map((role) => (
          <div key={role} className="entry-card">
            <strong>{role}</strong>
            <div className="standings-cols">
              <div><em>Voluntary</em><ol>{(data.otStandings[role]?.voluntary ?? []).slice(0, 8).map((id) => <li key={id}>{employeeName(id)}</li>)}</ol></div>
              <div><em>Mandatory</em><ol>{(data.otStandings[role]?.mandatory ?? []).slice(0, 8).map((id) => <li key={id}>{employeeName(id)}</li>)}</ol></div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function DistributionScreen({ data, act, busy }: { data: Data; act: (b: Record<string, unknown>) => Promise<unknown>; busy: boolean }) {
  const [w, setW] = useState<Weights>(data.distributionWeights);
  const [fromDate, setFromDate] = useState(data.today);
  useEffect(() => { setW(data.distributionWeights); }, [data.distributionWeights]);
  return (
    <div className="scheduler-grid">
      <section>
        <h3>Distribution weights</h3>
        <label className="row"><span>Seniority weight</span><input type="number" min={0} max={10} step={0.1} value={w.seniorityWeight} onChange={(e) => setW({ ...w, seniorityWeight: Number(e.target.value) })} /></label>
        <label className="row"><span>Hours-balance weight</span><input type="number" min={0} max={10} step={0.1} value={w.hoursWeight} onChange={(e) => setW({ ...w, hoursWeight: Number(e.target.value) })} /></label>
        <label className="row"><span>{w.customLabel} weight</span><input type="number" min={0} max={10} step={0.1} value={w.customWeight} onChange={(e) => setW({ ...w, customWeight: Number(e.target.value) })} /></label>
        <label className="row"><span>Custom label</span><input value={w.customLabel} onChange={(e) => setW({ ...w, customLabel: e.target.value })} /></label>
        <button disabled={busy} onClick={() => act({ action: "saveDistributionWeights", ...w })}>Save weights</button>
      </section>
      <section>
        <h3>Run auto-distribution</h3>
        <p className="muted">Fills every open slot from this date forward with the highest-scoring eligible member who is free that day.</p>
        <label className="row"><span>From date</span><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></label>
        <button disabled={busy} onClick={async () => { const r = await act({ action: "runAutoDistribution", fromDate }) as { assigned?: number } | null; if (r) alert(`Assigned ${r.assigned ?? 0} open slot(s).`); }}>Run now</button>
      </section>
    </div>
  );
}

function RemindersScreen({ data, act, busy }: { data: Data; act: (b: Record<string, unknown>) => Promise<unknown>; busy: boolean }) {
  return (
    <div className="scheduler-grid">
      <section className="wide">
        <h3>Reminder rules</h3>
        {data.reminderRules.map((rule) => <ReminderRuleEditor key={rule.id} rule={rule} act={act} busy={busy} />)}
      </section>
    </div>
  );
}

function ReminderRuleEditor({ rule, act, busy }: { rule: ReminderRule; act: (b: Record<string, unknown>) => Promise<unknown>; busy: boolean }) {
  const [offsets, setOffsets] = useState<string[]>(() => { try { return JSON.parse(rule.offsets || "[]"); } catch { return []; } });
  const [emailEnabled, setEmail] = useState(rule.emailEnabled === 1);
  const [textEnabled, setText] = useState(rule.textEnabled === 1);
  const [enabled, setEnabled] = useState(rule.enabled === 1);
  const [target, setTarget] = useState(rule.target);
  const [newOffset, setNewOffset] = useState("");
  return (
    <div className="entry-card">
      <div className="entry-head"><strong>{rule.label}</strong>
        <label className="chip"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />Enabled</label>
      </div>
      <div className="chip-list">{offsets.map((o) => <span key={o} className="chip">{o}<button className="link danger" onClick={() => setOffsets((prev) => prev.filter((x) => x !== o))}>×</button></span>)}</div>
      <div className="inline-form">
        <input value={newOffset} onChange={(e) => setNewOffset(e.target.value)} placeholder="e.g. 7 days before" />
        <button className="link" onClick={() => { if (newOffset.trim()) { setOffsets((p) => [...new Set([...p, newOffset.trim()])]); setNewOffset(""); } }}>Add timing</button>
      </div>
      <label className="row"><span>Email</span><input type="checkbox" checked={emailEnabled} onChange={(e) => setEmail(e.target.checked)} /></label>
      <label className="row"><span>Text</span><input type="checkbox" checked={textEnabled} onChange={(e) => setText(e.target.checked)} /></label>
      <label className="wide"><span>Target</span><input value={target} onChange={(e) => setTarget(e.target.value)} /></label>
      <button disabled={busy} onClick={() => act({ action: "saveReminderRule", id: rule.id, offsets, emailEnabled, textEnabled, target, enabled })}>Save</button>
    </div>
  );
}

function MyRequestsScreen({ data, act, busy }: { data: Data; act: (b: Record<string, unknown>) => Promise<unknown>; busy: boolean }) {
  const myId = data.viewer.employeeId;
  const myClaims = data.claims.filter((c) => c.employeeId === myId);
  const myTrades = data.trades.filter((t) => t.fromEmployeeId === myId);
  const incomingTrades = data.trades.filter((t) => (t.targetEmployeeId === myId || (t.targetEmployeeId === null && t.fromEmployeeId !== myId)) && ["pending", "awaiting_acceptance"].includes(t.status));
  return (
    <div className="scheduler-grid">
      <section className="wide">
        <h3>Trades needing my response</h3>
        {!incomingTrades.length && <p className="muted">Nothing waiting on you.</p>}
        {incomingTrades.map((t) => (
          <div key={t.id} className="entry-card">
            <div className="entry-head"><strong>{t.fromEmployeeName}</strong> <span>{t.role} · {friendlyDate(t.entryDate)}</span></div>
            <div className="row-actions">
              <button disabled={busy} onClick={() => act({ action: "respondTrade", id: t.id, decision: "accept" })}>Accept</button>
              <button className="danger" disabled={busy} onClick={() => act({ action: "respondTrade", id: t.id, decision: "decline" })}>Decline</button>
            </div>
          </div>
        ))}
      </section>
      <section className="wide">
        <h3>My open-shift requests</h3>
        {!myClaims.length && <p className="muted">No requests.</p>}
        {myClaims.map((c) => <div key={c.id} className="entry-card"><strong>{c.role}</strong> · {friendlyDate(c.entryDate)} · <span className={`badge ${c.status}`}>{c.status}</span></div>)}
      </section>
      <section className="wide">
        <h3>My trades</h3>
        {!myTrades.length && <p className="muted">No trades.</p>}
        {myTrades.map((t) => <div key={t.id} className="entry-card"><strong>{t.role}</strong> · {friendlyDate(t.entryDate)} · <span className={`badge ${t.status}`}>{t.status}</span></div>)}
      </section>
    </div>
  );
}

function OtListScreen({ data, act, busy }: { data: Data; act: (b: Record<string, unknown>) => Promise<unknown>; busy: boolean }) {
  const myId = data.viewer.employeeId;
  const eligibleRoles = data.viewer.roles;
  const openEligible = data.slots.filter((s) => s.status === "open" && eligibleRoles.includes(s.role));
  const myInterest = (slotId: string) => data.otInterest.find((i) => i.slotId === slotId && i.employeeId === myId)?.response ?? "";
  const myOffer = (slotId: string) => data.otOffers.find((o) => o.slotId === slotId && o.employeeId === myId);
  return (
    <div className="scheduler-grid">
      <section className="wide">
        <h3>Open shifts I'm eligible for</h3>
        {!openEligible.length && <p className="muted">No open shifts for your roles right now.</p>}
        {openEligible.map((s) => {
          const award = data.awardBySlot[s.id];
          const offer = myOffer(s.id);
          return (
            <div key={s.id} className={`entry-card${award?.window === "overdue" ? " urgent" : ""}`}>
              <div className="entry-head"><strong>{s.role}</strong> <span>{friendlyDate(s.entryDate)} · {award ? windowLabel[award.window] : ""}</span></div>
              {award?.window === "early" && (
                <div className="row-actions">
                  <span>Early interest:</span>
                  <button className={myInterest(s.id) === "yes" ? "current" : ""} disabled={busy} onClick={() => act({ action: "setOtInterest", slotId: s.id, response: "yes" })}>Yes</button>
                  <button className={myInterest(s.id) === "no" ? "current" : ""} disabled={busy} onClick={() => act({ action: "setOtInterest", slotId: s.id, response: "no" })}>No</button>
                </div>
              )}
              {offer && offer.status === "offered" && (
                <div className="row-actions">
                  <span>You're on the call list (#{offer.rank}):</span>
                  <button disabled={busy} onClick={() => act({ action: "respondOtOffer", slotId: s.id, decision: "accept" })}>Accept</button>
                  <button className="danger" disabled={busy} onClick={() => act({ action: "respondOtOffer", slotId: s.id, decision: "decline" })}>Decline</button>
                </div>
              )}
              {offer && offer.status !== "offered" && <p className="muted">Your response: {offer.status}</p>}
            </div>
          );
        })}
      </section>
      <section className="wide">
        <h3>Where I stand</h3>
        {data.roles.filter((r) => eligibleRoles.includes(r)).map((role) => {
          const vol = data.otStandings[role]?.voluntary ?? [];
          const man = data.otStandings[role]?.mandatory ?? [];
          const volPos = vol.indexOf(myId ?? "") + 1;
          const manPos = man.indexOf(myId ?? "") + 1;
          return <div key={role} className="entry-card"><strong>{role}</strong> — Voluntary #{volPos || "—"} of {vol.length} · Mandatory #{manPos || "—"} of {man.length}</div>;
        })}
      </section>
    </div>
  );
}
