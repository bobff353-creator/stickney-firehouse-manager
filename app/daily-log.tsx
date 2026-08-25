"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { holidayForDate } from "./holidays";
import ConfirmDialog from "./confirm-dialog";
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
  fleetVerificationAvailable?: boolean;
  incompleteFleetChecks?: RequiredFleetCheck[];
  canUnlock?: boolean;
  error?: string;
};
type Handoff = { shiftKey: string; shiftTitle: string; mode: "in" | "out" };
type OfflineDraft = {
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
const callTypes = [
  "Fire",
  "EMS",
  "MVA",
  "TRT",
  "HazMat",
  "Auto Aid",
  "Mutual Aid",
  "Hazardous Condition",
  "Special",
];
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
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load, open]);
  async function submit() {
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
    };
    if (response.ok) {
      setSelected([]);
      await load();
      setMessage(
        `Submitted to ${result.reviewer?.reviewerName ? displayName(result.reviewer.reviewerName) : "the callback reviewer"}.`,
      );
    } else {
      setMessage(result.error ?? "Unable to submit callback attendance.");
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
          <div className="callback-employee-list">
            {payload?.eligibleEmployees
              .filter(
                (employee) =>
                  !payload.submissions.some(
                    (submission) =>
                      submission.employeeId === employee.employeeId,
                  ),
              )
              .map((employee) => (
                <label key={employee.employeeId}>
                  <input
                    type="checkbox"
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
          <button
            type="button"
            className="primary-action compact"
            disabled={!selected.length}
            onClick={() => void submit()}
          >
            Submit Callback Attendance
          </button>
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
}) {
  const [logDate, setLogDate] = useState(
    () => chicagoOperationalContext().operationalDate,
  );
  const [staffing, setStaffing] = useState<StaffingRow[]>([]);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [shiftNotes, setShiftNotes] = useState("");
  const [addresses, setAddresses] = useState<string[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [recentNotes, setRecentNotes] = useState<RecentNote[]>([]);
  const [apparatusChecks, setApparatusChecks] = useState<ApparatusCheck[]>([]);
  const [incompleteFleetChecks, setIncompleteFleetChecks] = useState<
    RequiredFleetCheck[]
  >([]);
  const [fleetVerificationAvailable, setFleetVerificationAvailable] =
    useState(false);
  const [locked, setLocked] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [canUnlock, setCanUnlock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [handoff, setHandoff] = useState<Handoff | null>(null);
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
  const autosaveAuthorized = useRef(false);
  const editVersion = useRef(0);
  const latestSave = useRef({ logDate, staffing, calls, shiftNotes });
  const readOnly = locked && !adminUnlocked;
  const holiday = useMemo(() => holidayForDate(logDate), [logDate]);
  useEffect(() => {
    latestSave.current = { logDate, staffing, calls, shiftNotes };
  }, [calls, logDate, shiftNotes, staffing]);

  const loadLog = useCallback(async (date: string) => {
    setLoading(true);
    setMessage("");
    loaded.current = false;
    autosaveAuthorized.current = false;
    try {
      const response = await fetch(`/api/logbook?date=${date}`);
      const data = (await response.json()) as LogPayload;
      if (!response.ok) throw new Error(data.error || "Unable to load log");
      const stored = window.localStorage.getItem(draftKey(date));
      const draft = stored ? (JSON.parse(stored) as OfflineDraft) : null;
      const serverTime = data.log?.updatedAt
        ? new Date(data.log.updatedAt).getTime()
        : 0;
      const restore = Boolean(
        draft && new Date(draft.savedAt).getTime() > serverTime,
      );
      const rows = (restore ? draft!.staffing : data.staffing).map((row) => ({
        ...row,
        actingOfficer: Boolean(row.actingOfficer),
      }));
      for (const shift of shiftSections)
        for (
          let i = rows.filter((row) => row.shiftKey === shift.key).length;
          i < 4;
          i += 1
        )
          rows.push(blankStaff(shift.key, shift.defaultIn, shift.defaultOut));
      const callRows = [...(restore ? draft!.calls : data.calls)];
      while (callRows.length < 2) callRows.push(blankCall());
      setStaffing(rows);
      setCalls(callRows);
      setShiftNotes(restore ? draft!.shiftNotes : (data.log?.shiftNotes ?? ""));
      setLogAudit(data.log ?? null);
      setAddresses(data.addresses ?? []);
      setApprovals(data.approvals ?? []);
      setRecentNotes(data.recentNotes ?? []);
      setApparatusChecks(data.apparatusChecks ?? []);
      setIncompleteFleetChecks(data.incompleteFleetChecks ?? []);
      setFleetVerificationAvailable(Boolean(data.fleetVerificationAvailable));
      const serverLocked = Boolean(data.log?.locked),
        serverUnlocked = Boolean(data.log?.adminUnlocked);
      autosaveAuthorized.current = !serverLocked || serverUnlocked;
      setLocked(serverLocked);
      setAdminUnlocked(serverUnlocked);
      setCanUnlock(Boolean(data.canUnlock));
      setDirty(restore);
      setSchedulePrefilled(!restore && Boolean(data.schedulePrefilled));
      if (restore) setMessage("Unsaved work restored from this device");
      setLastSynced(
        data.log?.updatedAt ? new Date(data.log.updatedAt) : new Date(),
      );
      window.setTimeout(() => {
        loaded.current = true;
      }, 0);
    } catch (error) {
      setSchedulePrefilled(false);
      const stored = window.localStorage.getItem(draftKey(date));
      if (stored) {
        const draft = JSON.parse(stored) as OfflineDraft;
        const rows = [...draft.staffing];
        for (const shift of shiftSections)
          for (
            let i = rows.filter((row) => row.shiftKey === shift.key).length;
            i < 4;
            i += 1
          )
            rows.push(blankStaff(shift.key, shift.defaultIn, shift.defaultOut));
        const callRows = [...draft.calls];
        while (callRows.length < 2) callRows.push(blankCall());
        setStaffing(rows);
        setCalls(callRows);
        setShiftNotes(draft.shiftNotes);
        setDirty(true);
        setMessage("Offline draft restored · changes will sync when connected");
        window.setTimeout(() => {
          loaded.current = true;
        }, 0);
      } else
        setMessage(
          error instanceof Error ? error.message : "Unable to load log",
        );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLog(logDate);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadLog, logDate]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const operationalDate = chicagoOperationalContext().operationalDate;
      if (operationalDate !== currentDay.current) {
        currentDay.current = operationalDate;
        setLogDate(operationalDate);
      } else if (!locked && dailyLogDateIsAutoLocked(logDate)) {
        void loadLog(logDate);
      }
    }, 30000);
    return () => window.clearInterval(timer);
  }, [loadLog, locked, logDate]);
  useEffect(() => {
    const update = () => setIsOnline(window.navigator.onLine);
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
      if (saveInFlight.current) {
        saveAgain.current = true;
        return;
      }
      saveInFlight.current = true;
      setSaving(true);
      if (!silent) setMessage("");
      try {
        do {
          saveAgain.current = false;
          const current = latestSave.current;
          const versionAtStart = editVersion.current;
          const payload = {
            logDate: current.logDate,
            staffing: current.staffing.filter((row) => row.employeeId),
            calls: current.calls.filter((row) =>
              Object.entries(row).some(
                ([key, value]) => key !== "id" && value && value !== "EMS",
              ),
            ),
            shiftNotes: current.shiftNotes,
          };
          window.localStorage.setItem(
            draftKey(current.logDate),
            JSON.stringify({ ...payload, savedAt: new Date().toISOString() }),
          );
          if (!window.navigator.onLine) {
            setMessage("Saved on this device · waiting to sync");
            return;
          }
          const response = await fetch("/api/logbook", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });
          const result = (await response.json()) as {
            error?: string;
            payrollEmployeesUpdated?: number;
          };
          if (!response.ok)
            throw new Error(result.error || "Unable to save log");
          setSchedulePrefilled(false);
          if (versionAtStart === editVersion.current) {
            window.localStorage.removeItem(draftKey(current.logDate));
            setDirty(false);
          } else {
            saveAgain.current = true;
          }
          setLastSynced(new Date());
        } while (
          saveAgain.current &&
          window.navigator.onLine &&
          autosaveAuthorized.current
        );
        setMessage(
          silent
            ? "All changes saved · Timesheets updated"
            : "Daily log and timesheets saved",
        );
        onPayrollSynced?.();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Unable to save log",
        );
      } finally {
        saveInFlight.current = false;
        setSaving(false);
      }
    },
    [onPayrollSynced],
  );
  useEffect(() => {
    if (!dirty || readOnly) return;
    const timer = window.setTimeout(() => {
      void saveLog(true);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [dirty, readOnly, saveLog]);
  useEffect(() => {
    if (!dirty || readOnly) return;
    window.localStorage.setItem(
      draftKey(logDate),
      JSON.stringify({
        savedAt: new Date().toISOString(),
        logDate,
        staffing: staffing.filter((row) => row.employeeId),
        calls,
        shiftNotes,
      }),
    );
  }, [calls, dirty, logDate, readOnly, shiftNotes, staffing]);
  useEffect(() => {
    if (!isOnline || !dirty || readOnly) return;
    const timer = window.setTimeout(() => void saveLog(true), 250);
    return () => window.clearTimeout(timer);
  }, [dirty, isOnline, readOnly, saveLog]);

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
    setDirty(true);
  };
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
  async function refreshFleetRequirements() {
    try {
      const response = await fetch(
        `/api/logbook?date=${encodeURIComponent(logDate)}&fleetRequirementsOnly=1`,
        { cache: "no-store" },
      );
      const result = (await response.json()) as {
        fleetVerificationAvailable?: boolean;
        incompleteFleetChecks?: RequiredFleetCheck[];
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error || "Unable to verify Fleet check status.");
      const available = Boolean(result.fleetVerificationAvailable);
      const incomplete = result.incompleteFleetChecks ?? [];
      setFleetVerificationAvailable(available);
      setIncompleteFleetChecks(incomplete);
      return { available, incomplete };
    } catch {
      setFleetVerificationAvailable(false);
      return { available: false, incomplete: [] as RequiredFleetCheck[] };
    }
  }
  async function openHandoff(
    shiftKey: string,
    shiftTitle: string,
    mode: "in" | "out",
  ) {
    if (mode === "out") {
      setMessage("Checking required Fleet inspections…");
      const requirements = await refreshFleetRequirements();
      if (!requirements.available)
        return setMessage(
          "Officer sign out is blocked because Fleet checklist status could not be verified. Try again.",
        );
      if (requirements.incomplete.length)
        return setMessage(
          `Officer sign out is blocked. Complete these Fleet checks first: ${fleetCheckList(requirements.incomplete)}.`,
        );
    }
    setMessage("");
    setHandoff({ shiftKey, shiftTitle, mode });
    setOfficerId("");
    setEquipment(cleanEquipment());
    setHandoffNote("");
    setAcceptedNotes(false);
    setAcceptedFleetDuties(false);
  }
  async function submitHandoff() {
    if (!handoff) return;
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
      return setMessage(result.error || "Unable to save approval");
    }
    const successMessage =
      handoff.mode === "in"
        ? "Officer signed in and equipment approved"
        : "Officer signed out and shift approved";
    setHandoff(null);
    await loadLog(logDate);
    setMessage(successMessage);
  }
  async function adminUnlock() {
    setUnlocking(true);
    const response = await fetch("/api/logbook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "adminUnlock", logDate }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
      adminUnlocked?: boolean;
    };
    if (response.ok && result.adminUnlocked === true) {
      autosaveAuthorized.current = true;
      setAdminUnlocked(true);
      setUnlockConfirmOpen(false);
      setMessage("Administrator editing enabled · changes save automatically");
    } else {
      setMessage(result.error || "Unable to unlock this log.");
    }
    setUnlocking(false);
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
      <div className="logbook-heading standard-page-header">
        <div>
          <span className="page-icon" aria-hidden="true">
            ▣
          </span>
          <div>
            <p className="eyebrow">Stickney Fire Department</p>
            <h2>Daily Logbook</h2>
            <p>
              Automatically saved staffing, responses, equipment checks, and
              officer handoffs.
            </p>
          </div>
        </div>
        <div className="log-date-actions">
          <label>
            <span>Log date</span>
            <input
              type="date"
              value={logDate}
              onChange={(event) => setLogDate(event.target.value)}
            />
          </label>
          <div
            className={`autosave-state ${!isOnline ? "offline" : saving ? "saving" : dirty ? "pending" : "saved"}`}
          >
            <strong>
              {!isOnline
                ? "Offline"
                : saving
                  ? "Saving…"
                  : dirty
                    ? "Save pending"
                    : "Saved"}
            </strong>
            <small>
              Last synced{" "}
              {lastSynced
                ? lastSynced.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "—"}
            </small>
          </div>
        </div>
      </div>
      {logAudit && (
        <RecordCredibility
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
      {readOnly && (
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
      {adminUnlocked && locked && (
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
          <button onClick={() => void saveLog()}>
            Confirm &amp; Save Staffing
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

      <fieldset className="logbook-fields" disabled={readOnly}>
        <div className="shift-card-grid">
          {shiftSections.map((shift) => {
            const rows = staffing.filter((row) => row.shiftKey === shift.key);
            const approval = approvals.find(
              (item) => item.shiftKey === shift.key,
            );
            return (
              <article className="content-card shift-card" key={shift.key}>
                <div className="shift-title">
                  <div>
                    <span>Staffing</span>
                    <h3>{shift.title}</h3>
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
                    ＋
                  </button>
                </div>
                <div className="staff-labels">
                  <span>In</span>
                  <span>Employee</span>
                  <span>AO</span>
                  <span>Out</span>
                </div>
                <div className="staff-rows">
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
                        {rows.length > 4 && (
                          <button
                            className="remove-row"
                            aria-label="Remove staffing row"
                            onClick={() => {
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
                        : incompleteFleetChecks.length ||
                            !fleetVerificationAvailable
                          ? "fleet-blocked"
                          : ""
                    }
                    disabled={!approval?.signInAt}
                    title={
                      approval?.signInAt &&
                      !approval?.signOutAt &&
                      incompleteFleetChecks.length
                        ? `Complete ${fleetCheckList(incompleteFleetChecks)} before signing out.`
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
                  incompleteFleetChecks.length > 0) ? (
                  <div className="officer-fleet-lock">
                    <strong>Fleet checks required before sign out</strong>
                    <span>
                      {fleetVerificationAvailable
                        ? fleetCheckList(incompleteFleetChecks)
                        : "Fleet checklist status is temporarily unavailable"}
                    </span>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>

        <article className="content-card calls-card">
          <div className="section-header">
            <div>
              <h2>Calls & Responses</h2>
              <p>
                Times use four-digit military format. Tap Now for Time Out or
                Done to record the current Time In.
              </p>
            </div>
            <button
              className="add-call"
              onClick={() => {
                setCalls((current) => [...current, blankCall()]);
                markDirty();
              }}
            >
              ＋ Add Call
            </button>
          </div>
          <datalist id="known-addresses">
            {addresses.map((address) => (
              <option key={address} value={address} />
            ))}
          </datalist>
          <div className="call-list">
            {calls.map((call, index) => (
              <div className="call-entry" key={call.id}>
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
                      onClick={() =>
                        updateCall(call.id, { timeOut: nowTime() })
                      }
                    >
                      Now
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
                      title="Set Time In to now and close this active call"
                      onClick={() => updateCall(call.id, { timeIn: nowTime() })}
                    >
                      Done
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
                {calls.length > 1 && (
                  <button
                    className="remove-call"
                    aria-label={`Remove call ${index + 1}`}
                    onClick={() => {
                      setCalls((current) =>
                        current.filter((item) => item.id !== call.id),
                      );
                      markDirty();
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
              {call.reportNumber && call.timeOut && (
                <CallbackPanel call={call} logDate={logDate} />
              )}
              </div>
            ))}
          </div>
          <button
            className="add-call bottom"
            onClick={() => {
              setCalls((current) => [...current, blankCall()]);
              markDirty();
            }}
          >
            ＋ Add Another Call
          </button>
        </article>
        <article className="content-card apparatus-check-log">
          <div className="section-header">
            <div>
              <h2>Fleet &amp; Inventory Checks</h2>
              <p>
                Completed apparatus inspections are recorded automatically from
                Fleet.
              </p>
            </div>
            <b>{apparatusChecks.length} completed</b>
          </div>
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
          ) : (
            <p className="apparatus-check-empty">
              No Fleet or Inventory checks were completed on this log date.
            </p>
          )}
        </article>
        <article className="content-card notes-card">
          <label>
            <span>Shift notes</span>
            <textarea
              rows={5}
              placeholder="Equipment issues, coverage changes, station activity, follow-up items…"
              value={shiftNotes}
              onChange={(event) => {
                setShiftNotes(event.target.value);
                markDirty();
              }}
            />
          </label>
        </article>
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
            <div className="handoff-footer">
              <button className="quiet-button" onClick={() => setHandoff(null)}>
                Cancel
              </button>
              <button
                className="primary-action compact"
                disabled={
                  !officerId ||
                  (handoff.mode === "in" && !acceptedNotes) ||
                  (handoff.mode === "out" && !acceptedFleetDuties)
                }
                onClick={() => void submitHandoff()}
              >
                {handoff.mode === "in"
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
