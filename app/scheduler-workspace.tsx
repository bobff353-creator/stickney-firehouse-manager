"use client";
/* eslint-disable @next/next/no-img-element -- Fixed-size local department patch. */

import dynamic from "next/dynamic";
import { scheduleSaveFeedback } from "./scheduler-save-feedback";
import SavedAvailabilityList from './saved-availability-list';
import { scheduleDestination, isScheduleWorkspaceScreen } from "./scheduler-navigation";
import { confirmLeavingWork } from "./use-unsaved-work";
import { useCallback, useEffect, useRef, useState } from "react";
import { shiftHasNotStarted } from "./scheduler-member-view";
import {
  incomingTradeOffers,
  openScheduleSeats,
  scheduleClock,
  scheduleDateOffset,
  scheduleDayLabel,
  scheduleRoles,
  scheduleSpan,
  slotOrder,
  upcomingAssignments,
  validScheduleDate,
  workspaceRequests,
} from "./scheduler-workspace-model";
import type {
  LiveSchedule,
  ScheduleSlot,
  ScheduleTrade,
  SchedulerPreviewMember,
  WorkspaceRequest,
} from "./scheduler-workspace-model";
import { ScheduleDialog } from "./scheduler-workspace-dialogs";
import type { ScheduleDialogState } from "./scheduler-workspace-dialogs";
import "./scheduler-workspace.css";

const ManagementTools = dynamic(() => import("./station-scheduler"), {
  loading: () => <p role="status">Loading scheduling tools…</p>,
});
const memberTabs = [
  ["shifts", "My shifts"],
  ["coverage", "Coverage"],
  ["requests", "Requests"],
];
const adminTabs = [
  ["setup", "Set up a month"],
  ["availability", "Availability"],
  ["staffing", "Staffing"],
  ["calendarDetail", "Calendar"],
  ["approvals", "Approvals"],
  ["patterns", "Shift patterns"],
  ["roster", "Recurring crews"],
  ["people", "People"],
  ["alerts", "Alerts"],
];
type Action = (body: Record<string, unknown>) => Promise<boolean>;
export default function SchedulerWorkspace({
  testMember = null,
}: {
  testMember?: SchedulerPreviewMember | null;
}) {
  const [data, setData] = useState<LiveSchedule | null>(null);
  const [mode, setMode] = useState<"member" | "admin">("member");
  const [tab, setTab] = useState("shifts");
  const [date, setDate] = useState("");
  const [calendar, setCalendar] = useState(false);
  const [wholeCrew, setWholeCrew] = useState(false);
  const [month, setMonth] = useState("");
  const [advanced, setAdvanced] = useState("");
  const [toolsRefresh, setToolsRefresh] = useState(0);
  const [dialog, setDialog] = useState<ScheduleDialogState | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [availabilityReview, setAvailabilityReview] = useState<{ month: string; query: string; version: number } | null>(null);
  const [savedNext, setSavedNext] = useState({ next: "", label: "" });
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadedAt, setLoadedAt] = useState("");
  const [now, setNow] = useState(() => new Date());
  const writing = useRef(false);
  const initial = useRef(false);
  const heading = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/station-scheduler", {
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Unable to load the schedule.");
      setData(result);
      setStale(false);
      setError("");
      setDate((current) => current || result.today);
      setMonth((current) => current || result.today.slice(0, 7));
      setLoadedAt(
        new Date().toLocaleTimeString("en-US", {
          timeZone: "America/Chicago",
          hour: "numeric",
          minute: "2-digit",
        }),
      );
      if (!initial.current) {
        initial.current = true;
        const params = new URLSearchParams(window.location.search);
        const requested = params.get("adminTask") || "";
        const reviewDate = params.get("scheduleDate") || "";
        if (validScheduleDate(reviewDate)) {
          setDate(reviewDate);
          setMonth(reviewDate.slice(0, 7));
          setCalendar(true);
        }
        if (result.viewer.isAdmin && !testMember && requested) {
          setMode("admin");
          if (requested === "calendar") setAdvanced("calendarDetail");
          else if (["overview", "openAdmin"].includes(requested)) setTab("staffing");
          else if (["trades", "requests"].includes(requested))
            setTab("approvals");
          else if (requested === "shiftTypes") setTab("patterns");
          else if (requested === "roster") setAdvanced("roster");
          else if (requested === "reminders") setTab("alerts");
          else setAdvanced(requested);
        }
      }
      return true;
    } catch (e) {
      setStale(true);
      setError(e instanceof Error ? e.message : "Unable to load the schedule.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [testMember]);
  useEffect(() => {
    const start = window.setTimeout(() => {
      void load();
    }, 0);
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => {
      clearTimeout(start);
      clearInterval(timer);
    };
  }, [load]);
  const act: Action = async (body) => {
    if (writing.current) return false;
    if (testMember || stale) {
      setError(
        testMember
          ? "This member preview is read-only. Return to your account to make changes."
          : "Refresh the schedule before making another change.",
      );
      return false;
    }
    writing.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/station-scheduler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error || "Unable to save. Your selections have been kept.",
        );
      if (result.ok !== true) { setStale(true); throw new Error("The server did not confirm the save. Refresh the saved schedule before trying again."); }
      const feedback = scheduleSaveFeedback(body);
      setNotice(feedback.message + (result.note ? " " + result.note : ""));
      setSavedNext({ next: feedback.next, label: feedback.label });
      if (body.action === 'saveAvailability' && Array.isArray(body.dates)) {
        const dates = body.dates.filter((value): value is string => typeof value === 'string' && validScheduleDate(value)).sort();
        if (dates.length) setAvailabilityReview(previous => ({ month: dates[0].slice(0, 7), query: dates.length === 1 ? dates[0] : '', version: (previous?.version || 0) + 1 }));
      }
      const affectedSlot = data?.slots.find(s => s.id === (body.slotId || data.claims.find(c => c.id === body.id)?.slotId || data.trades.find(t => t.id === body.id)?.slotId));
      const affectedDate = typeof body.date === 'string' ? body.date : affectedSlot?.entryDate;
      if (affectedDate && validScheduleDate(affectedDate)) { setDate(affectedDate); setMonth(affectedDate.slice(0, 7)); }
      if (!(await load()))
        setError(
          "Your change was saved, but the updated schedule could not load. Refresh before making another change.",
        );
      return true;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to save. Your selections have been kept.",
      );
      return false;
    } finally {
      writing.current = false;
      setBusy(false);
    }
  };
  const navigate = (next: string, nextDate?: string) => {
    if (!confirmLeavingWork()) return false;
    const destination = scheduleDestination(next, Boolean(advanced) && mode === "admin");
    const native = isScheduleWorkspaceScreen(destination);
    if (native) {
      if (advanced) void load();
      setAdvanced("");
      setTab(destination);
      if (next === "calendar" || next === "day") {
        const selected = nextDate || month + "-01";
        if (validScheduleDate(selected)) { setDate(selected); setMonth(selected.slice(0, 7)); }
        setCalendar(next === "calendar");
      }
    } else {
      if (next === "calendar" && nextDate && validScheduleDate(nextDate)) { setDate(nextDate); setMonth(nextDate.slice(0, 7)); }
      setAdvanced(destination);
    }
    if (!stale) setError("");
    setNotice("");
    if (window.matchMedia("(max-width: 700px)").matches)
      heading.current?.scrollIntoView({ block: "start", behavior: "instant" });
    return true;
  };
  if (!data)
    return (
      <section className="sf-schedule">
        <div className="sf-panel sf-empty">
          <h2>Stickney schedule</h2>
          <p role={error ? "alert" : "status"}>
            {error || "Loading your Firehouse Manager schedule…"}
          </p>
          {error && (
            <button
              onClick={() => {
                setError("");
                void load();
              }}
            >
              Try again
            </button>
          )}
        </div>
      </section>
    );
  const employeeId = testMember?.id || data.viewer.employeeId || "";
  const viewerName = testMember?.name || data.viewer.name;
  const isAdmin = data.viewer.isAdmin && !testMember;
  const view = isAdmin ? mode : "member";
  const readOnly = Boolean(testMember) || loading || busy || stale;
  const shifts = upcomingAssignments(data, employeeId, now);
  const offers = incomingTradeOffers(data, employeeId, now);
  const myRequests = workspaceRequests(data, employeeId);
  const review = workspaceRequests(data, employeeId, true).filter(
    (r) => r.status === "pending",
  );
  const changeDate = (next: string) => {
    setDate(next);
    setMonth(next.slice(0, 7));
  };
  const openSlot = (slot: ScheduleSlot) => {
    if (view === "admin") setDialog({ kind: "staff", slot });
    else if (slot.employeeId === employeeId) setDialog({ kind: "trade", slot });
    else if (slot.status === "open") setDialog({ kind: "claim", slot });
    else setDialog({ kind: "details", slot });
  };
  return (
    <section
      className="sf-schedule"
      aria-label="Stickney Fire Department schedule"
    >
      <div className="sf-heading" ref={heading}>
        <div className="sf-brand">
          <img
            src="/stickney-fd-patch.png?v=3"
            alt="Stickney Fire Department patch"
            width="52"
            height="56"
          />
          <div>
            <p className="sf-eyebrow">STICKNEY FIRE DEPARTMENT</p>
            <h2>Schedule</h2>
          </div>
        </div>
        <div className="sf-heading-actions">
          <button
            className="sf-icon-button"
            disabled={loading || busy}
            onClick={() => {
              setError("");
              void load();
              setToolsRefresh(value => value + 1);
            }}
            aria-label="Refresh schedule"
          >
            ↻
          </button>
          {isAdmin && (
            <div className="sf-segment" aria-label="Schedule view">
              <button
                aria-pressed={mode === "member"}
                onClick={() => {
                  if (navigate("shifts")) setMode("member");
                }}
              >
                My schedule
              </button>
              <button
                aria-pressed={mode === "admin"}
                onClick={() => {
                  if (navigate("staffing")) setMode("admin");
                }}
              >
                Manage
              </button>
            </div>
          )}
        </div>
      </div>
      {!advanced && <p className="sf-sync">
        {loading ? "Refreshing…" : `Firehouse Manager · updated ${loadedAt} CT`}{" "}
        {testMember ? "· Read-only member preview" : ""}
      </p>}
      {error && !dialog && (
        <div className="sf-message sf-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="sf-message sf-success" role="status">
          <p>{notice}</p>
          {savedNext.next && <button className="sf-secondary" disabled={busy || loading} onClick={() => { if (stale) { void load(); return; } navigate(savedNext.next); }}>{stale ? 'Refresh saved schedule' : savedNext.label} →</button>}
        </div>
      )}
      <>
        <nav
          className="sf-tabs"
          aria-label={view === "member" ? "My schedule" : "Schedule management"}
        >
          {(view === "admin" ? adminTabs : memberTabs).map(([id, label]) => (
            <button
              key={id}
              aria-current={(advanced || tab) === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              {label}
              {id === "coverage" && offers.length > 0 && (
                <span className="sf-count">{offers.length}</span>
              )}
              {id === "approvals" && review.length > 0 && (
                <span className="sf-count">{review.length}</span>
              )}
            </button>
          ))}
        </nav>
        {view === "admin" && <div className="sf-tools-navigation">
          <label>All scheduling tools<select aria-label="All scheduling tools" value={advanced || tab} onChange={event => navigate(event.target.value)}>
            {[...adminTabs, ["shiftTypes", "Add shift patterns"], ["distribution", "Fill open positions"], ["openAdmin", "Find open positions"], ["safety", "Conflicts & rules"], ["reminders", "All reminders & deadlines"], ["confirmation", "Required confirmation"]].map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select></label>
          <p>One saved department schedule. Review changes before saving. Automatic texts and emails remain off.</p>
        </div>}
        {view === "admin" && advanced ? <div className="sf-integrated-tools">
          <div className="sf-section-heading"><button className="sf-secondary" onClick={() => navigate("staffing")}>Back to staffing</button></div>
          <ManagementTools embedded initialTask={advanced === "calendarDetail" ? "calendar" : advanced} initialDate={date.slice(0, 7) === month ? date : month + "-01"} initialMonth={month} onDateChange={setDate} onMonthChange={setMonth} onNavigate={navigate} refreshToken={toolsRefresh} onSaved={() => { void load(); }} />
        </div> : <>
        {view === "member" &&
          (tab === "shifts" || !memberTabs.some(([id]) => id === tab)) && (
            <>
              <div className="sf-section-heading">
                <div>
                  <p className="sf-eyebrow">YOUR NEXT TOUR</p>
                  <h3>{viewerName || "Your schedule"}</h3>
                </div>
                <button
                  className="sf-secondary"
                  disabled={readOnly || !employeeId}
                  onClick={() => setDialog({ kind: "request" })}
                >
                  Update availability <span aria-hidden>＋</span>
                </button>
              </div>
              {shifts[0] ? (
                <div className="sf-next">
                  <div>
                    <p className="sf-eyebrow">
                      {scheduleDayLabel(shifts[0].entryDate, true)}
                    </p>
                    <h3>{scheduleSpan(shifts[0])}</h3>
                    <p>
                      {shifts[0].role} <span aria-hidden>·</span>{" "}
                      {
                        data.shiftTypes.find(
                          (t) => t.id === shifts[0].shiftTypeId,
                        )?.name
                      }
                    </p>
                    {shifts[0].staffingReason && (
                      <p>{shifts[0].staffingReason}</p>
                    )}
                  </div>
                  <button
                    disabled={
                      readOnly ||
                      !shiftHasNotStarted(
                        shifts[0].entryDate,
                        shifts[0].startTime,
                        now,
                      )
                    }
                    onClick={() =>
                      setDialog({ kind: "trade", slot: shifts[0] })
                    }
                  >
                    Offer a trade <span aria-hidden>↗</span>
                  </button>
                </div>
              ) : (
                <Empty
                  title="No upcoming assignments"
                  text={
                    employeeId
                      ? "Your saved shifts will appear here when assigned."
                      : "This login is not linked to a scheduling employee. An administrator can update the employee record."
                  }
                />
              )}
              <div className="sf-section-heading">
                <h3>{calendar ? "Your calendar" : "Coming up"}</h3>
                <div className="sf-segment">
                  <button
                    aria-pressed={!calendar}
                    onClick={() => setCalendar(false)}
                  >
                    List
                  </button>
                  <button
                    aria-pressed={calendar}
                    onClick={() => setCalendar(true)}
                  >
                    Calendar
                  </button>
                </div>
              </div>
              {calendar ? (
                <>
                  <label className="sf-check">
                    <input
                      type="checkbox"
                      checked={wholeCrew}
                      onChange={(e) => setWholeCrew(e.target.checked)}
                    />{" "}
                    Show entire crew
                  </label>
                  <ScheduleCalendar
                    data={data}
                    date={date}
                    month={month}
                    setMonth={setMonth}
                    setDate={changeDate}
                    employeeId={wholeCrew ? "" : employeeId}
                  />
                  <SlotList
                    data={data}
                    slots={data.slots
                      .filter(
                        (s) =>
                          s.entryDate === date &&
                          (wholeCrew || s.employeeId === employeeId),
                      )
                      .sort(slotOrder)}
                    open={openSlot}
                    label={scheduleDayLabel(date, true)}
                  />
                </>
              ) : (
                <PagedSlots
                  key={employeeId}
                  data={data}
                  slots={shifts}
                  open={openSlot}
                />
              )}
              <div className="sf-info-grid">
                <button
                  className="sf-link-card"
                  onClick={() => navigate("coverage")}
                >
                  <span className="sf-card-icon" aria-hidden>
                    ⇄
                  </span>
                  <strong>Find coverage</strong>
                  <span>Eligible trades and open shifts</span>
                  <b aria-hidden>→</b>
                </button>
                <button
                  className="sf-link-card"
                  onClick={() => navigate("requests")}
                >
                  <span className="sf-card-icon" aria-hidden>
                    ✓
                  </span>
                  <strong>Your requests</strong>
                  <span>
                    {
                      myRequests.filter((r) =>
                        ["offered", "pending"].includes(r.status),
                      ).length
                    }{" "}
                    awaiting acceptance or review
                  </span>
                  <b aria-hidden>→</b>
                </button>
              </div>
            </>
          )}
        {view === "member" && tab === "coverage" && (
          <Coverage
            data={data}
            employeeId={employeeId}
            now={now}
            offers={offers}
            disabled={readOnly}
            open={setDialog}
          />
        )}
        {view === "member" && tab === "requests" && (
          <>
            <div className="sf-section-heading">
              <div>
                <h3>Requests & availability</h3>
                <p>
                  Track shift requests and trades, or update the days and hours you can work.
                </p>
              </div>
              <button
                disabled={readOnly || !employeeId}
                onClick={() => setDialog({ kind: "request" })}
              >
                Update availability ＋
              </button>
            </div>
            <RequestList data={data} requests={myRequests} open={setDialog} />
            <AvailabilityList
              data={data}
              employeeId={employeeId}
              disabled={readOnly}
              act={act}
              open={setDialog}
              review={availabilityReview}
            />
          </>
        )}
        {view === "admin" && tab === "staffing" && (
          <>
            <div className="sf-panel"><h3>Planning a month?</h3><p>Keep recurring crews, check submitted availability, then fill open positions.</p><button className="sf-secondary" onClick={() => setAdvanced('setup')}>Set up a month →</button></div>
            <div className="sf-section-heading">
              <div>
                <h3>Staff the day</h3>
                <p>Saved assignments, open positions, and special details.</p>
              </div>
              <button
                disabled={readOnly}
                onClick={() => setDialog({ kind: "detail", date })}
              >
                Add special detail ＋
              </button>
            </div>
            <div className="sf-toolbar">
              <div className="sf-date-controls">
                <button
                  aria-label="Previous day"
                  onClick={() => changeDate(scheduleDateOffset(date, -1))}
                >
                  ←
                </button>
                <input
                  aria-label="Staffing date"
                  type="date"
                  value={date}
                  onChange={(e) => {
                    if (validScheduleDate(e.target.value))
                      changeDate(e.target.value);
                  }}
                />
                <button
                  aria-label="Next day"
                  onClick={() => changeDate(scheduleDateOffset(date, 1))}
                >
                  →
                </button>
                <button onClick={() => changeDate(data.today)}>Today</button>
              </div>
              <button
                className="sf-secondary"
                onClick={() => navigate("calendarDetail")}
              >
                Month calendar
              </button>
            </div>
            <div className="sf-stats">
              <div>
                <strong>
                  {
                    data.slots.filter(
                      (s) => s.entryDate === date && s.status === "filled",
                    ).length
                  }
                </strong>
                <span>Filled</span>
              </div>
              <div>
                <strong>
                  {
                    data.slots.filter(
                      (s) => s.entryDate === date && s.status === "open",
                    ).length
                  }
                </strong>
                <span>Open</span>
              </div>
              <div>
                <strong>
                  {
                    data.slots.filter((s) => s.entryDate === date && s.isExtra)
                      .length
                  }
                </strong>
                <span>Extra positions</span>
              </div>
            </div>
            <SlotList
              data={data}
              slots={data.slots
                .filter((s) => s.entryDate === date)
                .sort(slotOrder)}
              open={openSlot}
              label={scheduleDayLabel(date, true)}
              admin
            />
            <div className="sf-panel sf-tools">
              <h3>More scheduling tools</h3>
              <p>
                Existing rules, overtime distribution, availability reports, and
                confirmations remain connected to this schedule.
              </p>
              <div className="sf-button-row">
                {[
                  ["safety", "Review rules"],
                  ["distribution", "Overtime distribution"],
                  ["availability", "Crew availability"],
                  ["confirmation", "Confirmations"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    className="sf-secondary"
                    onClick={() => setAdvanced(id)}
                  >
                    {label} →
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        {view === "admin" && tab === "approvals" && (
          <Approvals
            data={data}
            requests={workspaceRequests(data, employeeId, true)}
            open={setDialog}
          />
        )}
        {view === "admin" && tab === "patterns" && (
          <>
            <div className="sf-section-heading">
              <div>
                <h3>Recurring schedules</h3>
                <p>
                  Existing rotations and standing assignments, using your saved
                  positions.
                </p>
              </div>
              <button
                disabled={readOnly}
                onClick={() => setDialog({ kind: "pattern" })}
              >
                New recurring schedule ＋
              </button>
            </div>
            <div className="sf-patterns">
              {data.shiftTypes.map((shift) => (
                <button
                  key={shift.id}
                  className="sf-panel sf-pattern"
                  onClick={() => setDialog({ kind: "pattern", shift })}
                >
                  <span className="sf-eyebrow">
                    EVERY {shift.repeatEveryDays}{" "}
                    {shift.repeatEveryDays === 1 ? "DAY" : "DAYS"}
                  </span>
                  <strong>{shift.name}</strong>
                  <span className="sf-badge">{shift.active ? 'Active pattern' : 'Retired · saved history'}</span>
                  <span>
                    {scheduleClock(shift.startTime)}–
                    {scheduleClock(shift.endTime)}
                  </span>
                  <span>
                    Starts {scheduleDayLabel(shift.anchorDate)} ·{" "}
                    {data.shiftTypeRoles
                      .filter((r) => r.shiftTypeId === shift.id)
                      .reduce((sum, r) => sum + r.count, 0)}{" "}
                    positions
                  </span>
                  <span className="sf-edit-label">View or edit →</span>
                </button>
              ))}
            </div>
            <div className="sf-panel sf-tools">
              <h3>Standing assignments</h3>
              <p>
                {data.standingAssignments.filter((a) => a.active).length} saved
                recurring assignments. Assign qualified members or adjust future
                coverage.
              </p>
              <button
                className="sf-secondary"
                onClick={() => setAdvanced("roster")}
              >
                Manage standing assignments →
              </button>
            </div>
          </>
        )}
        {view === "admin" && tab === "people" && <People data={data} />}
        {view === "admin" && tab === "alerts" && (
          <>
            <div className="sf-section-heading">
              <div>
                <h3>Scheduling alerts</h3>
                <p>
                  Set when members hear about open positions and shift requests.
                </p>
              </div>
              <a
                className="sf-secondary sf-button"
                href="?display=portal&page=system-health"
              >
                Delivery health →
              </a>
            </div>
            <p className="sf-message">
              Push service{" "}
              {data.pushConfigured ? "is configured" : "is not configured"}.
              Each member must enable notifications on their device. Delivery
              status is available in System Health.
            </p>
            <div className="sf-alerts">
              {data.reminderRules.map((rule) => (
                <button
                  className="sf-panel sf-alert-rule"
                  key={rule.id}
                  onClick={() => setDialog({ kind: "reminder", rule })}
                >
                  <div>
                    <strong>{rule.label}</strong>
                    <span
                      className={`sf-badge ${rule.enabled && rule.pushEnabled ? "sf-good" : ""}`}
                    >
                      {rule.enabled && rule.pushEnabled
                        ? "Push on"
                        : "Push off"}
                    </span>
                  </div>
                  <p>
                    {parseTimings(rule.offsets).join(" · ") ||
                      "No reminder times set"}
                  </p>
                  <span className="sf-edit-label">Edit alert →</span>
                </button>
              ))}
            </div>
            {data.reminderRules.length === 0 && (
              <Empty
                title="No saved alert rules"
                text="Open the existing reminder tools to review configuration."
              />
            )}
            <button
              className="sf-secondary"
              onClick={() => setAdvanced("reminders")}
            >
              All reminders & request deadlines →
            </button>
          </>
        )}
        </>}
      </>
      {dialog && (
        <ScheduleDialog
          key={JSON.stringify(dialog)}
          state={dialog}
          data={data}
          employeeId={employeeId}
          busy={busy}
          disabled={readOnly}
          error={error}
          reload={load}
          refreshing={loading}
          act={act}
          close={() => {
            if (!busy) setDialog(null);
          }}
        />
      )}
    </section>
  );
}

export function parseTimings(value: string): string[] {
  try {
    const items = JSON.parse(value);
    return Array.isArray(items)
      ? items.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="sf-panel sf-empty">
      <span aria-hidden>▦</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function SlotList({
  data,
  slots,
  open,
  label,
  admin = false,
}: {
  data: LiveSchedule;
  slots: ScheduleSlot[];
  open: (slot: ScheduleSlot) => void;
  label?: string;
  admin?: boolean;
}) {
  return (
    <div className="sf-panel sf-slot-list">
      {label && <h3>{label}</h3>}
      {slots.length ? (
        slots.map((slot) => (
          <button key={slot.id} className="sf-slot" onClick={() => open(slot)}>
            <span className="sf-date-box">
              <b>{new Date(slot.entryDate + "T12:00:00Z").getUTCDate()}</b>
              <span>
                {new Date(slot.entryDate + "T12:00:00Z").toLocaleDateString(
                  "en-US",
                  { month: "short", timeZone: "UTC" },
                )}
              </span>
            </span>
            <span className="sf-slot-copy">
              <strong>
                {slot.role}
                {Boolean(slot.isExtra) && (
                  <span className="sf-badge">Extra</span>
                )}
              </strong>
              <span>
                {scheduleDayLabel(slot.entryDate)} · {scheduleSpan(slot)}
              </span>
              <span>
                {slot.status === "open"
                  ? "Open position"
                  : slot.employeeName ||
                    data.employees.find((e) => e.id === slot.employeeId)
                      ?.name ||
                    "Saved employee assignment"}
                {slot.staffingReason ? " · " + slot.staffingReason : ""}
              </span>
            </span>
            <span
              className={
                slot.status === "open" ? "sf-open-label" : "sf-edit-label"
              }
            >
              {admin
                ? slot.status === "open"
                  ? "Assign +"
                  : "Manage →"
                : "View →"}
            </span>
          </button>
        ))
      ) : (
        <p className="sf-empty-inline">
          No saved {admin ? "positions" : "shifts"} for this selection.
        </p>
      )}
    </div>
  );
}
function PagedSlots({
  data,
  slots,
  open,
}: {
  data: LiveSchedule;
  slots: ScheduleSlot[];
  open: (slot: ScheduleSlot) => void;
}) {
  const [limit, setLimit] = useState(8);
  return (
    <>
      <SlotList data={data} slots={slots.slice(0, limit)} open={open} />
      {slots.length > limit && (
        <button
          className="sf-more sf-secondary"
          onClick={() => setLimit((n) => n + 12)}
        >
          Show more shifts ({slots.length - limit})
        </button>
      )}
    </>
  );
}
function ScheduleCalendar({
  data,
  date,
  month,
  setMonth,
  setDate,
  employeeId,
}: {
  data: LiveSchedule;
  date: string;
  month: string;
  setMonth: (month: string) => void;
  setDate: (date: string) => void;
  employeeId: string;
}) {
  if (!month) return null;
  const first = month + "-01",
    weekday = new Date(first + "T12:00:00Z").getUTCDay();
  const count = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5)),
    0,
  ).getDate();
  const shiftMonth = (n: number) => {
    const d = new Date(first + "T12:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + n);
    setMonth(d.toISOString().slice(0, 7));
  };
  return (
    <div className="sf-panel sf-calendar">
      <div className="sf-calendar-heading">
        <button aria-label="Previous month" onClick={() => shiftMonth(-1)}>
          ←
        </button>
        <h3>
          {new Date(first + "T12:00:00Z").toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })}
        </h3>
        <button aria-label="Next month" onClick={() => shiftMonth(1)}>
          →
        </button>
      </div>
      <div className="sf-weekdays">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="sf-calendar-grid">
        {Array.from({ length: weekday }, (_, i) => (
          <span key={"pad" + i} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const day = scheduleDateOffset(first, i);
          const slots = data.slots.filter(
            (s) =>
              s.entryDate === day &&
              (!employeeId || s.employeeId === employeeId),
          );
          const open = slots.filter((s) => s.status === "open").length;
          return (
            <button
              key={day}
              aria-pressed={day === date}
              aria-label={`${scheduleDayLabel(day, true)}, ${slots.length} positions${open ? `, ${open} open` : ""}`}
              className={day === data.today ? "sf-today" : ""}
              onClick={() => setDate(day)}
            >
              <b>{i + 1}</b>
              <span>
                {slots.length
                  ? employeeId
                    ? `${slots.length} shift${slots.length > 1 ? "s" : ""}`
                    : open
                      ? `${open} open`
                      : "Staffed"
                  : "—"}
              </span>
            </button>
          );
        })}
      </div>
      <p className="sf-sync">
        Select a date to see saved positions. All times Central.
      </p>
    </div>
  );
}
function Coverage({
  data,
  employeeId,
  now,
  offers,
  disabled,
  open,
}: {
  data: LiveSchedule;
  employeeId: string;
  now: Date;
  offers: ScheduleTrade[];
  disabled: boolean;
  open: (dialog: ScheduleDialogState) => void;
}) {
  const [kind, setKind] = useState("all"),
    [role, setRole] = useState(""),
    [from, setFrom] = useState(data.today),
    [through, setThrough] = useState(scheduleDateOffset(data.today, 29)),
    [limit, setLimit] = useState(16);
  const seats = openScheduleSeats(data, employeeId, now, 366).filter(
    (s) =>
      s.entryDate >= from &&
      s.entryDate <= through &&
      (!role || s.role === role),
  );
  const trades = offers.filter((t) => {
    const s = data.slots.find((s) => s.id === t.slotId);
    return (
      s &&
      s.entryDate >= from &&
      s.entryDate <= through &&
      (!role || s.role === role)
    );
  });
  const rows = [
    ...(kind === "open"
      ? []
      : trades.map((trade) => ({
          slot: data.slots.find((s) => s.id === trade.slotId)!,
          trade,
        }))),
    ...(kind === "trade" ? [] : seats.map((slot) => ({ slot, trade: null }))),
  ].sort((a, b) => slotOrder(a.slot, b.slot));
  return (
    <>
      <div className="sf-section-heading">
        <div>
          <h3>Find your next shift</h3>
          <p>
            Positions you are cleared to work. The server checks current
            availability and conflicts when you submit.
          </p>
        </div>
      </div>
      <div className="sf-panel sf-filters">
        <label>
          Show
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setLimit(16);
            }}
          >
            <option value="all">Trades & open shifts</option>
            <option value="trade">Trade offers</option>
            <option value="open">Open shifts</option>
          </select>
        </label>
        <label>
          Position
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setLimit(16);
            }}
          >
            <option value="">All my positions</option>
            {(data.dayPositionRoles || data.roles).map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setLimit(16);
            }}
          />
        </label>
        <label>
          Through
          <input
            type="date"
            value={through}
            onChange={(e) => {
              setThrough(e.target.value);
              setLimit(16);
            }}
          />
        </label>
      </div>
      <p className="sf-sync">
        {rows.length} matching{" "}
        {rows.length === 1 ? "opportunity" : "opportunities"} · Requests require
        approval before the schedule changes.
      </p>
      <div className="sf-coverage-grid">
        {rows.slice(0, limit).map(({ slot, trade }) => {
          const requested =
            !trade &&
            data.claims.some(
              (c) =>
                c.slotId === slot.id &&
                c.employeeId === employeeId &&
                c.status === "pending",
            );
          return (
            <article
              key={trade?.id || slot.id}
              className="sf-panel sf-coverage-card"
            >
              <div>
                <span className={`sf-badge ${trade ? "sf-gold" : "sf-warn"}`}>
                  {trade
                    ? trade.returnSlotId
                      ? "Swap"
                      : "Trade offer"
                    : "Open shift"}
                </span>
                <span>{scheduleDayLabel(slot.entryDate)}</span>
              </div>
              <h3>{slot.role}</h3>
              <strong>{scheduleSpan(slot)}</strong>
              <p>
                {trade
                  ? `Offered by ${trade.fromEmployeeName}`
                  : data.shiftTypes.find((t) => t.id === slot.shiftTypeId)
                      ?.name}
                {slot.staffingReason ? " · " + slot.staffingReason : ""}
              </p>
              {trade?.note && <p className="sf-note">{trade.note}</p>}
              <button
                disabled={disabled || requested}
                onClick={() =>
                  open(
                    trade
                      ? { kind: "accept", trade, slot }
                      : { kind: "claim", slot },
                  )
                }
              >
                {requested
                  ? "Request pending"
                  : trade
                    ? "Review trade →"
                    : "Request shift →"}
              </button>
            </article>
          );
        })}
      </div>
      {rows.length === 0 && (
        <Empty
          title="No matching coverage"
          text="Try another date range or position. New eligible offers will appear here."
        />
      )}
      {rows.length > limit && (
        <button
          className="sf-more sf-secondary"
          onClick={() => setLimit((n) => n + 16)}
        >
          Show more ({rows.length - limit})
        </button>
      )}
    </>
  );
}
function RequestList({
  data,
  requests,
  open,
  reviewQueue = false,
}: {
  data: LiveSchedule;
  requests: WorkspaceRequest[];
  open: (state: ScheduleDialogState) => void;
  reviewQueue?: boolean;
}) {
  const [filter, setFilter] = useState(reviewQueue ? "pending" : "active"),
    [limit, setLimit] = useState(20);
  const rows = requests
    .filter(
      (r) =>
        filter === "all" ||
        (filter === "active"
          ? ["offered", "pending"].includes(r.status)
          : r.status === filter),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <div className="sf-toolbar">
        <div className="sf-segment">
          {(reviewQueue
            ? [
                ["pending", "Needs review"],
                ["offered", "Waiting"],
              ]
            : [["active", "Active"]]
          ).map(([id, label]) => (
            <button
              key={id}
              aria-pressed={filter === id}
              onClick={() => {
                setFilter(id);
                setLimit(20);
              }}
            >
              {label}
            </button>
          ))}
          <button
            aria-pressed={filter === "all"}
            onClick={() => {
              setFilter("all");
              setLimit(20);
            }}
          >
            All requests
          </button>
        </div>
      </div>
      <div className="sf-panel">
        {rows.slice(0, limit).map((r) => (
          <button
            className="sf-request"
            key={r.kind + r.id}
            onClick={() => open({ kind: "review", request: r })}
          >
            <span>
              <strong>
                {r.kind === "trade"
                  ? r.trade?.returnSlotId
                    ? "Shift swap"
                    : "Trade offer"
                  : r.kind === "claim"
                    ? "Shift request"
                    : "Time off"}
              </strong>
              <span>
                {r.name} · {r.date ? scheduleDayLabel(r.date) : "Saved request"}
                {r.slotId
                  ? " · " +
                    (data.slots.find((s) => s.id === r.slotId)?.role ||
                      r.trade?.role ||
                      r.claim?.role ||
                      "Saved position")
                  : ""}
              </span>
            </span>
            <span
              className={`sf-badge ${r.status === "approved" ? "sf-good" : r.status === "denied" ? "sf-bad" : "sf-gold"}`}
            >
              {r.status === "offered"
                ? "Awaiting acceptance"
                : r.status === "pending"
                  ? "Needs review"
                  : r.status}
            </span>
          </button>
        ))}
        {!rows.length && (
          <p className="sf-empty-inline">
            No {filter === "active" ? "active " : ""}requests.
          </p>
        )}
      </div>
      {rows.length > limit && (
        <button
          className="sf-secondary sf-more"
          onClick={() => setLimit((n) => n + 20)}
        >
          Show more requests
        </button>
      )}
    </>
  );
}
function Approvals({
  data,
  requests,
  open,
}: {
  data: LiveSchedule;
  requests: WorkspaceRequest[];
  open: (state: ScheduleDialogState) => void;
}) {
  const ready = requests.filter((r) => r.status === "pending"),
    waiting = requests.filter((r) => r.status === "offered");
  return (
    <>
      <div className="sf-section-heading">
        <div>
          <h3>Review requests</h3>
          <p>
            {ready.length} ready for review · {waiting.length} trades awaiting a
            member’s acceptance
          </p>
        </div>
      </div>
      <RequestList data={data} requests={requests} open={open} reviewQueue />
      <p className="sf-sync">
        Trades become ready for approval after a qualified member accepts. Final
        approval updates the saved assignments.
      </p>
    </>
  );
}
function AvailabilityList({
  data,
  employeeId,
  disabled,
  act,
  open,
  review,
}: {
  data: LiveSchedule;
  employeeId: string;
  disabled: boolean;
  act: Action;
  open: (state: ScheduleDialogState) => void;
  review: { month: string; query: string; version: number } | null;
}) {
  const rows = data.availability
    .filter(a => a.employeeId === employeeId);
  return (
    <div className="sf-panel sf-tools">
      <SavedAvailabilityList key={`${employeeId}:${review?.version || 0}`} entries={rows} memberName="Your saved availability" month={review?.month || data.today.slice(0, 7)} initialQuery={review?.query || ''} today={data.today} busy={disabled}
        onEdit={availability => open({ kind: 'request', availability })}
        onRemove={availability => { void act({ action: "deleteAvailability", date: availability.availabilityDate }); }} />
    </div>
  );
}
function People({ data }: { data: LiveSchedule }) {
  const [query, setQuery] = useState("");
  const rows = data.employees.filter((e) =>
    `${e.name} ${e.rank} ${scheduleRoles(e).join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="sf-section-heading">
        <div>
          <h3>People & clearances</h3>
          <p>
            {data.employees.length} active scheduling employees. Qualifications
            come from your saved employee records.
          </p>
        </div>
        <a
          className="sf-button sf-secondary"
          href="?display=portal&page=employees"
        >
          Edit employees →
        </a>
      </div>
      <label className="sf-search">
        Find a member
        <input
          type="search"
          placeholder="Name, rank, or position"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="sf-people">
        {rows.map((e) => (
          <article className="sf-panel sf-person" key={e.id}>
            <span className="sf-avatar" aria-hidden>
              {e.name
                .split(/[ ,]+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((n) => n[0])
                .join("")}
            </span>
            <div>
              <h3>{e.name}</h3>
              <p>{e.rank}</p>
              <div className="sf-chips">
                {scheduleRoles(e).map((role) => (
                  <span className="sf-badge" key={role}>
                    {role}
                  </span>
                ))}
                {!scheduleRoles(e).length && (
                  <span className="sf-badge">General extra positions only</span>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {!rows.length && (
        <Empty
          title="No matching employees"
          text="Try a different name or position."
        />
      )}
    </>
  );
}
