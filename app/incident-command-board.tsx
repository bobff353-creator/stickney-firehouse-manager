"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from "react";
import ConfirmDialog from "./confirm-dialog";
import { formatEmployeeName } from "./employee-names";
import {
  commandPositions,
  searchPhases,
  supportResources,
  supportStatuses,
  tacticalAssignments,
  tacticalLevels,
  type CommandAction,
  type IncidentCommandState,
  type SearchPhase,
  type SearchStatus,
  type TacticalHazard,
  type TacticalAssignment,
} from "./incident-command-state";

type Incident = {
  incidentId: string;
  reportNumber: string;
  callType: string;
  address: string;
  city: string;
  dispatchedAt: string;
  source: string;
  receivedAt: string;
};
type Personnel = { id: string; name: string; rank: string };
type Preplan = {
  id: string;
  businessName?: string;
  address?: string;
  floorCount?: number | null;
  construction?: string;
  status?: string;
  updatedAt?: string;
  match?: { method: string; distanceFeet: number };
};
type AuditEvent = { id: string; revision: number; eventType: string; summary: string; actor: string; createdAt: string };
type BoardData = {
  incident: Incident | null;
  preplan: Preplan | null;
  personnel: Personnel[];
  cadUnits: string[];
  state: IncidentCommandState | null;
  events: AuditEvent[];
  canManage: boolean;
  connection: { status: string; label: string; stale: boolean; lastUpdatedAt: string | null };
  generatedAt: string;
  error?: string;
};
type ConfirmState =
  | { kind: "mayday"; active: boolean }
  | { kind: "search"; level: string; phase: SearchPhase }
  | { kind: "end-call" }
  | null;
type AssignmentDraft = {
  unitId: string;
  assignment: TacticalAssignment;
  status: IncidentCommandState["units"][string]["status"];
  floor: string;
  side: IncidentCommandState["units"][string]["side"];
  crewStrength: number | null;
};
type MutationResponse = { ok?: boolean; state?: IncidentCommandState; event?: AuditEvent; error?: string };

const hazardOptions = ["Collapse", "Electrical", "Hazardous material", "Hole / opening", "Propane / gas", "Solar panels", "Structural damage", "Utilities"];

const sentence = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const formatTime = (value?: string | null) => value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

export default function IncidentCommandBoard() {
  const boardRef = useRef<HTMLElement>(null);
  const initialLoadStartedRef = useRef(false);
  const alertAudioRef = useRef<AudioContext | null>(null);
  const alertedParRef = useRef("");
  const savingRef = useRef(false);
  const closedRef = useRef(false);
  const [data, setData] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [online, setOnline] = useState(true);
  const [clock, setClock] = useState(0);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("Level unknown");
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [radioDraft, setRadioDraft] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showManualUnitEntry, setShowManualUnitEntry] = useState(false);
  const [manualUnitDraft, setManualUnitDraft] = useState("");
  const [unitsExpanded, setUnitsExpanded] = useState(true);
  const [assignmentsExpanded, setAssignmentsExpanded] = useState(true);
  const [assignmentDraft, setAssignmentDraft] = useState<AssignmentDraft | null>(null);
  const [hazardEditorOpen, setHazardEditorOpen] = useState(false);
  const [hazardDraft, setHazardDraft] = useState<{ label: string; floor: string; side: TacticalHazard["side"] }>({ label: "", floor: "Level unknown", side: "" });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [ritDraft, setRitDraft] = useState({
    unitId: "",
    chiefEmployeeId: "",
    readiness: "not_reported" as IncidentCommandState["rit"]["readiness"],
  });
  const [rehabDraft, setRehabDraft] = useState({ unitIds: [] as string[], chiefEmployeeId: "", assignmentNote: "" });
  savingRef.current = saving;
  closedRef.current = Boolean(data?.state?.closeout.endedAt);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/incident-command", { cache: "no-store" });
      const payload = await response.json() as BoardData;
      if (!response.ok) throw new Error(payload.error || "Unable to load the Command Board.");
      setData(payload);
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load the Command Board.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = !initialLoadStartedRef.current ? window.setTimeout(() => void load(), 0) : 0;
    initialLoadStartedRef.current = true;
    const poll = window.setInterval(() => { if (!savingRef.current && !closedRef.current) void load(true); }, 10_000);
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    const updateOnline = () => setOnline(navigator.onLine);
    const updateFullscreen = () => setIsFullscreen(document.fullscreenElement === boardRef.current);
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(timer);
      window.clearTimeout(initialLoad);
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      document.removeEventListener("fullscreenchange", updateFullscreen);
    };
  }, [load]);

  useEffect(() => {
    if (!data?.state) return;
    const timeout = window.setTimeout(() => {
      setRadioDraft(data.state?.radioChannel ?? "");
      setRitDraft(data.state?.rit ?? { unitId: "", chiefEmployeeId: "", readiness: "not_reported" });
      setRehabDraft(data.state?.rehab ?? { unitIds: [], chiefEmployeeId: "", assignmentNote: "" });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [data?.incident?.incidentId, data?.state?.revision]);

  const mutate = useCallback(async (mutation: CommandAction) => {
    if (!data?.incident || !data.state || saving) return;
    if (!online) {
      setNotice("The browser is offline. The last known board remains visible, but changes cannot be saved.");
      return;
    }
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/incident-command", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ incidentId: data.incident.incidentId, expectedRevision: data.state.revision, mutation }),
      });
      const payload = await response.json() as MutationResponse;
      if (!response.ok) {
        if (response.status === 409) await load(true);
        throw new Error(payload.error || "Unable to save the command-board update.");
      }
      if (payload.state && mutation.action === "end-call") {
        setData((current) => current ? {
          ...current,
          state: payload.state ?? current.state,
          events: payload.event ? [payload.event, ...current.events] : current.events,
        } : current);
      } else {
        await load(true);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save the command-board update.");
    } finally {
      setSaving(false);
    }
  }, [data, load, online, saving]);

  const state = data?.state;
  const levels = useMemo(
    () => state ? tacticalLevels(state, data?.preplan?.floorCount) : ["Level unknown"],
    [data?.preplan?.floorCount, state],
  );
  const activeLevel = levels.includes(selectedLevel) ? selectedLevel : levels[levels.length - 1];
  const parSeconds = useMemo(() => {
    if (!state) return 0;
    if (state.par.status !== "running" || !state.par.startedAt) return state.par.remainingSeconds;
    return Math.max(0, state.par.remainingSeconds - Math.floor((clock - Date.parse(state.par.startedAt)) / 1000));
  }, [clock, state]);
  const parText = `${String(Math.floor(parSeconds / 60)).padStart(2, "0")}:${String(parSeconds % 60).padStart(2, "0")}`;
  const armAlertTone = useCallback(() => {
    if (!alertAudioRef.current) alertAudioRef.current = new AudioContext();
    if (alertAudioRef.current.state === "suspended") void alertAudioRef.current.resume();
  }, []);
  const playAlertTone = useCallback(() => {
    const audio = alertAudioRef.current;
    if (!audio || audio.state !== "running") return;
    const start = audio.currentTime;
    [0, 0.24].forEach((offset) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, start + offset);
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.16, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.18);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + 0.2);
    });
  }, []);
  useEffect(() => {
    const alarmKey = state?.par.startedAt ?? "";
    if (state?.par.status === "running" && alarmKey && parSeconds === 0 && alertedParRef.current !== alarmKey) {
      alertedParRef.current = alarmKey;
      playAlertTone();
      setNotice("PAR interval is due. Complete accountability, then reset the timer.");
    }
  }, [parSeconds, playAlertTone, state?.par.startedAt, state?.par.status]);
  const floorCount = state?.building.floorCount || data?.preplan?.floorCount || 1;
  const commandDisabled = !data?.canManage || saving || !online || Boolean(state?.closeout.endedAt);
  const onSceneUnits = [...new Set([...(data?.cadUnits ?? []), ...(state?.manualUnits ?? [])])];
  const stagedUnits = onSceneUnits.filter((unitId) => state?.units[unitId]?.status === "Staged" || state?.units[unitId]?.assignment === "Staging");
  const employeeName = (employeeId: string) => {
    if (employeeId.startsWith("manual:")) return employeeId.slice(7);
    const person = data?.personnel.find((candidate) => candidate.id === employeeId);
    return person ? formatEmployeeName(person.name) : "Assign";
  };
  const commandAssigneeLabel = (assignee: string) => {
    if (assignee.startsWith("unit:")) return assignee.slice(5);
    if (assignee.startsWith("manual:")) return assignee.slice(7);
    const person = data?.personnel.find((candidate) => candidate.id === assignee);
    return person ? formatEmployeeName(person.name) : assignee;
  };
  const saveCommandPosition = (position: typeof commandPositions[number], value: string) => {
    const label = value.trim().replace(/\s+/g, " ");
    if (label === commandAssigneeLabel(state?.positions[position] ?? "")) return;
    const unitId = onSceneUnits.find((candidate) => candidate.toLowerCase() === label.toLowerCase());
    void mutate({ action: "assign-position", position, assignee: unitId ? `unit:${unitId}` : label ? `manual:${label}` : "" });
  };
  const encodeChiefAssignee = (value: string) => {
    const label = value.trim().replace(/\s+/g, " ");
    if (!label) return "";
    const person = data?.personnel.find((candidate) => formatEmployeeName(candidate.name).toLowerCase() === label.toLowerCase());
    return person?.id ?? `manual:${label}`;
  };
  const addManualUnit = () => {
    const unitId = manualUnitDraft.trim().replace(/\s+/g, " ");
    if (!unitId) return setNotice("Enter a unit name or identifier.");
    setManualUnitDraft("");
    setShowManualUnitEntry(false);
    void mutate({ action: "add-manual-unit", unitId });
  };
  const unitsAtLevel = (level: string) => Object.entries(state?.units ?? {}).filter(([unitId, unit]) => onSceneUnits.includes(unitId) && unit.floor === level);

  const openAssignmentEditor = (
    unitId: string,
    placement: Partial<Pick<AssignmentDraft, "assignment" | "status" | "floor" | "side">> = {},
  ) => {
    if (!unitId) return setNotice("Select an on-scene unit first.");
    const current = state?.units[unitId] ?? { assignment: "Staging" as const, status: "Responding" as const, floor: "", side: "" as const, crewStrength: null };
    setSelectedUnit(unitId);
    setAssignmentDraft({
      unitId,
      assignment: placement.assignment ?? current.assignment,
      status: placement.status ?? current.status,
      floor: placement.floor ?? current.floor,
      side: placement.side ?? current.side,
      crewStrength: current.crewStrength,
    });
  };
  const saveAssignment = () => {
    if (!assignmentDraft) return;
    const draft = assignmentDraft;
    setAssignmentDraft(null);
    void mutate({ action: "assign-unit", ...draft });
  };
  const placeUnit = (side: "" | "A" | "B" | "C" | "D") => {
    if (!selectedUnit) return setNotice("Select an on-scene unit first.");
    openAssignmentEditor(selectedUnit, { floor: activeLevel, side, status: "On scene" });
  };
  const dropUnitOnFloor = (event: DragEvent<HTMLButtonElement>, level: string) => {
    event.preventDefault();
    const unitId = event.dataTransfer.getData("text/plain");
    if (!onSceneUnits.includes(unitId)) return setNotice("Only an on-scene incident unit can be dropped onto the building.");
    setSelectedLevel(level);
    openAssignmentEditor(unitId, { status: "On scene", floor: level, side: "" });
  };
  const dropUnitOnSide = (event: DragEvent<HTMLButtonElement>, side: "A" | "B" | "C" | "D") => {
    event.preventDefault();
    const unitId = event.dataTransfer.getData("text/plain");
    if (!onSceneUnits.includes(unitId)) return setNotice("Only an on-scene incident unit can be placed on a building side.");
    openAssignmentEditor(unitId, { status: "On scene", floor: activeLevel, side });
  };
  const dropUnitInRehab = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const unitId = event.dataTransfer.getData("text/plain");
    if (!onSceneUnits.includes(unitId)) return setNotice("Only an on-scene incident unit can be assigned to rehab.");
    openAssignmentEditor(unitId, { assignment: "Rehab", status: "Rehab", floor: "", side: "" });
  };
  const searchStatus = (level: string, phase: SearchPhase): SearchStatus => state?.searches[level]?.[phase] ?? "not_started";
  const changeSearch = (level: string, phase: SearchPhase) => {
    const current = searchStatus(level, phase);
    if (current === "not_started") void mutate({ action: "set-search", level, phase, status: "in_progress" });
    else if (current === "in_progress") setConfirm({ kind: "search", level, phase });
  };
  const cycleSupport = (resource: typeof supportResources[number]) => {
    const current = state?.support[resource] ?? "not_reported";
    const next = supportStatuses[(supportStatuses.indexOf(current) + 1) % supportStatuses.length];
    void mutate({ action: "set-support", resource, status: next });
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await boardRef.current?.requestFullscreen();
    } catch {
      setNotice("Full screen was blocked by the browser. Allow full-screen access and try again.");
    }
  };
  const confirmAction = async () => {
    const pending = confirm;
    setConfirm(null);
    if (!pending) return;
    if (pending.kind === "mayday") {
      await mutate({ action: "set-mayday", active: pending.active, confirmation: pending.active ? "CONFIRM MAYDAY" : "RESOLVE MAYDAY" });
    } else if (pending.kind === "search") {
      await mutate({ action: "set-search", level: pending.level, phase: pending.phase, status: "confirmed" });
    } else {
      await mutate({ action: "end-call", confirmation: "END INCIDENT" });
    }
  };

  if (loading && !data) return <section ref={boardRef} className="icb-page"><div className="icb-empty"><strong>Loading Command Board…</strong><span>Checking the active incident and command record.</span></div></section>;
  if (!data?.incident || !state) return <section ref={boardRef} className="icb-page icb-reference icb-idle">
    <header className="icb-reference-header">
      <button className="icb-brand" onClick={() => { window.location.href = window.location.pathname; }} aria-label="Return to operations portal"><b>SFD</b><span><small>STICKNEY FIRE DEPARTMENT</small><strong>COMMAND BOARD</strong></span></button>
      <div className="icb-no-call">NO ACTIVE INCIDENT</div>
      <button className="icb-fullscreen" onClick={() => void toggleFullscreen()}>{isFullscreen ? "EXIT FULL SCREEN" : "FULL SCREEN"}</button>
    </header>
    {notice && <div className="icb-notice">{notice}<button onClick={() => void load()}>Retry</button></div>}
    <div className="icb-idle-body">
      <div className="icb-idle-copy">
        <small>COMMAND WORKSPACE READY</small>
        <strong>Awaiting CAD incident</strong>
        <span>The active board will populate from the verified call, assigned units, and department command record.</span>
        <div>
          <span><i /> Incident and preplan</span>
          <span><i /> Units and assignments</span>
          <span><i /> PAR and benchmarks</span>
        </div>
      </div>
      <section className="icb-idle-preview" aria-label="Command Board active-incident layout preview">
        <header><span>ACTIVE-INCIDENT LAYOUT</span><b>PREVIEW · NOT ACTIVE</b></header>
        <div className="icb-preview-address"><small>INCIDENT HEADER</small><strong>CAD address and call type</strong><span>Report number · elapsed time · radio channel</span></div>
        <div className="icb-preview-grid">
          <article><small>UNITS & ASSIGNMENTS</small><b>Responding and on-scene crews</b><span>Command roles · staging · tactical location</span></article>
          <article><small>PAR / ACCOUNTABILITY</small><b>Countdown and crew confirmations</b><span>RIT · rehab · MAYDAY status</span></article>
          <article><small>TACTICAL BENCHMARKS</small><b>Searches, utilities, and fire control</b><span>Timestamped actions from command</span></article>
        </div>
      </section>
    </div>
  </section>;

  const confirmCopy = confirm?.kind === "mayday"
    ? {
        title: confirm.active ? "Activate MAYDAY / emergency traffic?" : "Resolve active MAYDAY?",
        description: confirm.active ? "This records a timestamped emergency event. Confirm only after the radio declaration." : "This records the MAYDAY as resolved. Confirm only after command announces the resolution.",
        label: confirm.active ? "Activate MAYDAY" : "Resolve MAYDAY",
        tone: "danger" as const,
      }
    : confirm?.kind === "search"
      ? {
          title: `Confirm ${confirm.phase} search?`,
          description: `${confirm.level} will be timestamped as confirmed complete under your identity.`,
          label: "Confirm Search",
          tone: "warning" as const,
        }
      : confirm?.kind === "end-call"
        ? {
            title: "End and lock this incident?",
            description: "This is the second and final action. The board will be locked, the incident termination will be timestamped, and the closeout report will be available to print or email.",
            label: "End Incident & Lock Board",
            tone: "danger" as const,
          }
      : { title: "", description: "", label: "", tone: "default" as const };

  const reportLines = [
    "STICKNEY FIRE DEPARTMENT — COMMAND BOARD REPORT",
    `${data.incident.address || "Address not provided"} — ${data.incident.callType || "Call type not provided"}`,
    `Report: ${data.incident.reportNumber || "Unavailable"}`,
    `Dispatched: ${new Date(data.incident.dispatchedAt).toLocaleString()}`,
    `Ended: ${state.closeout.endedAt ? new Date(state.closeout.endedAt).toLocaleString() : "Active"}`,
    "",
    "ACTIVITY HISTORY",
    ...data.events.slice().reverse().map((event) => `${new Date(event.createdAt).toLocaleString()} — ${event.summary} — ${event.actor}`),
  ];
  const emailReportHref = `mailto:?subject=${encodeURIComponent(`Command Board report ${data.incident.reportNumber || data.incident.address}`)}&body=${encodeURIComponent(reportLines.join("\n"))}`;

  return <section ref={boardRef} className={`icb-page icb-reference${state.mayday.active ? " mayday-active" : ""}`}>
    <ConfirmDialog open={Boolean(confirm)} title={confirmCopy.title} description={confirmCopy.description} confirmLabel={confirmCopy.label} tone={confirmCopy.tone} busy={saving} onCancel={() => setConfirm(null)} onConfirm={() => void confirmAction()} />

    {assignmentDraft && <div className="icb-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAssignmentDraft(null); }}>
      <section className="icb-quick-editor" role="dialog" aria-modal="true" aria-labelledby="icb-assignment-title">
        <header><div><small>UNIT ASSIGNMENT</small><strong id="icb-assignment-title">{assignmentDraft.unitId}</strong></div><button type="button" onClick={() => setAssignmentDraft(null)} aria-label="Close assignment editor">×</button></header>
        <div className="icb-quick-editor-grid">
          <label><span>Assignment</span><select value={assignmentDraft.assignment} onChange={(event) => setAssignmentDraft((current) => current ? { ...current, assignment: event.target.value as TacticalAssignment } : current)}>{tacticalAssignments.map((assignment) => <option key={assignment}>{assignment}</option>)}</select></label>
          <label><span>Status</span><select value={assignmentDraft.status} onChange={(event) => setAssignmentDraft((current) => current ? { ...current, status: event.target.value as AssignmentDraft["status"] } : current)}>{["Responding", "Staged", "On scene", "Rehab", "Released"].map((status) => <option key={status}>{status}</option>)}</select></label>
          <label><span>Level</span><select value={assignmentDraft.floor} onChange={(event) => setAssignmentDraft((current) => current ? { ...current, floor: event.target.value } : current)}><option value="">Outside / no level</option>{levels.map((level) => <option key={level}>{level}</option>)}</select></label>
          <label><span>Side</span><select value={assignmentDraft.side} onChange={(event) => setAssignmentDraft((current) => current ? { ...current, side: event.target.value as AssignmentDraft["side"] } : current)}><option value="">Inside / no side</option>{["A", "B", "C", "D"].map((side) => <option key={side}>{side}</option>)}</select></label>
          <label><span>Crew count</span><input type="number" inputMode="numeric" min="1" max="20" value={assignmentDraft.crewStrength ?? ""} onChange={(event) => setAssignmentDraft((current) => current ? { ...current, crewStrength: event.target.value ? Number(event.target.value) : null } : current)} placeholder="Not reported" /></label>
        </div>
        <p>{assignmentDraft.assignment === "Primary Search" ? "Saving starts the primary search for this level if it has not started." : assignmentDraft.assignment === "Rehab" ? "Saving moves the unit into Rehab automatically." : "Review the assignment and location, then save."}</p>
        <footer><button type="button" onClick={() => setAssignmentDraft(null)}>Cancel</button><button type="button" className="primary" disabled={commandDisabled} onClick={saveAssignment}>Save Assignment</button></footer>
      </section>
    </div>}

    {historyOpen && <aside className="icb-history-drawer" aria-label="Timestamped Command Board history">
      <header><div><small>DOCUMENTED ACTIVITY</small><strong>{data.events.length} timestamped changes</strong></div><button type="button" onClick={() => setHistoryOpen(false)} aria-label="Close history">×</button></header>
      <div>{data.events.length ? data.events.map((event) => <article key={event.id}><time>{new Date(event.createdAt).toLocaleString()}</time><strong>{event.summary}</strong><span>{event.actor} · revision {event.revision}</span></article>) : <p>No Command Board changes have been recorded yet.</p>}</div>
    </aside>}

    {state.closeout.endedAt && <section className="icb-closeout" role="dialog" aria-modal="true" aria-labelledby="icb-closeout-title">
      <small>INCIDENT ENDED · BOARD LOCKED</small>
      <h2 id="icb-closeout-title">Command report is ready</h2>
      <p>Ended {new Date(state.closeout.endedAt).toLocaleString()} by {state.closeout.endedBy}. All {data.events.length} recorded changes remain timestamped.</p>
      <div><button type="button" onClick={() => window.print()}>Print Report</button><a href={emailReportHref}>Email Report</a><button type="button" onClick={() => setHistoryOpen(true)}>View Activity</button><button type="button" className="secondary" onClick={() => { window.location.href = window.location.pathname; }}>Return to Portal</button></div>
    </section>}
    <section className="icb-print-report" aria-hidden="true">
      <h1>Stickney Fire Department — Command Board Report</h1>
      <p><strong>{data.incident.address || "Address not provided"}</strong><br />{data.incident.callType || "Call type not provided"} · Report {data.incident.reportNumber || "Unavailable"}</p>
      <p>Dispatched: {new Date(data.incident.dispatchedAt).toLocaleString()}<br />Ended: {state.closeout.endedAt ? new Date(state.closeout.endedAt).toLocaleString() : "Active"}</p>
      <h2>Timestamped activity</h2>
      {data.events.slice().reverse().map((event) => <article key={event.id}><time>{new Date(event.createdAt).toLocaleString()}</time><strong>{event.summary}</strong><span>{event.actor}</span></article>)}
    </section>

    <header className="icb-reference-header">
      <button className="icb-brand" onClick={() => { window.location.href = window.location.pathname; }} aria-label="Return to operations portal">
        <b>SFD</b>
        <span><small>STICKNEY FIRE DEPARTMENT</small><strong>COMMAND BOARD</strong></span>
      </button>
      <div className="icb-address"><strong>{data.incident.address || "Address not provided"}</strong><span>{data.incident.callType || "Call type not provided"} · #{data.incident.reportNumber || "Unavailable"}</span></div>
      <div className="icb-header-par"><span>PAR COUNTDOWN</span><strong className={parSeconds === 0 ? "due" : ""}>{parSeconds === 0 ? "DUE" : parText}</strong></div>
      <label className="icb-interval"><span>INTERVAL</span><select disabled={commandDisabled} value={state.par.intervalMinutes} onChange={(event) => void mutate({ action: "set-par-interval", intervalMinutes: Number(event.target.value) })}>{[10, 15, 20, 30].map((minutes) => <option key={minutes} value={minutes}>{minutes}</option>)}</select></label>
      <button className="icb-header-action" disabled={commandDisabled} onClick={() => { armAlertTone(); void mutate({ action: "toggle-par" }); }}>{state.par.status === "running" ? "Pause" : "Start"}</button>
      <button className="icb-header-action" disabled={commandDisabled} onClick={() => { armAlertTone(); alertedParRef.current = ""; void mutate({ action: "reset-par" }); }}>Reset</button>
      <label className="icb-radio"><span>RADIO CHANNEL</span><input disabled={!data.canManage} value={radioDraft} onChange={(event) => setRadioDraft(event.target.value)} onBlur={() => { if (radioDraft !== state.radioChannel) void mutate({ action: "set-radio", radioChannel: radioDraft }); }} placeholder="Not assigned" /></label>
      <button className="icb-fullscreen" onClick={() => void toggleFullscreen()}>{isFullscreen ? "EXIT FULL SCREEN" : "FULL SCREEN"}</button>
      <button className={`icb-mayday ${state.mayday.active ? "active" : ""}`} disabled={commandDisabled} onClick={() => setConfirm({ kind: "mayday", active: !state.mayday.active })}>{state.mayday.active ? "RESOLVE MAYDAY" : "MAYDAY"}</button>
    </header>

    <div className={`icb-status-line ${!online ? "offline" : data.connection.status}`}>
      <i /> <span>{!online ? "OFFLINE · LAST KNOWN INCIDENT SHOWN" : data.connection.label}</span>
      {data.preplan && <b>PREPLAN · {data.preplan.businessName || data.preplan.address || data.preplan.status || "MATCHED"}</b>}
      {!data.canManage && <b>READ ONLY</b>}
    </div>
    {notice && <div className="icb-notice" role="alert">{notice}<button onClick={() => setNotice("")}>Dismiss</button></div>}

    <div className="icb-reference-grid">
      <aside className="icb-reference-left">
        <section className="icb-dark-panel icb-command-positions">
          <header><span>COMMAND POSITIONS</span><small>{commandPositions.filter((position) => state.positions[position]).length} ROLES</small></header>
          <div className="icb-command-grid">
            <datalist id="icb-command-assignees">{onSceneUnits.map((unitId) => <option value={unitId} key={unitId}>On-scene unit</option>)}</datalist>
            {commandPositions.map((position, index) => <label className={index === 0 ? "primary" : ""} key={`${position}:${state.positions[position]}`}><span>{position.toUpperCase()}</span><input list="icb-command-assignees" disabled={commandDisabled} defaultValue={commandAssigneeLabel(state.positions[position])} placeholder="Type person, unit, or company" onBlur={(event) => saveCommandPosition(position, event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></label>)}
          </div>
        </section>

        <section className={`icb-dark-panel icb-onscene${unitsExpanded ? "" : " collapsed"}`}>
          <header><button type="button" className="icb-panel-toggle" aria-expanded={unitsExpanded} onClick={() => setUnitsExpanded((current) => !current)}><span>UNITS ON SCENE</span><b>{unitsExpanded ? "−" : "+"}</b></button><div className="icb-onscene-heading-actions"><small>{onSceneUnits.length} {onSceneUnits.length === 1 ? "UNIT" : "UNITS"}</small><button type="button" disabled={commandDisabled} aria-expanded={showManualUnitEntry} onClick={() => { setUnitsExpanded(true); setShowManualUnitEntry((current) => !current); }}>+ ADD UNIT</button></div></header>
          {unitsExpanded && <>
          {showManualUnitEntry && <form className="icb-add-unit-form" onSubmit={(event) => { event.preventDefault(); addManualUnit(); }}>
            <input autoFocus aria-label="Unit name or identifier" disabled={commandDisabled} maxLength={32} value={manualUnitDraft} onChange={(event) => setManualUnitDraft(event.target.value)} placeholder="Type unit, e.g. BC 1" />
            <button type="submit" disabled={commandDisabled || !manualUnitDraft.trim()}>ADD</button>
            <button type="button" disabled={commandDisabled} onClick={() => { setManualUnitDraft(""); setShowManualUnitEntry(false); }}>CANCEL</button>
          </form>}
          <div className="icb-unit-cards">{onSceneUnits.map((unitId, index) => {
            const unit = state.units[unitId];
            const draggable = !commandDisabled;
            return <button key={unitId} draggable={draggable} title={draggable ? "Drag this on-scene unit to a tactical floor" : undefined} style={{ "--unit-color": ["#d9932f", "#32a975", "#28a9d1"][index % 3] } as CSSProperties} className={selectedUnit === unitId ? "selected" : ""} onDragStart={(event) => { if (!draggable) return event.preventDefault(); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", unitId); setSelectedUnit(unitId); }} onClick={() => setSelectedUnit(unitId)}><strong>{unitId}</strong><span>{unit?.status || "Responding"}</span><i /></button>;
          })}</div>
          <div className="icb-stage-strip"><span>DRAG A UNIT, OR TAP IT THEN TAP A FLOOR / SIDE</span>{stagedUnits.map((unitId) => <button key={unitId} draggable={!commandDisabled} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", unitId); setSelectedUnit(unitId); }}>{unitId}</button>)}{stagedUnits.length === 0 && <small>Select a unit card above</small>}</div>
          </>}
        </section>

        <section className={`icb-dark-panel icb-assignment-panel${assignmentsExpanded ? "" : " collapsed"}`}>
          <header><button type="button" className="icb-panel-toggle" aria-expanded={assignmentsExpanded} onClick={() => setAssignmentsExpanded((current) => !current)}><span>ASSIGNMENT STATUS</span><b>{assignmentsExpanded ? "−" : "+"}</b></button><small>{onSceneUnits.length} {onSceneUnits.length === 1 ? "UNIT" : "UNITS"}</small></header>
          {assignmentsExpanded && <div className="icb-assignment-list">{onSceneUnits.map((unitId) => {
            const unit = state.units[unitId];
            const confirmed = state.par.confirmations[unitId];
            return <article key={unitId} className={selectedUnit === unitId ? "selected" : ""} onClick={() => setSelectedUnit(unitId)}>
              <div><strong>{unitId}</strong><small>{unit ? `${unit.floor || "No level"} · ${unit.side ? `Side ${unit.side}` : "No side"}` : "Not assigned"}</small></div>
              <button type="button" className="icb-edit-assignment" disabled={commandDisabled} onClick={(event) => { event.stopPropagation(); openAssignmentEditor(unitId); }}>{unit?.assignment || "Assign unit"}</button>
              <button className={confirmed ? "confirmed" : ""} disabled={commandDisabled || Boolean(confirmed)} onClick={(event) => { event.stopPropagation(); void mutate({ action: "confirm-par-unit", unitId }); }}>{confirmed ? "PAR ✓" : "PAR"}</button>
            </article>;
          })}</div>}
        </section>
      </aside>

      <main className="icb-reference-center">
        <section className="icb-dark-panel icb-building-panel">
          <header className="icb-building-heading">
            <div><span>TACTICAL WORKSHEET</span><h2>BUILDING PROFILE</h2></div>
            <div className="icb-building-settings">
              <label><span>BUILDING HEIGHT</span><select disabled={commandDisabled} value={floorCount} onChange={(event) => void mutate({ action: "set-building", floorCount: Number(event.target.value), basement: state.building.basement })}>{Array.from({ length: 20 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count} {count === 1 ? "Floor" : "Floors"}</option>)}</select></label>
              <label className="icb-basement"><input type="checkbox" disabled={commandDisabled} checked={state.building.basement === "present"} onChange={(event) => void mutate({ action: "set-building", floorCount, basement: event.target.checked ? "present" : "none" })} /><span>BASEMENT</span></label>
              <button type="button" className="icb-add-hazard" disabled={commandDisabled} onClick={() => { setHazardDraft({ label: "", floor: activeLevel, side: "" }); setHazardEditorOpen(true); }}>+ HAZARD</button>
            </div>
          </header>

          <nav className="icb-floor-tabs" aria-label="Building floors">{levels.map((level) => <button key={level} className={activeLevel === level ? "active" : ""} onClick={() => setSelectedLevel(level)}>{level}</button>)}</nav>

          {hazardEditorOpen && <form className="icb-hazard-editor" onSubmit={(event) => { event.preventDefault(); if (!hazardDraft.label.trim()) return setNotice("Select or type a hazard."); setHazardEditorOpen(false); void mutate({ action: "add-hazard", ...hazardDraft }); }}>
            <label><span>HAZARD</span><input autoFocus list="icb-hazard-options" value={hazardDraft.label} onChange={(event) => setHazardDraft((current) => ({ ...current, label: event.target.value }))} placeholder="Select or type a hazard" /><datalist id="icb-hazard-options">{hazardOptions.map((hazard) => <option key={hazard}>{hazard}</option>)}</datalist></label>
            <label><span>PLACE IT</span><select value={hazardDraft.side ? `side:${hazardDraft.side}` : `floor:${hazardDraft.floor}`} onChange={(event) => { const [kind, value] = event.target.value.split(":"); setHazardDraft((current) => kind === "side" ? { ...current, floor: "", side: value as TacticalHazard["side"] } : { ...current, floor: value, side: "" }); }}><optgroup label="Inside building">{levels.map((level) => <option key={level} value={`floor:${level}`}>{level}</option>)}</optgroup><optgroup label="Outside building">{["A", "B", "C", "D"].map((side) => <option key={side} value={`side:${side}`}>Side {side}</option>)}</optgroup></select></label>
            <button type="submit">Place Hazard</button><button type="button" onClick={() => setHazardEditorOpen(false)}>Cancel</button>
          </form>}

          <div className="icb-building-orientation">
            <button className="icb-side side-c" disabled={commandDisabled} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropUnitOnSide(event, "C")} onClick={() => placeUnit("C")}><b>C</b><span>SIDE C</span>{state.hazards.some((hazard) => hazard.side === "C") && <i title={state.hazards.filter((hazard) => hazard.side === "C").map((hazard) => hazard.label).join(", ")}>!</i>}</button>
            <button className="icb-side side-b" disabled={commandDisabled} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropUnitOnSide(event, "B")} onClick={() => placeUnit("B")}><b>B</b><span>SIDE B</span>{state.hazards.some((hazard) => hazard.side === "B") && <i title={state.hazards.filter((hazard) => hazard.side === "B").map((hazard) => hazard.label).join(", ")}>!</i>}</button>
            <div className="icb-building-stack" aria-label="Selectable stacked building floors">
              {levels.map((level, index) => {
                const floorUnits = unitsAtLevel(level);
                return <button key={level} className={`icb-building-floor${activeLevel === level ? " active" : ""}`} style={{ "--floor-order": index } as CSSProperties} onDragOver={(event) => { if (!commandDisabled) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }} onDrop={(event) => dropUnitOnFloor(event, level)} onClick={() => setSelectedLevel(level)}>
                  <span>LEVEL {levels.length - index}</span>
                  <strong>{level}</strong>
                  <div>{floorUnits.length ? floorUnits.map(([unitId, unit]) => <b key={unitId} title={`${unit.assignment} · Side ${unit.side || "unassigned"}`}>{unitId}<small>{unit.side || "—"}</small></b>) : <em>No crews assigned</em>}{state.hazards.filter((hazard) => hazard.floor === level && !hazard.side).map((hazard) => <span className="icb-hazard-chip" key={hazard.id} title={`${hazard.label} · recorded ${formatTime(hazard.createdAt)}`}>⚠ {hazard.label}</span>)}</div>
                </button>;
              })}
            </div>
            <button className="icb-side side-d" disabled={commandDisabled} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropUnitOnSide(event, "D")} onClick={() => placeUnit("D")}><b>D</b><span>SIDE D</span>{state.hazards.some((hazard) => hazard.side === "D") && <i title={state.hazards.filter((hazard) => hazard.side === "D").map((hazard) => hazard.label).join(", ")}>!</i>}</button>
            <button className="icb-side side-a" disabled={commandDisabled} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropUnitOnSide(event, "A")} onClick={() => placeUnit("A")}><b>A</b><span>A · ADDRESS SIDE</span>{state.hazards.some((hazard) => hazard.side === "A") && <i title={state.hazards.filter((hazard) => hazard.side === "A").map((hazard) => hazard.label).join(", ")}>!</i>}</button>
          </div>
          <div className="icb-building-instruction"><span>SELECTED TACTICAL LEVEL</span><strong>{activeLevel}</strong><small>{selectedUnit ? `${selectedUnit} selected · Tap A, B, C, or D to place` : "Select a unit, then select its building side"}</small></div>
        </section>

        <div className="icb-lower-center">
          <section className="icb-dark-panel icb-rehab-sector" onDragOver={(event) => { if (!commandDisabled) event.preventDefault(); }} onDrop={dropUnitInRehab}>
            <header><span>REHAB SECTOR</span><small>{rehabDraft.unitIds.length} UNITS</small></header>
            <div className="icb-rehab-fields">
              <label><span>REHAB CREW / AMBULANCE</span><div className="icb-rehab-units">{onSceneUnits.map((unitId) => <button type="button" key={unitId} className={rehabDraft.unitIds.includes(unitId) ? "active" : ""} disabled={!data.canManage} onClick={() => setRehabDraft((current) => ({ ...current, unitIds: current.unitIds.includes(unitId) ? current.unitIds.filter((unit) => unit !== unitId) : [...current.unitIds, unitId] }))}>{unitId}</button>)}</div></label>
              <label><span>REHAB CHIEF</span><datalist id="icb-rehab-chief-suggestions">{data.personnel.map((person) => <option key={person.id} value={formatEmployeeName(person.name)}>{person.rank}</option>)}</datalist><input list="icb-rehab-chief-suggestions" disabled={!data.canManage} maxLength={80} value={commandAssigneeLabel(rehabDraft.chiefEmployeeId)} onChange={(event) => setRehabDraft((current) => ({ ...current, chiefEmployeeId: encodeChiefAssignee(event.target.value) }))} placeholder="Select or type chief name/unit" /></label>
              <label className="icb-rehab-note"><span>REHAB ASSIGNMENT / LOCATION</span><input disabled={!data.canManage} maxLength={120} value={rehabDraft.assignmentNote} onChange={(event) => setRehabDraft((current) => ({ ...current, assignmentNote: event.target.value }))} placeholder="Type assignment or rehab location" /></label>
              <button disabled={commandDisabled} onClick={() => void mutate({ action: "set-rehab", ...rehabDraft })}>SAVE REHAB</button>
            </div>
          </section>

          <section className="icb-dark-panel icb-rit-team">
            <header><span>RIT TEAM</span><small className={ritDraft.readiness === "ready" ? "ready" : ""}>{sentence(ritDraft.readiness)}</small></header>
            <div className="icb-rit-fields">
              <label><span>RIT CHIEF</span><select disabled={!data.canManage} value={ritDraft.chiefEmployeeId} onChange={(event) => setRitDraft((current) => ({ ...current, chiefEmployeeId: event.target.value }))}><option value="">Assign chief</option>{data.personnel.map((person) => <option key={person.id} value={person.id}>{formatEmployeeName(person.name)}</option>)}</select></label>
              <label><span>RIT UNIT</span><select disabled={!data.canManage} value={ritDraft.unitId} onChange={(event) => setRitDraft((current) => ({ ...current, unitId: event.target.value }))}><option value="">Assign unit</option>{onSceneUnits.map((unitId) => <option key={unitId}>{unitId}</option>)}</select></label>
              <label><span>READINESS</span><select disabled={!data.canManage} value={ritDraft.readiness} onChange={(event) => setRitDraft((current) => ({ ...current, readiness: event.target.value as typeof current.readiness }))}><option value="not_reported">Not reported</option><option value="assembling">Assembling</option><option value="ready">Ready</option></select></label>
              <button disabled={commandDisabled} onClick={() => void mutate({ action: "set-rit", ...ritDraft })}>SAVE RIT</button>
            </div>
          </section>
        </div>
      </main>

      <aside className="icb-reference-right">
        <section className="icb-dark-panel icb-search-panel">
          <header><span>SEARCH PROGRESS</span><small>PAR / SEARCH</small></header>
          <div className="icb-search-head"><span>LEVEL</span>{searchPhases.map((phase) => <span key={phase}>{phase.toUpperCase()}</span>)}</div>
          <div className="icb-search-grid">{levels.map((level) => <div className="icb-search-row" key={level}><strong>{level}</strong>{searchPhases.map((phase) => {
            const status = searchStatus(level, phase);
            return <button key={phase} className={status} disabled={commandDisabled || status === "confirmed"} onClick={() => changeSearch(level, phase)}><i />{status === "not_started" ? "—" : status === "in_progress" ? "ACTIVE" : "CLEAR"}</button>;
          })}</div>)}</div>
          <div className="icb-search-key"><span><i className="active" /> ACTIVE</span><span><i className="clear" /> CLEAR</span></div>
        </section>

        <section className="icb-dark-panel icb-rehab-list" onDragOver={(event) => { if (!commandDisabled) event.preventDefault(); }} onDrop={dropUnitInRehab}>
          <header><span>UNITS IN REHAB</span><small>{state.rehab.unitIds.length}</small></header>
          <div>{state.rehab.unitIds.length ? state.rehab.unitIds.map((unitId) => <article key={unitId}><strong>{unitId}</strong><span>{state.rehab.assignmentNote || employeeName(state.rehab.chiefEmployeeId)}</span></article>) : <p>Drag a unit here to assign it to rehab</p>}</div>
        </section>

        <section className="icb-dark-panel icb-utilities">
          <header><span>UTILITIES &amp; SUPPORT</span><small>RESOURCE STATUS</small></header>
          <div className="icb-utility-head"><span>RESOURCE</span><span>NEEDED</span><span>CALLED</span><span>EN ROUTE</span><span>ON SCENE</span></div>
          {supportResources.map((resource) => <button key={resource} disabled={commandDisabled} onClick={() => cycleSupport(resource)}><strong>{resource}</strong>{(["needed", "called", "en_route", "on_scene"] as const).map((status) => <i className={state.support[resource] === status ? "active" : ""} key={status} />)}</button>)}
        </section>
      </aside>
    </div>

    <footer className="icb-reference-footer">
      <span>{saving ? "SAVING…" : "BOARD READY"} · REV {state.revision}</span>
      <span>LAST CHANGE {formatTime(state.updatedAt)} · {state.updatedBy || "NONE"}</span>
      <div className="icb-footer-actions"><button type="button" onClick={() => setHistoryOpen(true)}>HISTORY · {data.events.length}</button><button type="button" className="end" disabled={commandDisabled || state.mayday.active} onClick={() => setConfirm({ kind: "end-call" })}>END CALL</button><span>{data.incident.source} · RECEIVED {formatTime(data.incident.receivedAt)}</span></div>
    </footer>
  </section>;
}
