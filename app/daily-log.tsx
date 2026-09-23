"use client";
import { fleetChecksForShift } from "./fleet-check-shift";
import { parseSavedTime, savedTimeLabel } from "./workflow-status";
import { requestDailyLogSave } from "./daily-log-save-request";
import DailyLogRecoveryReview from "./daily-log-recovery-review";
import { backupLogRecovery, logDifferences, logSnapshot, type LogSnapshot } from "./daily-log-recovery";
import { SaveStatus } from "./save-status";
import { useWorkspaceViewState } from "./workspace-view-state";
import { CALLBACK_QUALIFYING_CALL_TYPES } from "./callback-rules";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { holidayForDate } from "./holidays";
import ConfirmDialog from "./confirm-dialog";
import DailyLogNotes from "./daily-log-notes";
import { callIsComplete, currentLogShift, readLogNotes } from "./daily-log-workflow";
import { confirmLeavingWork, useUnsavedWork } from "./use-unsaved-work";
import "./daily-log.css";
import { RecordCredibility, type Revision } from "./record-credibility";
import { compareEmployeeNames, formatEmployeeName } from "./employee-names";
import { formatMilitaryTime, normalizeMilitaryTime } from "./military-time";
import {
  chicagoOperationalContext,
  dailyLogDateIsAutoLocked,
} from "./operational-day";

type LogEmployee = {
  id: string;
  name: string;
  rank: string;
  startDate?: string | null;
  endDate?: string | null;
};
type StaffingRow = {
  id: string;
  shiftKey: string;
  employeeId: string;
  timeIn: string;
  timeOut: string;
  actingOfficer: boolean;
};
type CallRow = {
  id: string;
  reportNumber: string;
  timeOut: string;
  timeIn: string;
  respondingUnits: string;
  address: string;
  callType: string;
};
type Approval = {
  shiftKey: string;
  signInOfficerId?: string;
  signInAt?: string;
  signOutOfficerId?: string;
  signOutAt?: string;
  signOutNote?: string;
  fleetDutiesAcknowledged?: number;
};
type RecentNote = { logDate: string; note: string };
type ApparatusCheck = {
  id: string;
  apparatusId: string;
  unit: string;
  checkType: string;
  completedAt: string;
  completedBy: string;
  failedItems: number;
};
type RequiredFleetCheck = {
  apparatusId: string;
  unit: string;
  checkType: "daily" | "weekly" | "inventory" | "air_pack";
  status: "pending" | "in_progress";
  startedAt: string | null;
  startTime: string;
  endTime: string;
};
type CallbackEmployee = {
  employeeId: string;
  employeeName: string;
  rank: string;
  onDuty: boolean;
  evaluation: {
    matches: string[];
    flags: string[];
    suggestedHours: number;
    automaticallyQualifies: boolean;
  };
};
type CallbackSubmission = {
  id: string;
  employeeId: string;
  employeeName: string;
  status: string;
};
type CallbackPayload = {
  eligibleEmployees: CallbackEmployee[];
  submissions: CallbackSubmission[];
  setting?: { reviewerName: string; reviewerRank: string };
  error?: string;
};
type LogPayload = {
  log: {
    shiftNotes: string;
    locked: number;
    adminUnlocked: number;
    createdBy?: string;
    createdAt?: string;
    updatedBy?: string;
    updatedAt: string;
    saveVersion: number;
    lockedBy?: string;
    lockedAt?: string;
    revisions?: Revision[];
  };
  staffing: StaffingRow[];
  staffingSource?: "department_schedule" | "daily_log";
  schedulePrefilled?: boolean;
  calls: CallRow[];
  approvals: Approval[];
  recentNotes: RecentNote[];
  addresses: string[];
  apparatusChecks?: ApparatusCheck[];
  apparatusChecksAvailable?: boolean;
  fleetVerificationAvailable?: boolean;
  incompleteFleetChecks?: RequiredFleetCheck[];
  canUnlock?: boolean;
  error?: string;
};
type Handoff = { shiftKey: string; shiftTitle: string; mode: "in" | "out" };
type OfflineDraft = {
  expectedVersion?: number;
  savedAt: string;
  logDate: string;
  staffing: StaffingRow[];
  calls: CallRow[];
  shiftNotes: string;
};
const draftKey = (date: string) => `sfd-daily-log-draft:${date}`;

const shiftSections = [
  {
    key: "morning",
    title: "6:00 AM – Noon",
    defaultIn: "06:00",
    defaultOut: "12:00",
  },
  {
    key: "afternoon",
    title: "Noon – 6:00 PM",
    defaultIn: "12:00",
    defaultOut: "18:00",
  },
  {
    key: "overnight",
    title: "6:00 PM – 6:00 AM",
    defaultIn: "18:00",
    defaultOut: "06:00",
  },
];
const equipmentItems = [
  {
    key: "knox",
    name: "Knox Box keys",
    detail: "Verify all Knox Box keys are in place.",
  },
  {
    key: "radios",
    name: "Portable radios",
    detail: "Units 1201, 1203, 1204, 1205, and 1207",
  },
  { key: "phones", name: "Cell phones", detail: "Units 1203, 1205, and 1207" },
  {
    key: "tics",
    name: "Thermal imaging cameras",
    detail: "Units 1201, 1203, and 1204",
  },
  {
    key: "sensit",
    name: "Sensit gas detectors",
    detail: "Units 1203 and 1204",
  },
];
const callTypes = [...new Set([
  "Fire",
  "EMS",
  "MVA",
  "TRT",
  "HazMat",
  "Auto Aid",
  "Mutual Aid",
  "Hazardous Condition",
  "Special",
  ...CALLBACK_QUALIFYING_CALL_TYPES,
])];
const timeOptions = Array.from({ length: 96 }, (_, index) => {
  const hours = Math.floor(index / 4),
    minutes = (index % 4) * 15;
  const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return {
    value,
    label: `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`,
  };
});
const cleanEquipment = () =>
  Object.fromEntries(
    equipmentItems.map((item) => [item.key, { status: "Present", detail: "" }]),
  ) as Record<string, { status: string; detail: string }>;

function nowTime() {
  const { minutes } = chicagoOperationalContext();
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
function clientId() {
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
function blankStaff(
  shiftKey: string,
  timeIn: string,
  timeOut: string,
  actingOfficer = false,
): StaffingRow {
  return {
    id: clientId(),
    shiftKey,
    employeeId: "",
    timeIn,
    timeOut,
    actingOfficer,
  };
}
function blankCall(): CallRow {
  return {
    id: clientId(),
    reportNumber: "",
    timeOut: "",
    timeIn: "",
    respondingUnits: "",
    address: "",
    callType: "EMS",
  };
}
const displayName = formatEmployeeName;
function shiftMinutes(value: string, shiftKey: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const total = hours * 60 + minutes;
  return shiftKey === "overnight" && total <= 360 ? total + 1440 : total;
}
const fleetCheckList = (checks: RequiredFleetCheck[]) =>
  checks.map((check) => `${check.unit} ${check.checkType.replaceAll("_", " ")} (${check.startTime}–${check.endTime})`).join(", ");

function CallbackPanel({ call, logDate }: { call: CallRow; logDate: string }) {
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<CallbackPayload | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    setMessage("Loading callback members and rules...");
    const response = await fetch(
      `/api/callbacks?date=${encodeURIComponent(logDate)}&callId=${encodeURIComponent(call.id)}`,
      { cache: "no-store" },
    );
    const next = (await response.json()) as Partial<CallbackPayload>;
    setPayload({
      eligibleEmployees: next.eligibleEmployees ?? [],
      submissions: next.submissions ?? [],
      setting: next.setting,
      error: next.error,
    });
    setMessage(
      response.ok ? "" : (next.error ?? "Unable to load callback attendance."),
    );
  }, [call.id, logDate]);
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => { void load().catch(() => setMessage("Unable to load members. Close and reopen this panel to retry.")); }, 0);
    return () => window.clearTimeout(timer);
  }, [load, open]);
  async function submit() {
    if (submittingRef.current || !selected.length) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
    setMessage("Submitting...");
    const response = await fetch("/api/callbacks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "submit",
        logDate,
        callId: call.id,
        employeeIds: selected,
      }),
    });
    const result = (await response.json()) as {
      error?: string;
      reviewer?: { reviewerName: string };
      submitted?: number;
      alreadySubmitted?: number;
    };
    if (response.ok) {
      setOpen(false);
      setSelected([]);
      await load().catch(() => undefined);
      setMessage(
        result.submitted === 0
          ? "These members were already submitted. No duplicate attendance was added."
          : `${result.submitted ?? selected.length} submitted to ${result.reviewer?.reviewerName ? displayName(result.reviewer.reviewerName) : "the callback reviewer"} · awaiting approval.${result.alreadySubmitted ? ` ${result.alreadySubmitted} already on file.` : ""}`,
      );
    } else {
      setMessage(result.error ?? "Unable to submit callback attendance.");
    }
    } catch {
      setMessage("Submission could not be confirmed. Your selections are retained. Retry safely; existing call/member submissions will not be duplicated.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }
  return (
    <div className="call-callback">
      <button
        type="button"
        className={open ? "callback-toggle open" : "callback-toggle"}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        Callback attendance
        {payload?.submissions.length ? ` · ${payload.submissions.length}` : ""}
      </button>
      {!open && message && <p className="callback-message" role="status">{message}</p>}
      {open && (
        <div className="callback-panel">
          <div>
            <strong>Select members on this call</strong>
            <p>
              Active members who were not already on duty at {formatMilitaryTime(call.timeOut) || "the recorded call time"} are listed.
            </p>
          </div>
          {payload?.submissions.length ? (
            <div className="callback-existing">
              {payload.submissions.map((item) => (
                <span key={item.id}>
                  {displayName(item.employeeName)} · {item.status}
                </span>
              ))}
            </div>
          ) : null}
          {payload &&
            !payload.error &&
            payload.eligibleEmployees.length === 0 && (
              <p className="helper-note">
                No off-duty active members are available for this call.
              </p>
            )}
          <label className="callback-search">Find a member
            <input type="search" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search by name…" />
          </label>
          <p role="status">{selected.length} selected · Selections stay selected while searching.</p>
          <div className="callback-selected">{selected.map((id) => <button type="button" key={id} disabled={submitting} onClick={() => setSelected((current) => current.filter((item) => item !== id))}>Remove {displayName(payload?.eligibleEmployees.find((employee) => employee.employeeId === id)?.employeeName || id)} ×</button>)}</div>
          <div className="callback-employee-list">
            {payload?.eligibleEmployees
              .filter(
                (employee) =>
                  !payload.submissions.some(
                    (submission) =>
                      submission.employeeId === employee.employeeId,
                  ) && displayName(employee.employeeName).toLowerCase().includes(memberSearch.trim().toLowerCase()),
              )
              .map((employee) => (
                <label key={employee.employeeId}>
                  <input
                    type="checkbox"
                    disabled={submitting}
                    checked={selected.includes(employee.employeeId)}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, employee.employeeId]
                          : current.filter((id) => id !== employee.employeeId),
                      )
                    }
                  />
                  <span>
                    <strong>{displayName(employee.employeeName)}</strong>
                    <small>{employee.rank} · {employee.evaluation.suggestedHours.toFixed(2)} hr suggested</small>
                    {employee.evaluation.matches.length > 0 && <small className="callback-qualifies">Qualifies: {employee.evaluation.matches.join("; ")}</small>}
                    {employee.evaluation.flags.length > 0 && <small className="callback-employee-flag">Flag: {employee.evaluation.flags.join(" ")}</small>}
                  </span>
                </label>
              ))}
          </div>
          {payload?.setting && (
            <p className="callback-reviewer">
              Review submission: {payload.setting.reviewerRank}{" "}
              {displayName(payload.setting.reviewerName)}
            </p>
          )}
          {message && (
            <p className="callback-message" role="status">
              {message}
            </p>
          )}
          <div className="callback-submit-bar"><button
            type="button"
            className="primary-action compact"
            disabled={submitting || !selected.length}
            onClick={() => void submit()}
          >
            {submitting ? "Submitting…" : `Submit Callback Attendance${selected.length ? ` (${selected.length})` : ""}`}
          </button></div>
        </div>
      )}
    </div>
  );
}

export default function DailyLog({
  employees,
  onPayrollSynced,
}: {
  employees: LogEmployee[];
  onPayrollSynced?: () => void;
  onHome?: () => void;
}) {
  const [logDate, setLogDate] = useWorkspaceViewState("daily-log-date",
    () => chicagoOperationalContext().operationalDate,
  );
  const [staffing, setStaffing] = useState<StaffingRow[]>([]);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [shiftNotes, setShiftNotes] = useState("");
  const [addresses, setAddresses] = useState<string[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [recentNotes, setRecentNotes] = useState<RecentNote[]>([]);
  const [apparatusChecks, setApparatusChecks] = useState<ApparatusCheck[]>([]);
  const [apparatusChecksAvailable, setApparatusChecksAvailable] = useState(false);
  const [checksRefreshing, setChecksRefreshing] = useState(false);
  const [expandedShifts, setExpandedShifts] = useState<string[]>(() => [currentLogShift()]);
  const [editingCalls, setEditingCalls] = useState<string[]>([]);
  const [removeCall, setRemoveCall] = useState<CallRow | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [deviceDraftSaved, setDeviceDraftSaved] = useState(false);
  const [incompleteFleetChecks, setIncompleteFleetChecks] = useState<
    RequiredFleetCheck[]
  >([]);
  const [fleetVerificationAvailable, setFleetVerificationAvailable] =
    useState(false);
  const [locked, setLocked] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [canUnlock, setCanUnlock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const loadRequest = useRef(0);
  const [saving, setSaving] = useState(false);
  const [saveSlow, setSaveSlow] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [handoffSaving, setHandoffSaving] = useState(false);
  const [handoffError, setHandoffError] = useState("");
  const handoffPending = useRef(false);
  const [officerId, setOfficerId] = useState("");
  const [equipment, setEquipment] = useState(cleanEquipment);
  const [handoffNote, setHandoffNote] = useState("");
  const [acceptedNotes, setAcceptedNotes] = useState(false);
  const [acceptedFleetDuties, setAcceptedFleetDuties] = useState(false);
  const [unlockConfirmOpen, setUnlockConfirmOpen] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [logAudit, setLogAudit] = useState<LogPayload["log"] | null>(null);
  const [schedulePrefilled, setSchedulePrefilled] = useState(false);
  const loaded = useRef(false);
  const currentDay = useRef(chicagoOperationalContext().operationalDate);
  const saveInFlight = useRef(false);
  const saveAgain = useRef(false);
  const saveRetryRequired = useRef(false);
  const autosaveAuthorized = useRef(false);
  const editVersion = useRef(0);
  const savedVersions = useRef(new Map<string, number | undefined>());
  const [saveConflict, setSaveConflict] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [recoveryReview, setRecoveryReview] = useState<{ date: string; request: number; draft: LogSnapshot; draftVersion: number | undefined; server: LogPayload; saved: LogSnapshot } | null>(null);
  const latestSave = useRef({ logDate, staffing, calls, shiftNotes });
  const readOnly = loading || loadError || loadedDate !== logDate || (locked && !adminUnlocked) || saveConflict;
  useUnsavedWork(dirty, saving || handoffSaving);
  const holiday = useMemo(() => holidayForDate(logDate), [logDate]);
  useEffect(() => {
    latestSave.current = { logDate, staffing, calls, shiftNotes };
  }, [calls, logDate, shiftNotes, staffing]);

  const loadLog = useCallback(async (date: string) => {
    const request = ++loadRequest.current;
    setLoading(true);
    setLoadError(false);
    setLoadedDate(null);
    setLastSynced(null);
    setMessage("");
    setSaveError(false);
    setDeviceDraftSaved(false);
    saveRetryRequired.current = false;
    setEditingCalls([]);
    setRemoveCall(null);
    setRecoveryReview(null);
    loaded.current = false;
    autosaveAuthorized.current = false;
    try {
      const response = await fetch(`/api/logbook?date=${date}`);
      const data = (await response.json()) as LogPayload;
      if (request !== loadRequest.current) return;
      if (!response.ok) throw new Error(data.error || "Unable to load log");
      const stored = window.localStorage.getItem(draftKey(date));
      const draft = stored ? (JSON.parse(stored) as OfflineDraft) : null;
      const updatedAt = data.log?.updatedAt;
      const serverUpdatedAt = parseSavedTime(updatedAt);
      // An older draft can contain unsaved work even if someone saved later.
      // Compare actual content rather than trusting either device's clock.
      const serverSnapshot = { staffing: data.staffing, calls: data.calls, shiftNotes: data.log?.shiftNotes ?? "" };
      const restore = Boolean(draft && logDifferences(draft, serverSnapshot).length);
      if (draft && !restore) {
        // A confirmed matching copy is no longer pending. Do not let it
        // reappear as a conflict after somebody makes a later valid edit.
        try { if (window.localStorage.getItem(draftKey(date)) === stored) window.localStorage.removeItem(draftKey(date)); } catch { /* Matching data is already on the server. */ }
      }
      const conflict = Boolean(restore && draft?.expectedVersion !== data.log?.saveVersion);
      savedVersions.current.set(date, restore ? draft?.expectedVersion : data.log?.saveVersion);
      setSaveConflict(conflict);
      const rows = (restore ? draft!.staffing : data.staffing).map((row) => ({
        ...row,
        actingOfficer: Boolean(row.actingOfficer),
      }));
      const callRows = [...(restore ? draft!.calls : data.calls)];
      setStaffing(rows);
      setCalls(callRows);
      setShiftNotes(restore ? draft!.shiftNotes : (data.log?.shiftNotes ?? ""));
      setLogAudit(data.log ?? null);
      setAddresses(data.addresses ?? []);
      setApprovals(data.approvals ?? []);
      setRecentNotes(data.recentNotes ?? []);
      setApparatusChecks(data.apparatusChecks ?? []);
      setApparatusChecksAvailable(Boolean(data.apparatusChecksAvailable));
      setIncompleteFleetChecks(data.incompleteFleetChecks ?? []);
      setFleetVerificationAvailable(Boolean(data.fleetVerificationAvailable));
      const serverLocked = Boolean(data.log?.locked),
        serverUnlocked = Boolean(data.log?.adminUnlocked);
      autosaveAuthorized.current = (!serverLocked || serverUnlocked) && !conflict;
      setLocked(serverLocked);
      setAdminUnlocked(serverUnlocked);
      setCanUnlock(Boolean(data.canUnlock));
      setDirty(restore);
      setDeviceDraftSaved(restore);
      setSchedulePrefilled(!restore && Boolean(data.schedulePrefilled));
      if (restore) setMessage("Unsaved work restored from this device");
      if (conflict) setMessage("Your draft and the saved log differ. Review the changes below to resume editing.");
      setLastSynced(serverUpdatedAt);
      setLoadedDate(date);
      window.setTimeout(() => {
        if (request === loadRequest.current) loaded.current = true;
      }, 0);
    } catch (error) {
      if (request !== loadRequest.current) return;
      setLoadError(true);
      setSchedulePrefilled(false);
      // Keep any device draft untouched until server access and version are verified.
      setMessage(error instanceof Error ? error.message : "Unable to load log");
    } finally {
      if (request === loadRequest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let collapsed: HTMLDetailsElement[] = [];
    const beforePrint = () => {
      collapsed = Array.from(document.querySelectorAll<HTMLDetailsElement>(".logbook-page .shift-card:not([open])"));
      collapsed.forEach(section => { section.open = true; });
    };
    const afterPrint = () => { collapsed.forEach(section => { section.open = false; }); collapsed = []; };
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => { afterPrint(); window.removeEventListener("beforeprint", beforePrint); window.removeEventListener("afterprint", afterPrint); };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLog(logDate);
    }, 0);
    return () => { window.clearTimeout(timer); loadRequest.current += 1; };
  }, [loadLog, logDate]);
  useEffect(() => {
    const retryAfterUnlock = () => { if (!loaded.current) void loadLog(logDate); };
    window.addEventListener("firehouse:session-unlocked", retryAfterUnlock);
    return () => window.removeEventListener("firehouse:session-unlocked", retryAfterUnlock);
  }, [loadLog, logDate]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const operationalDate = chicagoOperationalContext().operationalDate;
      if (operationalDate !== currentDay.current && !dirty && !saveInFlight.current && confirmLeavingWork()) {
        currentDay.current = operationalDate;
        setLogDate(operationalDate);
      } else if (!dirty && !saveInFlight.current && !locked && dailyLogDateIsAutoLocked(logDate)) {
        void loadLog(logDate);
      }
    }, 30000);
    return () => window.clearInterval(timer);
  }, [dirty, loadLog, locked, logDate, setLogDate]);
  useEffect(() => {
    const update = () => {
      setIsOnline(window.navigator.onLine);
      if (window.navigator.onLine) saveRetryRequired.current = false;
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const saveLog = useCallback(
    async (silent = false) => {
      if (!loaded.current || !autosaveAuthorized.current) return;
      // A second click or debounce timer is not another edit. The running
      // save checks editVersion before deciding whether another save is needed.
      if (saveInFlight.current) return;
      const dateAtStart = latestSave.current.logDate;
      const loadAtStart = loadRequest.current;
      const isCurrentSave = () => latestSave.current.logDate === dateAtStart && loadRequest.current === loadAtStart;
      saveInFlight.current = true;
      setSaving(true);
      setSaveSlow(false);
      setSaveError(false);
      saveRetryRequired.current = false;
      // Schedule confirmation also needs unsaved-work and offline protection.
      setDirty(true);
      if (!silent) setMessage("");
      let confirmed = false;
      try {
        do {
          saveAgain.current = false;
          const current = latestSave.current;
          const versionAtStart = editVersion.current;
          const payload = {
            expectedVersion: savedVersions.current.get(current.logDate),
            logDate: current.logDate,
            staffing: current.staffing.filter((row) => row.employeeId),
            calls: current.calls.filter((row) =>
              Object.entries(row).some(
                ([key, value]) => key !== "id" && value && value !== "EMS",
              ),
            ),
            shiftNotes: current.shiftNotes,
          };
          try { window.localStorage.setItem(
            draftKey(current.logDate),
            JSON.stringify({ ...payload, savedAt: new Date().toISOString() }),
          ); setDeviceDraftSaved(true); } catch { setDeviceDraftSaved(false); }
          if (!window.navigator.onLine) {
            setMessage("Offline · keep this page open until syncing is confirmed");
            return;
          }
          const { response, result } = await requestDailyLogSave(payload, () => {
            if (isCurrentSave()) setSaveSlow(true);
          });
          if (!isCurrentSave()) return;
          setSaveSlow(false);
          if (response.status === 409) {
            autosaveAuthorized.current = false;
            setSaveConflict(true);
            try { window.localStorage.setItem(draftKey(current.logDate), JSON.stringify({ ...latestSave.current, expectedVersion: payload.expectedVersion, savedAt: new Date().toISOString() })); } catch { setDeviceDraftSaved(false); }
          }
          if (!response.ok)
            throw new Error(result.error || "Unable to save log");
          if (!Number.isSafeInteger(result.saveVersion) || result.saveVersion! < 0)
            throw new Error("The server did not confirm a saved version. Keep this page open and retry.");
          savedVersions.current.set(current.logDate, result.saveVersion);
          setSchedulePrefilled(false);
          saveAgain.current = versionAtStart !== editVersion.current;
          if (!saveAgain.current) {
            try { window.localStorage.removeItem(draftKey(current.logDate)); } catch { /* The server save is still confirmed. */ }
            setDirty(false);
            setDeviceDraftSaved(false);
          } else {
            // New edits must reference the just-confirmed version, even if the
            // connection disappears before their follow-up save can run.
            try { window.localStorage.setItem(draftKey(current.logDate), JSON.stringify({ ...latestSave.current, expectedVersion: result.saveVersion, savedAt: new Date().toISOString() })); setDeviceDraftSaved(true); } catch { setDeviceDraftSaved(false); }
          }
          setLastSynced(new Date());
        } while (
          saveAgain.current &&
          window.navigator.onLine &&
          autosaveAuthorized.current
        );
        if (saveAgain.current) {
          setMessage("Newer changes are waiting to sync. Keep this page open until saving is confirmed.");
          return;
        }
        confirmed = true;
        setMessage(
          silent
            ? "All changes saved · Timesheets updated"
            : "Daily log and timesheets saved",
        );
      } catch (error) {
        if (!isCurrentSave()) return;
        saveRetryRequired.current = true;
        setSaveError(true);
        setMessage(
          error instanceof Error ? error.message : "Unable to save log",
        );
      } finally {
        saveInFlight.current = false;
        setSaving(false);
        setSaveSlow(false);
      }
      // A payroll-screen refresh cannot turn a confirmed log save into an error.
      if (confirmed) onPayrollSynced?.();
    },
    [onPayrollSynced],
  );
  useEffect(() => {
    if (!dirty || readOnly) return;
    const timer = window.setTimeout(() => {
      // A failed request waits for Retry, a new edit, or reconnection. A local
      // recovery-storage failure must NOT stop the server save from running.
      if (!saveRetryRequired.current) void saveLog(true);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [calls, dirty, isOnline, readOnly, saveLog, shiftNotes, staffing]);
  useEffect(() => {
    if (!dirty || readOnly) return;
    const timer = window.setTimeout(() => { try { window.localStorage.setItem(
      draftKey(logDate),
      JSON.stringify({
        savedAt: new Date().toISOString(),
        expectedVersion: savedVersions.current.get(logDate),
        logDate,
        staffing: staffing.filter((row) => row.employeeId),
        calls,
        shiftNotes,
      }),
    ); setDeviceDraftSaved(true); } catch { setDeviceDraftSaved(false); setSaveError(true); setMessage("This device could not keep a recovery draft. Keep this page open until the server save succeeds."); } }, 0);
    return () => window.clearTimeout(timer);
  }, [calls, dirty, logDate, readOnly, shiftNotes, staffing]);

  const activeEmployees = useMemo(
    () =>
      employees
        .filter(
          (employee) =>
            (!employee.startDate || employee.startDate <= logDate) &&
            (!employee.endDate || employee.endDate >= logDate),
        )
        .sort((a, b) => compareEmployeeNames(a.name, b.name)),
    [employees, logDate],
  );
  const markDirty = () => {
    if (!loaded.current) return;
    editVersion.current += 1;
    if (saveInFlight.current) saveAgain.current = true;
    saveRetryRequired.current = false;
    setSaveError(false);
    setDeviceDraftSaved(false);
    setDirty(true);
  };
  async function reviewDraftChanges() {
    if (reviewLoading || saveInFlight.current) return;
    const requestedDate = logDate, request = loadRequest.current;
    setReviewLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/logbook?date=${encodeURIComponent(requestedDate)}`, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
      const server = await response.json() as LogPayload;
      if (requestedDate !== latestSave.current.logDate || request !== loadRequest.current) return;
      if (!response.ok) throw new Error(server.error || "Unable to load the saved log. Your draft is still here; retry when connected.");
      if (!Number.isSafeInteger(server.log?.saveVersion) || server.log.saveVersion < 0) throw new Error("The saved version could not be verified. Your draft is still here; retry.");
      setRecoveryReview({ date: requestedDate, request, draft: logSnapshot(latestSave.current), draftVersion: savedVersions.current.get(requestedDate), server, saved: logSnapshot({ staffing: server.staffing, calls: server.calls, shiftNotes: server.log.shiftNotes }) });
    } catch (error) {
      if (requestedDate === latestSave.current.logDate && request === loadRequest.current) setMessage(error instanceof Error ? error.message : "Unable to compare the saved log. Your draft is still here; retry.");
    } finally { setReviewLoading(false); }
  }
  async function applyReviewedChanges(result: LogSnapshot) {
    const review = recoveryReview;
    if (!review || review.date !== latestSave.current.logDate || review.request !== loadRequest.current || saveInFlight.current) return;
    const server = review.server;
    const changed = logDifferences(result, review.saved).length > 0;
    if (changed && server.log.locked && !server.log.adminUnlocked) throw new Error("This log has been locked. Go back and have an administrator unlock it, then review your draft again.");
    try {
      backupLogRecovery(window.localStorage, review.date, review.draft, review.draftVersion, review.saved, server.log.saveVersion);
      // Write the reviewed draft BEFORE replacing anything on screen. If the
      // device cannot store it, leave the original draft and choices intact.
      if (changed) window.localStorage.setItem(draftKey(review.date), JSON.stringify({ ...result, logDate: review.date, expectedVersion: server.log.saveVersion, savedAt: new Date().toISOString() }));
      else window.localStorage.removeItem(draftKey(review.date));
    } catch { throw new Error("This device could not keep the recovery backup. Your draft and choices are still here. Free some browser storage, or go back and download a copy before trying again."); }
    latestSave.current = { ...result, logDate: review.date };
    savedVersions.current.set(review.date, server.log.saveVersion);
    autosaveAuthorized.current = !server.log.locked || Boolean(server.log.adminUnlocked);
    saveRetryRequired.current = false;
    setStaffing(result.staffing); setCalls(result.calls); setShiftNotes(result.shiftNotes);
    setLogAudit(server.log); setApprovals(server.approvals ?? []);
    setLocked(Boolean(server.log.locked)); setAdminUnlocked(Boolean(server.log.adminUnlocked)); setCanUnlock(Boolean(server.canUnlock));
    setLastSynced(parseSavedTime(server.log.updatedAt));
    setSaveConflict(false); setSaveError(false); setDirty(changed); setDeviceDraftSaved(changed);
    setRecoveryReview(null);
    if (changed) {
      editVersion.current += 1;
      await saveLog();
    } else {
      setMessage(server.log.locked && !server.log.adminUnlocked ? "Saved log loaded. An administrator must unlock it before editing." : "Review complete · you can continue editing. Your previous draft is backed up on this device.");
    }
  }
  function changeLogDate(date: string) {
    if (!date || date === logDate || !confirmLeavingWork()) return;
    loadRequest.current += 1;
    loaded.current = false;
    autosaveAuthorized.current = false;
    setExpandedShifts([date === chicagoOperationalContext().operationalDate ? currentLogShift() : "morning"]);
    setLogDate(date);
  }
  function addCall() {
    const call = blankCall();
    setCalls(current => [...current, call]);
    setEditingCalls(current => [...current, call.id]);
    markDirty();
  }
  function selectStaffEmployee(id: string, employeeId: string) {
    setStaffing((current) => {
      const rows = current.map((row) =>
        row.id === id ? { ...row, employeeId } : { ...row },
      );
      const target = rows.find((row) => row.id === id);
      if (!target) return rows;
      if (!employeeId) target.actingOfficer = false;
      if (employeeId) {
        const targetStart = shiftMinutes(target.timeIn, target.shiftKey),
          targetEnd = shiftMinutes(target.timeOut, target.shiftKey);
        for (const other of rows) {
          if (other.id === id || other.employeeId !== employeeId) continue;
          const otherStart = shiftMinutes(other.timeIn, other.shiftKey),
            otherEnd = shiftMinutes(other.timeOut, other.shiftKey);
          if (otherStart <= targetStart && targetStart < otherEnd)
            other.timeOut = target.timeIn;
          else if (targetStart <= otherStart && otherStart < targetEnd)
            target.timeOut = other.timeIn;
        }
      }
      return rows;
    });
    markDirty();
  }
  function setActingOfficer(id: string, actingOfficer: boolean) {
    setStaffing((rows) =>
      rows.map((row) => (row.id === id ? { ...row, actingOfficer } : row)),
    );
    markDirty();
  }
  function setStaffTimeIn(id: string, timeIn: string) {
    setStaffing((rows) =>
      rows.map((row) => (row.id === id ? { ...row, timeIn } : row)),
    );
    markDirty();
  }
  function setStaffTimeOut(id: string, timeOut: string) {
    setStaffing((rows) =>
      rows.map((row) => (row.id === id ? { ...row, timeOut } : row)),
    );
    markDirty();
  }
  function updateCall(id: string, patch: Partial<CallRow>) {
    if (readOnly) return;
    const existing = calls.find(call => call.id === id);
    if (existing && callIsComplete(existing) && !editingCalls.includes(id)) return;
    setCalls((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
    markDirty();
  }
  function finishMilitaryTime(
    id: string,
    field: "timeOut" | "timeIn",
    value: string,
  ) {
    const normalized = normalizeMilitaryTime(value);
    if (normalized === null)
      return setMessage(
        "Enter four-digit military time from 0000 through 2359.",
      );
    updateCall(id, { [field]: normalized });
  }
  async function refreshFleetRequirements(includeHistory = false) {
    const requestedDate = logDate;
    setChecksRefreshing(true);
    try {
      const response = await fetch(
        `/api/logbook?date=${encodeURIComponent(logDate)}${includeHistory ? "" : "&fleetRequirementsOnly=1"}`,
        { cache: "no-store" },
      );
      const result = (await response.json()) as {
        fleetVerificationAvailable?: boolean;
        incompleteFleetChecks?: RequiredFleetCheck[];
        apparatusChecks?: ApparatusCheck[];
        apparatusChecksAvailable?: boolean;
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error || "Unable to verify Fleet check status.");
      const available = Boolean(result.fleetVerificationAvailable);
      const incomplete = result.incompleteFleetChecks ?? [];
      if (latestSave.current.logDate !== requestedDate) return { available: false, incomplete: [] as RequiredFleetCheck[] };
      setFleetVerificationAvailable(available);
      setIncompleteFleetChecks(incomplete);
      if (includeHistory) {
        setApparatusChecks(result.apparatusChecks ?? []);
        setApparatusChecksAvailable(Boolean(result.apparatusChecksAvailable));
      }
      return { available, incomplete };
    } catch {
      if (latestSave.current.logDate === requestedDate) {
        setFleetVerificationAvailable(false);
        if (includeHistory) setApparatusChecksAvailable(false);
      }
      return { available: false, incomplete: [] as RequiredFleetCheck[] };
    } finally {
      setChecksRefreshing(false);
    }
  }
  async function openHandoff(
    shiftKey: string,
    shiftTitle: string,
    mode: "in" | "out",
  ) {
    if (dirty || saving) { setMessage("Wait for all changes to save before officer sign-off. If saving needs attention, resolve it first."); return; }
    if (mode === "out") {
      setMessage("Checking required Fleet inspections…");
      const requirements = await refreshFleetRequirements();
      if (!requirements.available)
        return setMessage(
          "Officer sign out is blocked because Fleet checklist status could not be verified. Try again.",
        );
      const shiftChecks = fleetChecksForShift(requirements.incomplete, shiftKey);
      if (shiftChecks.length)
        return setMessage(
          `Officer sign out is blocked. Complete these Fleet checks first: ${fleetCheckList(shiftChecks)}.`,
        );
    }
    setMessage("");
    setHandoff({ shiftKey, shiftTitle, mode });
    setHandoffError("");
    setOfficerId("");
    setEquipment(cleanEquipment());
    setHandoffNote("");
    setAcceptedNotes(false);
    setAcceptedFleetDuties(false);
  }
  async function submitHandoff() {
    if (!handoff || handoffPending.current) return;
    const hasIssueWithoutDetail = Object.values(equipment).some(
      (item) => item.status !== "Present" && !item.detail.trim(),
    );
    if (!officerId)
      return setMessage("Select the officer completing the approval.");
    if (handoff.mode === "in" && !acceptedNotes)
      return setMessage("Review and accept the previous seven days of notes.");
    if (handoff.mode === "out" && !acceptedFleetDuties)
      return setMessage(
        "Acknowledge that all required Fleet checks and assigned duties are complete.",
      );
    if (hasIssueWithoutDetail)
      return setMessage(
        "Add details for all missing or out-of-service equipment.",
      );
    if (
      Object.values(equipment).some((item) => item.status !== "Present") &&
      !handoffNote.trim()
    )
      return setMessage("Add a handoff note for the equipment issue.");
    handoffPending.current = true;
    setHandoffSaving(true);
    setHandoffError("");
    try {
    const response = await fetch("/api/logbook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "handoff",
        logDate,
        shiftKey: handoff.shiftKey,
        mode: handoff.mode,
        officerId,
        equipment,
        note: handoffNote,
        reviewedNotes: handoff.mode === "in" ? acceptedNotes : true,
        fleetDutiesAcknowledged:
          handoff.mode === "out" ? acceptedFleetDuties : false,
      }),
    });
    const result = (await response.json()) as {
      error?: string;
      incompleteFleetChecks?: RequiredFleetCheck[];
    };
    if (!response.ok) {
      if (result.incompleteFleetChecks)
        setIncompleteFleetChecks(result.incompleteFleetChecks);
      throw new Error(result.error || "Unable to save approval");
    }
    const successMessage =
      handoff.mode === "in"
        ? "Officer signed in and equipment approved"
        : "Officer signed out and shift approved";
    setHandoff(null);
    await loadLog(logDate);
    setMessage(successMessage);
    } catch (error) {
      setHandoffError(error instanceof Error ? error.message : "The approval was not confirmed. Check your connection, then retry.");
    } finally {
      handoffPending.current = false;
      setHandoffSaving(false);
    }
  }
  async function adminUnlock() {
    if (unlocking) return;
    const requestedDate = logDate;
    const requestAtStart = loadRequest.current;
    setUnlocking(true);
    try {
    const response = await fetch("/api/logbook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "adminUnlock", logDate: requestedDate, expectedVersion: recoveryReview?.date === requestedDate ? recoveryReview.server.log.saveVersion : savedVersions.current.get(requestedDate) }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
      adminUnlocked?: boolean;
      saveVersion?: number;
    };
    if (latestSave.current.logDate !== requestedDate || loadRequest.current !== requestAtStart) return;
    if (response.ok && result.adminUnlocked === true) {
      if (!Number.isSafeInteger(result.saveVersion) || result.saveVersion! < 0) {
        setUnlockConfirmOpen(false);
        setMessage("The unlocked version could not be confirmed. Reload this log before editing.");
        return;
      }
      savedVersions.current.set(requestedDate, result.saveVersion);
      autosaveAuthorized.current = true;
      setAdminUnlocked(true);
      setRecoveryReview(current => current?.date === requestedDate ? { ...current, server: { ...current.server, log: { ...current.server.log, adminUnlocked: 1, saveVersion: result.saveVersion! } } } : current);
      setUnlockConfirmOpen(false);
      setMessage("Administrator editing enabled · changes save automatically");
    } else {
      if (response.status === 409) {
        autosaveAuthorized.current = false;
        setSaveConflict(true);
        setRecoveryReview(null);
        setUnlockConfirmOpen(false);
      }
      setMessage(result.error || "Unable to unlock this log.");
    }
    } catch {
      setMessage("Unlock could not be confirmed. Check your connection and retry.");
    } finally {
      setUnlocking(false);
    }
  }

  if (loading)
    return (
      <section
        className="daily-log-skeleton"
        aria-label="Loading daily log"
        aria-busy="true"
      >
        <div className="skeleton-heading">
          <span />
          <strong />
        </div>
        <div className="skeleton-shifts">
          <i />
          <i />
          <i />
        </div>
        <div className="skeleton-log-table">
          <i />
          <i />
          <i />
        </div>
      </section>
    );
  return (
    <section
      className={`logbook-page ${readOnly ? "is-locked" : "is-editable"}`}
    >
      <header className="logbook-heading log-compact-heading">
        <div><h2>Daily Logbook</h2><p>Review staffing → record activity → check equipment → hand off.</p><small>LOG-{logDate.replaceAll("-", "")} · {locked && !adminUnlocked ? "Locked" : adminUnlocked ? "Unlocked for correction" : "Editable"} · {approvals.filter(item => item.signOutAt).length} of 3 shifts signed off</small></div>
        <div className="log-date-actions">
          <label>
            <span>Log date</span>
            <input
              type="date"
              value={logDate}
              disabled={reviewLoading || saving}
              onChange={(event) => changeLogDate(event.target.value)}
            />
          </label>
          <button type="button" className="log-print no-print" onClick={() => window.print()}>Print / Save PDF</button>
        </div>
      </header>
      <div className="log-sticky-tools no-print">
        <nav aria-label="Daily Log sections">
          {[["log-staffing", "Staffing"], ["log-calls", "Calls"], ["log-checks", "Checks"], ["log-notes", "Notes & Handoff"]].map(([id, label]) => <a key={id} href={`#${id}`} onClick={event => { event.preventDefault(); const section = document.getElementById(id); section?.scrollIntoView({ block: "start" }); section?.focus({ preventScroll: true }); }}>{label}</a>)}
        </nav>
        <div className={`log-save-status ${saveError || saveConflict || loadError ? "attention" : loading || loadedDate !== logDate || saving || dirty || !isOnline || schedulePrefilled ? "pending" : "saved"}`} role="status" aria-live="polite">
          <strong>{loading ? "Loading log…" : loadError || loadedDate !== logDate ? "Not loaded" : saveConflict ? "Needs attention · conflicting changes" : saveError ? "Save not confirmed — Retry" : saving ? saveSlow ? "Saving is taking longer than usual…" : "Saving…" : dirty ? deviceDraftSaved ? "Saved on this device · waiting to sync" : "Unsaved changes" : schedulePrefilled ? "Staffing needs confirmation" : !isOnline ? "Offline · showing last saved log" : "Saved to server"}</strong>
          <small>{saving ? deviceDraftSaved ? "Recovery draft saved on this device. Waiting for the server." : "Keep this page open until the server confirms saving." : schedulePrefilled && !dirty && !saveError ? "Scheduled staffing is not saved yet. Use Confirm & Save Staffing below." : lastSynced ? `Last server save ${savedTimeLabel(lastSynced)} Central` : "No server save confirmed in this view."} · Saving is not officer sign-off.</small>
          {saveError && !saveConflict && !readOnly && <button type="button" disabled={saving} onClick={() => void saveLog()}>Retry save</button>}
        </div>
      </div>
      {loadedDate === logDate && logAudit && (
        <RecordCredibility
          compact
          audit={{
            recordNumber: `LOG-${logDate.replaceAll("-", "")}`,
            status: readOnly
              ? "Locked"
              : adminUnlocked
                ? "Unlocked for correction"
                : "Editable",
            createdBy: logAudit.createdBy,
            createdAt: logAudit.createdAt,
            updatedBy: logAudit.updatedBy,
            updatedAt: logAudit.updatedAt,
            closedBy: logAudit.lockedBy,
            closedAt: logAudit.lockedAt,
            closedLabel: "Locked",
            revisions: logAudit.revisions,
          }}
        />
      )}
      {holiday && (
        <div className="holiday-log-banner">
          <div className="holiday-star">★</div>
          <div>
            <span>Department Holiday</span>
            <strong>{holiday.name}</strong>
            <p>
              {holiday.overnightOnly
                ? "Holiday pay applies to the 6:00 PM–6:00 AM section only."
                : "Eligible hours worked today automatically receive the configured holiday rate."}
            </p>
          </div>
        </div>
      )}
      {loadedDate === logDate && locked && !adminUnlocked && !recoveryReview && (
        <div className="locked-banner">
          <div>
            <strong>🔒 Daily log locked</strong>
            <span>
              The operational day changes at 6:00 AM. The prior log locks at
              7:00 AM after the one-hour grace period.
            </span>
          </div>
          {canUnlock && (
            <button onClick={() => setUnlockConfirmOpen(true)}>
              Admin Unlock
            </button>
          )}
        </div>
      )}
      {loadedDate === logDate && adminUnlocked && locked && (
        <div className="admin-banner">
          Administrator editing is enabled for this locked log.
        </div>
      )}
      {schedulePrefilled && !readOnly && (
        <div className="schedule-prefill-banner">
          <div>
            <strong>Prefilled from Department Schedule</strong>
            <span>
              Review the scheduled staffing and adjust names or times to match
              who actually worked. It remains fully editable.
            </span>
          </div>
          <button disabled={saving} onClick={() => void saveLog()}>
            {saving ? "Saving staffing…" : "Confirm & Save Staffing"}
          </button>
        </div>
      )}
      {message && (
        <div
          className={
            message.includes("saved") ||
            message.includes("approved") ||
            message.includes("granted")
              ? "log-message success"
              : "log-message"
          }
        >
          {message}
        </div>
      )}
      {loadError && <div className="admin-banner" role="alert">
        This date could not be loaded. Editing is disabled; any device draft is kept unchanged. Unlock the portal if requested, then retry.
        <button type="button" onClick={() => void loadLog(logDate)}>Retry loading log</button>
      </div>}
      {loadedDate === logDate && saveConflict && !recoveryReview && <section className="log-recovery-banner no-print" aria-label="Recover unsaved changes">
        <div><h2>Your changes need a quick review</h2><p>Your draft is still here. Compare it with the saved log, choose what to keep, then save. You do not need to retype your changes.</p></div>
        <div className="log-recovery-actions"><button type="button" className="recovery-primary" disabled={reviewLoading || saving} onClick={() => void reviewDraftChanges()}>{reviewLoading ? "Loading saved version…" : "Review changes & continue"}</button>
        <button type="button" onClick={() => {
          const draft = JSON.stringify({ ...latestSave.current, expectedVersion: savedVersions.current.get(logDate), savedAt: new Date().toISOString() });
          if (draft) {
            const url = URL.createObjectURL(new Blob([draft], { type: "application/json" }));
            const link = document.createElement("a"); link.href = url; link.download = `daily-log-draft-${logDate}.json`; link.click(); URL.revokeObjectURL(url);
          }
        }}>Download a backup (optional)</button></div>
      </section>}
      {loadedDate === logDate && recoveryReview?.date === logDate && <DailyLogRecoveryReview draft={recoveryReview.draft} saved={recoveryReview.saved} employees={employees} locked={Boolean(recoveryReview.server.log.locked && !recoveryReview.server.log.adminUnlocked)} canUnlock={Boolean(recoveryReview.server.canUnlock)} onUnlock={() => setUnlockConfirmOpen(true)} onApply={applyReviewedChanges} onBack={() => setRecoveryReview(null)} />}
      <ConfirmDialog
        open={unlockConfirmOpen}
        title="Unlock this finalized log?"
        description={`Administrator editing will be enabled for the ${logDate} daily log. The action will remain visible in the record status.`}
        confirmLabel="Unlock Log"
        tone="warning"
        busy={unlocking}
        onCancel={() => setUnlockConfirmOpen(false)}
        onConfirm={() => void adminUnlock()}
      />

      <ConfirmDialog open={Boolean(removeCall)} title="Remove this call from the log?" description={`Call ${removeCall?.reportNumber || "without a report number"}${removeCall?.address ? ` at ${removeCall.address}` : ""} will be removed from this daily log. This does not delete the original CAD incident.`} confirmLabel="Remove call" tone="danger" onCancel={() => setRemoveCall(null)} onConfirm={() => { if (readOnly || !removeCall) return; setCalls(current => current.filter(call => call.id !== removeCall.id)); setRemoveCall(null); markDirty(); }} />
      <fieldset className="logbook-fields" disabled={readOnly} hidden={loadedDate !== logDate || Boolean(recoveryReview)}>
        <section id="log-staffing" className="log-section" aria-labelledby="log-staffing-title" tabIndex={-1}>
        <div className="log-section-intro"><h2 id="log-staffing-title">Staffing</h2><p>Review who actually worked. AO means Acting Officer pay for the selected time.</p></div>
        <div className="shift-card-grid">
          {shiftSections.map((shift) => {
            const rows = staffing.filter((row) => row.shiftKey === shift.key);
            const shiftFleetChecks = fleetChecksForShift(incompleteFleetChecks, shift.key);
            const approval = approvals.find(
              (item) => item.shiftKey === shift.key,
            );
            return (
              <details className="content-card shift-card" key={shift.key} open={expandedShifts.includes(shift.key)}>
                <summary onClick={event => { event.preventDefault(); setExpandedShifts(current => current.includes(shift.key) ? current.filter(key => key !== shift.key) : [...current, shift.key]); }}>
                  <span><strong>{shift.title}</strong>{logDate === chicagoOperationalContext().operationalDate && currentLogShift() === shift.key && <em>Current shift</em>}</span>
                  <span>{rows.filter(row => row.employeeId).length} people · {approval?.signOutAt ? "Signed off" : approval?.signInAt ? "Officer signed in" : "Officer not signed in"}</span>
                  <b className="no-print">{expandedShifts.includes(shift.key) ? "Collapse −" : "View / edit +"}</b>
                </summary>
                <div className="log-shift-body">
                <div className="shift-title">
                  <div>
                      <h3>Review staffing &amp; times</h3>
                  </div>
                  <button
                    aria-label={`Add person to ${shift.title}`}
                    onClick={() => {
                      setStaffing((current) => [
                        ...current,
                        blankStaff(
                          shift.key,
                          shift.defaultIn,
                          shift.defaultOut,
                        ),
                      ]);
                      markDirty();
                    }}
                  >
                    ＋ Add person
                  </button>
                </div>
                <div className="staff-labels">
                  <span>In</span>
                  <span>Employee</span>
                  <span>AO</span>
                  <span>Out</span>
                </div>
                <div className="staff-rows">
                  {!rows.length && <p className="log-empty">No staffing recorded for this shift. Choose Add person to record who worked.</p>}
                  {rows.map((row) => {
                    const employee = activeEmployees.find(
                      (item) => item.id === row.employeeId,
                    );
                    return (
                      <div
                        className={
                          row.actingOfficer ? "staff-row ao-row" : "staff-row"
                        }
                        key={row.id}
                      >
                        <select
                          aria-label="Time in"
                          value={row.timeIn}
                          onChange={(event) =>
                            setStaffTimeIn(row.id, event.target.value)
                          }
                        >
                          {timeOptions.map((time) => (
                            <option key={time.value} value={time.value}>
                              {time.label}
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label="Employee name"
                          value={row.employeeId}
                          onChange={(event) =>
                            selectStaffEmployee(row.id, event.target.value)
                          }
                        >
                          <option value="">Select employee…</option>
                          {activeEmployees.map((item) => (
                            <option key={item.id} value={item.id}>
                              {displayName(item.name)}
                            </option>
                          ))}
                        </select>
                        <label
                          className={
                            row.actingOfficer ? "ao-check visible" : "ao-check"
                          }
                          title="Apply Acting Officer pay for this employee and time"
                        >
                          <input
                            aria-label={`Acting Officer pay for ${employee ? displayName(employee.name) : "selected employee"}`}
                            type="checkbox"
                            checked={row.actingOfficer}
                            disabled={!row.employeeId}
                            onChange={(event) =>
                              setActingOfficer(row.id, event.target.checked)
                            }
                          />
                          <span>AO</span>
                        </label>
                        <select
                          aria-label="Time out"
                          value={row.timeOut}
                          onChange={(event) =>
                            setStaffTimeOut(row.id, event.target.value)
                          }
                        >
                          {timeOptions.map((time) => (
                            <option key={time.value} value={time.value}>
                              {time.label}
                            </option>
                          ))}
                        </select>
                        {(
                          <button
                            className="remove-row"
                            aria-label="Remove staffing row"
                            onClick={() => {
                              if (row.employeeId && !window.confirm("Remove this person from this shift? This changes recorded staffing and hours.")) return;
                              setStaffing((current) =>
                                current.filter((item) => item.id !== row.id),
                              );
                              markDirty();
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="officer-actions">
                  <button
                    className={approval?.signInAt ? "approved" : ""}
                    onClick={() =>
                      void openHandoff(shift.key, shift.title, "in")
                    }
                  >
                    {approval?.signInAt
                      ? "✓ Officer Signed In"
                      : "Officer Sign In"}
                  </button>
                  <button
                    className={
                      approval?.signOutAt
                        ? "approved"
                        : shiftFleetChecks.length ||
                            !fleetVerificationAvailable
                          ? "fleet-blocked"
                          : ""
                    }
                    disabled={!approval?.signInAt}
                    title={
                      approval?.signInAt &&
                      !approval?.signOutAt &&
                      shiftFleetChecks.length
                        ? `Complete ${fleetCheckList(shiftFleetChecks)} before signing out.`
                        : undefined
                    }
                    onClick={() =>
                      void openHandoff(shift.key, shift.title, "out")
                    }
                  >
                    {approval?.signOutAt
                      ? "✓ Shift Approved"
                      : "Officer Sign Out"}
                  </button>
                </div>
                {approval?.signInAt &&
                !approval?.signOutAt &&
                (!fleetVerificationAvailable ||
                  shiftFleetChecks.length > 0) ? (
                  <div className="officer-fleet-lock">
                    <strong>Fleet checks required before sign out</strong>
                    {fleetVerificationAvailable ? <div className="fleet-check-links">
                      {shiftFleetChecks.map((check) => <a key={`${check.apparatusId}-${check.checkType}-${check.startTime}`} href={`/inventory?apparatus=${encodeURIComponent(check.apparatusId)}&check=${encodeURIComponent(check.checkType)}`} target="_blank" rel="noreferrer">
                        {check.unit} · {check.checkType.replaceAll("_", " ")}<small>{check.startTime}–{check.endTime} · Open check ↗</small>
                      </a>)}
                      <small>Checks open in a new tab so this log stays open.</small>
                    </div> : <span>Fleet checklist status is temporarily unavailable</span>}
                  </div>
                ) : null}
                </div>
              </details>
            );
          })}
        </div>
        <a className="log-next no-print" href="#log-calls">Next: Calls &amp; Responses →</a>
        </section>

        <article id="log-calls" className="content-card calls-card log-section" tabIndex={-1}>
          <div className="section-header">
            <div>
              <h2>Calls & Responses</h2>
              <p>
                Use four-digit military time. Completed calls stay protected until you choose Edit call.
              </p>
            </div>
            <button
              className="add-call"
              onClick={addCall}
            >
              ＋ Add Call
            </button>
          </div>
          <datalist id="known-addresses">
            {addresses.map((address) => (
              <option key={address} value={address} />
            ))}
          </datalist>
          {!calls.length && <p className="log-empty">No calls recorded for this date. CAD calls appear when the log is loaded; use Add Call for a manual entry.</p>}
          <div className="call-list">
            {[false, true].map(completed => <section className="log-call-group" key={String(completed)} aria-label={completed ? "Completed calls" : "Active calls and drafts"}>
            {calls.some(call => callIsComplete(call) === completed) && <h3>{completed ? "Completed calls" : "Active calls & drafts"} <span>{calls.filter(call => callIsComplete(call) === completed).length}</span></h3>}
            {calls.filter(call => callIsComplete(call) === completed).map((call, index) => (
              <div className="call-entry" key={call.id}>
              {completed && !editingCalls.includes(call.id) ? <div className="log-call-summary">
                <div><strong>{call.reportNumber || "No report #"} · {call.callType}</strong><span>{call.address || "No address recorded"}</span><small>Out {formatMilitaryTime(call.timeOut) || "—"} · Returned {formatMilitaryTime(call.timeIn)} · {call.respondingUnits || "No units recorded"}</small></div>
                <button type="button" className="no-print" onClick={() => setEditingCalls(current => [...current, call.id])}>Edit call</button>
              </div> : <>
              {completed && <div className="log-call-editing"><strong>Editing completed call · changes save automatically</strong><button type="button" onClick={() => setEditingCalls(current => current.filter(id => id !== call.id))}>Finish editing</button></div>}
              <div className="call-row">
                <div className="call-number">{index + 1}</div>
                <label className="call-report">
                  <span>Report #</span>
                  <input
                    value={call.reportNumber}
                    onChange={(event) =>
                      updateCall(call.id, { reportNumber: event.target.value })
                    }
                  />
                </label>
                <label className="call-time-out">
                  <span>Time out (military)</span>
                  <div className="time-now">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      pattern="(?:[01]\d|2[0-3])[0-5]\d"
                      placeholder="0000"
                      aria-label="Time out in four-digit military time"
                      value={formatMilitaryTime(call.timeOut)}
                      onChange={(event) =>
                        updateCall(call.id, {
                          timeOut: event.target.value
                            .replace(/\D/g, "")
                            .slice(0, 4),
                        })
                      }
                      onBlur={(event) =>
                        finishMilitaryTime(
                          call.id,
                          "timeOut",
                          event.target.value,
                        )
                      }
                    />
                    <button
                      disabled={Boolean(call.timeOut)}
                      title={call.timeOut ? "Edit the time field to correct an existing departure time" : "Record the current Central time"}
                      onClick={() =>
                        updateCall(call.id, { timeOut: nowTime() })
                      }
                    >
                      Set departure now
                    </button>
                  </div>
                </label>
                <label className="call-time-in">
                  <span>Time in (military)</span>
                  <div className="time-now">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      pattern="(?:[01]\d|2[0-3])[0-5]\d"
                      placeholder="0000"
                      aria-label="Time in in four-digit military time"
                      value={formatMilitaryTime(call.timeIn)}
                      onChange={(event) =>
                        updateCall(call.id, {
                          timeIn: event.target.value
                            .replace(/\D/g, "")
                            .slice(0, 4),
                        })
                      }
                      onBlur={(event) =>
                        finishMilitaryTime(
                          call.id,
                          "timeIn",
                          event.target.value,
                        )
                      }
                    />
                    <button
                      disabled={Boolean(call.timeIn) || !call.timeOut || !normalizeMilitaryTime(call.timeOut)}
                      title="Record the current Central time as the return time"
                      onClick={() => updateCall(call.id, { timeIn: nowTime() })}
                    >
                      Record return time
                    </button>
                  </div>
                </label>
                <label className="call-units">
                  <span>Responding units</span>
                  <input
                    placeholder="1203, 1205…"
                    value={call.respondingUnits}
                    onChange={(event) =>
                      updateCall(call.id, {
                        respondingUnits: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="call-address">
                  <span>Address</span>
                  <input
                    list="known-addresses"
                    autoComplete="street-address"
                    placeholder="Start typing an address…"
                    value={call.address}
                    onChange={(event) =>
                      updateCall(call.id, { address: event.target.value })
                    }
                  />
                </label>
                <label className="call-type">
                  <span>Type</span>
                  <select
                    value={call.callType}
                    onChange={(event) =>
                      updateCall(call.id, { callType: event.target.value })
                    }
                  >
                    {call.callType && !callTypes.includes(call.callType) && (
                      <option>{call.callType}</option>
                    )}
                    {callTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </label>
                {(
                  <button
                    className="remove-call"
                    aria-label={`Remove call ${call.reportNumber || index + 1}`}
                    onClick={() => setRemoveCall(call)}
                  >
                    Remove call
                  </button>
                )}
              </div>
              </>}
              {call.reportNumber && call.timeOut && (
                <CallbackPanel call={call} logDate={logDate} />
              )}
              </div>
            ))}
            </section>)}
          </div>
          <button
            className="add-call bottom"
            onClick={addCall}
          >
            ＋ Add Another Call
          </button>
          <a className="log-next no-print" href="#log-checks">Next: Fleet &amp; Inventory Checks →</a>
        </article>
        <article id="log-checks" className="content-card apparatus-check-log log-section" tabIndex={-1}>
          <div className="section-header">
            <div>
              <h2>Fleet &amp; Inventory Checks</h2>
              <p>
                Completed apparatus inspections are recorded automatically from
                Fleet.
              </p>
            </div>
            <button type="button" className="no-print" disabled={checksRefreshing} onClick={() => void refreshFleetRequirements(true)}>{checksRefreshing ? "Checking…" : "Refresh check status"}</button>
          </div>
          {!fleetVerificationAvailable ? <p className="log-attention">Required check status is unavailable—not confirmed complete. Retry when connected.</p> : <section className="log-required-checks"><h3>{incompleteFleetChecks.length ? `${incompleteFleetChecks.length} required ${incompleteFleetChecks.length === 1 ? "check needs" : "checks need"} attention` : "No outstanding required checks reported"}</h3>{incompleteFleetChecks.map(check => <a key={`${check.apparatusId}-${check.checkType}-${check.startTime}`} href={`/inventory?apparatus=${encodeURIComponent(check.apparatusId)}&check=${encodeURIComponent(check.checkType)}`} target="_blank" rel="noreferrer"><span><strong>{check.unit} · {check.checkType.replaceAll("_", " ")}</strong><small>{check.startTime}–{check.endTime} · {check.status === "in_progress" ? "In progress" : "Pending"}</small></span><b>Open check ↗</b></a>)}{incompleteFleetChecks.length > 0 && <small>Opens in a new tab. Return here and refresh status when finished.</small>}</section>}
          <h3>Completed checks{apparatusChecksAvailable ? ` · ${apparatusChecks.length}` : ""}</h3>
          {!apparatusChecksAvailable && <p className="log-attention">Completed check history could not be verified. This does not mean no checks were completed.</p>}
          {apparatusChecks.length ? (
            <div>
              {apparatusChecks.map((check) => (
                <a
                  key={check.id}
                  href={`/inventory?apparatus=${encodeURIComponent(check.apparatusId)}&check=${encodeURIComponent(check.checkType)}`}
                >
                  <span>
                    <strong>
                      {check.unit} · {check.checkType.replaceAll("_", " ")}{" "}
                      check
                    </strong>
                    <small>
                      Completed{" "}
                      {new Date(check.completedAt).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" "}
                      by {check.completedBy}
                    </small>
                  </span>
                  <b className={check.failedItems ? "has-failures" : "clear"}>
                    {check.failedItems
                      ? `${check.failedItems} failed item${check.failedItems === 1 ? "" : "s"}`
                      : "All items recorded"}
                  </b>
                </a>
              ))}
            </div>
          ) : apparatusChecksAvailable ? (
            <p className="apparatus-check-empty">
              No Fleet or Inventory checks were completed on this log date.
            </p>
          ) : null}
          <a className="log-next no-print" href="#log-notes">Next: Notes &amp; Handoff →</a>
        </article>
        <DailyLogNotes key={logDate} value={shiftNotes} onChange={value => { setShiftNotes(value); markDirty(); }} recentNotes={recentNotes} onOpenDate={changeLogDate} readOnly={readOnly} />
        <div className="log-handoff-next no-print"><strong>Review &amp; hand off</strong><span>Saving does not complete a shift. Review the shift, required checks, and notes before signing off.</span>{shiftSections.filter(shift => approvals.some(approval => approval.shiftKey === shift.key && approval.signInAt && !approval.signOutAt)).map(shift => <button type="button" key={shift.key} disabled={saving || dirty || saveError || !isOnline} onClick={() => void openHandoff(shift.key, shift.title, "out")}>Review &amp; hand off · {shift.title}</button>)}{!approvals.some(approval => approval.signInAt && !approval.signOutAt) && <span>No signed-in shift is awaiting handoff. Review officer sign-in under Staffing.</span>}{dirty && <span>Save your changes before handing off.</span>}</div>
      </fieldset>

      {handoff && (
        <div className="handoff-backdrop" role="presentation">
          <section
            className="handoff-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="handoff-title"
          >
            <div className="handoff-header">
              <div>
                <p className="eyebrow">{handoff.shiftTitle}</p>
                <h2 id="handoff-title">
                  Officer Sign {handoff.mode === "in" ? "In" : "Out"}
                </h2>
              </div>
              <button
                aria-label="Close officer approval"
                disabled={handoffSaving}
                onClick={() => setHandoff(null)}
              >
                ×
              </button>
            </div>
            <label className="handoff-officer">
              <span>Officer completing approval</span>
              <select
                value={officerId}
                onChange={(event) => setOfficerId(event.target.value)}
              >
                <option value="">Select employee…</option>
                {activeEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {displayName(employee.name)}
                  </option>
                ))}
              </select>
            </label>
            {handoff.mode === "in" && (
              <section className="review-notes">
                <h3>Review previous 7 days of notes</h3>
                <p>
                  Review all notes below, then check the box to accept the
                  shift.
                </p>
                <div className="notes-scroll">
                  {readLogNotes(shiftNotes).entries.some(entry => entry.status === "Open") && <article className="log-attention"><strong>Open items on this log</strong>{readLogNotes(shiftNotes).entries.filter(entry => entry.status === "Open").map(entry => <p key={entry.id}><b>{entry.category}:</b> {entry.text}</p>)}</article>}
                  {recentNotes.length ? (
                    recentNotes.map((item, index) => (
                      <article key={`${item.logDate}-${index}`}>
                        <strong>{item.logDate}</strong>
                        <p>{item.note}</p>
                      </article>
                    ))
                  ) : (
                    <article>
                      <strong>No prior notes</strong>
                      <p>
                        There are no notes recorded in the previous seven days.
                      </p>
                    </article>
                  )}
                  <div className="scroll-end">End of seven-day notes</div>
                </div>
                <label
                  className={
                    acceptedNotes ? "accept-check ready" : "accept-check"
                  }
                >
                  <input
                    type="checkbox"
                    checked={acceptedNotes}
                    onChange={(event) => setAcceptedNotes(event.target.checked)}
                  />
                  <span>I reviewed and accept the previous shift notes.</span>
                </label>
              </section>
            )}
            {handoff.mode === "out" && (
              <section className="review-notes duty-acknowledgment">
                <h3>Required duties</h3>
                <p>
                  Fleet status was rechecked and all required Daily and
                  scheduled Weekly vehicle checks are complete.
                </p>
                <label
                  className={
                    acceptedFleetDuties ? "accept-check ready" : "accept-check"
                  }
                >
                  <input
                    type="checkbox"
                    checked={acceptedFleetDuties}
                    onChange={(event) =>
                      setAcceptedFleetDuties(event.target.checked)
                    }
                  />
                  <span>
                    I acknowledge that all required Fleet checks and assigned
                    duties for this shift are complete.
                  </span>
                </label>
              </section>
            )}
            <section className="equipment-check">
              <div>
                <h3>Equipment accountability</h3>
                <p>
                  Confirm each item is present or document anything missing/out
                  of service.
                </p>
              </div>
              {equipmentItems.map((item) => (
                <div className="equipment-row" key={item.key}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.detail}</span>
                  </div>
                  <select
                    aria-label={`${item.name} status`}
                    value={equipment[item.key].status}
                    onChange={(event) =>
                      setEquipment((current) => ({
                        ...current,
                        [item.key]: {
                          ...current[item.key],
                          status: event.target.value,
                        },
                      }))
                    }
                  >
                    <option>Present</option>
                    <option>Missing</option>
                    <option>Out of Service</option>
                  </select>
                  {equipment[item.key].status !== "Present" && (
                    <input
                      aria-label={`${item.name} details`}
                      placeholder="What is missing/OOS? Include unit…"
                      value={equipment[item.key].detail}
                      onChange={(event) =>
                        setEquipment((current) => ({
                          ...current,
                          [item.key]: {
                            ...current[item.key],
                            detail: event.target.value,
                          },
                        }))
                      }
                    />
                  )}
                </div>
              ))}
            </section>
            <label className="handoff-note">
              <span>
                {handoff.mode === "in" ? "Officer notes" : "Closing shift note"}
              </span>
              <textarea
                rows={3}
                placeholder={
                  handoff.mode === "in"
                    ? "Add coverage, equipment, or follow-up information…"
                    : "Add the final handoff note for the next officer…"
                }
                value={handoffNote}
                onChange={(event) => setHandoffNote(event.target.value)}
              />
            </label>
            <SaveStatus state={handoffSaving ? "saving" : handoffError ? "failed" : "unsaved"} detail={handoffError || "Approval is separate from saving the Daily Log."} />
            <div className="handoff-footer">
              <button className="quiet-button" disabled={handoffSaving} onClick={() => setHandoff(null)}>
                Cancel
              </button>
              <button
                className="primary-action compact"
                disabled={
                  handoffSaving || !officerId ||
                  (handoff.mode === "in" && !acceptedNotes) ||
                  (handoff.mode === "out" && !acceptedFleetDuties)
                }
                onClick={() => void submitHandoff()}
              >
                {handoffSaving ? "Saving…" : handoffError ? "Retry approval" : handoff.mode === "in"
                  ? "Accept Shift & Sign In"
                  : "Acknowledge Duties & Sign Out"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
