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
  | null;

const sentence = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const formatTime = (value?: string | null) => value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

export default function IncidentCommandBoard() {
  const boardRef = useRef<HTMLElement>(null);
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
  const [ritDraft, setRitDraft] = useState({
    unitId: "",
    chiefEmployeeId: "",
    readiness: "not_reported" as IncidentCommandState["rit"]["readiness"],
  });
  const [rehabDraft, setRehabDraft] = useState({ unitIds: [] as string[], chiefEmployeeId: "" });

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
    const initialLoad = window.setTimeout(() => void load(), 0);
    const poll = window.setInterval(() => { if (!saving) void load(true); }, 10_000);
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
  }, [load, saving]);

  useEffect(() => {
    if (!data?.state) return;
    const timeout = window.setTimeout(() => {
      setRadioDraft(data.state?.radioChannel ?? "");
      setRitDraft(data.state?.rit ?? { unitId: "", chiefEmployeeId: "", readiness: "not_reported" });
      setRehabDraft(data.state?.rehab ?? { unitIds: [], chiefEmployeeId: "" });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [data?.incident?.incidentId, data?.state]);

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
      const payload = await response.json() as BoardData;
      if (!response.ok) {
        if (response.status === 409) await load(true);
        throw new Error(payload.error || "Unable to save the command-board update.");
      }
      await load(true);
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
  const floorCount = state?.building.floorCount || data?.preplan?.floorCount || 1;
  const commandDisabled = !data?.canManage || saving || !online;
  const stagedUnits = data?.cadUnits.filter((unitId) => state?.units[unitId]?.status === "Staged" || state?.units[unitId]?.assignment === "Staging") ?? [];
  const onSceneUnits = data?.cadUnits ?? [];
  const employeeName = (employeeId: string) => {
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
  const unitsAtLevel = (level: string) => Object.entries(state?.units ?? {}).filter(([unitId, unit]) => data?.cadUnits.includes(unitId) && unit.floor === level);

  const assignTo = (assignment: TacticalAssignment, unitId = selectedUnit) => {
    if (!unitId) return setNotice("Select a CAD unit first.");
    const unit = state?.units[unitId];
    void mutate({
      action: "assign-unit",
      unitId,
      assignment,
      status: unit?.status,
      floor: unit?.floor,
      side: unit?.side,
      crewStrength: unit?.crewStrength,
    });
  };
  const placeUnit = (side: "" | "A" | "B" | "C" | "D") => {
    if (!selectedUnit) return setNotice("Select a CAD unit first.");
    const unit = state?.units[selectedUnit];
    if (!unit) return setNotice("Assign the selected unit before placing it on the building.");
    void mutate({
      action: "assign-unit",
      unitId: selectedUnit,
      assignment: unit.assignment,
      status: unit.status,
      floor: activeLevel,
      side,
      crewStrength: unit.crewStrength,
    });
  };
  const dropUnitOnFloor = (event: DragEvent<HTMLButtonElement>, level: string) => {
    event.preventDefault();
    const unitId = event.dataTransfer.getData("text/plain");
    if (!onSceneUnits.includes(unitId)) return setNotice("Only an incident unit can be dropped onto the building.");
    const unit = state?.units[unitId] ?? { assignment: "Staging" as const, status: "Responding" as const, floor: "", side: "" as const, crewStrength: null };
    setSelectedUnit(unitId);
    setSelectedLevel(level);
    void mutate({
      action: "assign-unit",
      unitId,
      assignment: unit.assignment,
      status: "On scene",
      floor: level,
      side: "",
      crewStrength: unit.crewStrength,
    });
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
    } else {
      await mutate({ action: "set-search", level: pending.level, phase: pending.phase, status: "confirmed" });
    }
  };

  if (loading && !data) return <section ref={boardRef} className="icb-page"><div className="icb-empty"><strong>Loading Command Board…</strong><span>Checking the active incident and command record.</span></div></section>;
  if (!data?.incident || !state) return <section ref={boardRef} className="icb-page">
    <header className="icb-reference-header">
      <button className="icb-brand" onClick={() => { window.location.href = window.location.pathname; }} aria-label="Return to operations portal"><b>SFD</b><span><small>STICKNEY FIRE DEPARTMENT</small><strong>COMMAND BOARD</strong></span></button>
      <div className="icb-no-call">NO ACTIVE INCIDENT</div>
      <button className="icb-fullscreen" onClick={() => void toggleFullscreen()}>{isFullscreen ? "EXIT FULL SCREEN" : "FULL SCREEN"}</button>
    </header>
    {notice && <div className="icb-notice">{notice}<button onClick={() => void load()}>Retry</button></div>}
    <div className="icb-empty"><strong>Awaiting CAD incident</strong><span>No sample call or unit data has been added.</span></div>
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
      : { title: "", description: "", label: "", tone: "default" as const };

  return <section ref={boardRef} className={`icb-page icb-reference${state.mayday.active ? " mayday-active" : ""}`}>
    <ConfirmDialog open={Boolean(confirm)} title={confirmCopy.title} description={confirmCopy.description} confirmLabel={confirmCopy.label} tone={confirmCopy.tone} busy={saving} onCancel={() => setConfirm(null)} onConfirm={() => void confirmAction()} />

    <header className="icb-reference-header">
      <button className="icb-brand" onClick={() => { window.location.href = window.location.pathname; }} aria-label="Return to operations portal">
        <b>SFD</b>
        <span><small>STICKNEY FIRE DEPARTMENT</small><strong>COMMAND BOARD</strong></span>
      </button>
      <div className="icb-address"><strong>{data.incident.address || "Address not provided"}</strong><span>{data.incident.callType || "Call type not provided"} · #{data.incident.reportNumber || "Unavailable"}</span></div>
      <div className="icb-header-par"><span>PAR COUNTDOWN</span><strong className={parSeconds === 0 ? "due" : ""}>{parSeconds === 0 ? "DUE" : parText}</strong></div>
      <label className="icb-interval"><span>INTERVAL</span><select disabled={commandDisabled} value={state.par.intervalMinutes} onChange={(event) => void mutate({ action: "set-par-interval", intervalMinutes: Number(event.target.value) })}>{[10, 15, 20, 30].map((minutes) => <option key={minutes} value={minutes}>{minutes}</option>)}</select></label>
      <button className="icb-header-action" disabled={commandDisabled} onClick={() => void mutate({ action: "toggle-par" })}>{state.par.status === "running" ? "Pause" : "Start"}</button>
      <button className="icb-header-action" disabled={commandDisabled} onClick={() => void mutate({ action: "reset-par" })}>Reset</button>
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
            {commandPositions.map((position, index) => <label className={index === 0 ? "primary" : ""} key={`${position}:${state.positions[position]}`}><span>{position.toUpperCase()}</span><input list="icb-command-assignees" disabled={commandDisabled} defaultValue={commandAssigneeLabel(state.positions[position])} placeholder={onSceneUnits.length ? "Select on-scene unit or type name/unit" : "Type name or unit"} onBlur={(event) => saveCommandPosition(position, event.currentTarget.value)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></label>)}
          </div>
        </section>

        <section className="icb-dark-panel icb-onscene">
          <header><span>UNITS ON SCENE</span><small>{data.cadUnits.length} UNITS</small></header>
          <div className="icb-unit-cards">{data.cadUnits.map((unitId, index) => {
            const unit = state.units[unitId];
            const draggable = !commandDisabled;
            return <button key={unitId} draggable={draggable} title={draggable ? "Drag this on-scene unit to a tactical floor" : undefined} style={{ "--unit-color": ["#d9932f", "#32a975", "#28a9d1"][index % 3] } as CSSProperties} className={selectedUnit === unitId ? "selected" : ""} onDragStart={(event) => { if (!draggable) return event.preventDefault(); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", unitId); setSelectedUnit(unitId); }} onClick={() => setSelectedUnit(unitId)}><strong>{unitId}</strong><span>{unit?.status || "Responding"}</span><i /></button>;
          })}</div>
          <div className="icb-stage-strip"><span>STAGED OR ON SCENE · DRAG TO A FLOOR</span>{stagedUnits.map((unitId) => <button key={unitId} draggable={!commandDisabled} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", unitId); setSelectedUnit(unitId); }}>{unitId}</button>)}{stagedUnits.length === 0 && <small>Drag an on-scene unit card above</small>}</div>
        </section>

        <section className="icb-dark-panel icb-assignment-panel">
          <header><span>ASSIGNMENT STATUS</span><small>{data.cadUnits.length} UNITS</small></header>
          <div className="icb-assignment-list">{data.cadUnits.map((unitId) => {
            const unit = state.units[unitId];
            const confirmed = state.par.confirmations[unitId];
            return <article key={unitId} className={selectedUnit === unitId ? "selected" : ""} onClick={() => setSelectedUnit(unitId)}>
              <div><strong>{unitId}</strong><small>{unit ? `${unit.floor || "No level"} · ${unit.side ? `Side ${unit.side}` : "No side"}` : "Not assigned"}</small></div>
              <select aria-label={`${unitId} assignment`} disabled={commandDisabled} value={unit?.assignment || ""} onChange={(event) => assignTo(event.target.value as TacticalAssignment, unitId)}><option value="">Assign</option>{tacticalAssignments.map((assignment) => <option key={assignment}>{assignment}</option>)}</select>
              <button className={confirmed ? "confirmed" : ""} disabled={commandDisabled || Boolean(confirmed)} onClick={(event) => { event.stopPropagation(); void mutate({ action: "confirm-par-unit", unitId }); }}>{confirmed ? "PAR ✓" : "PAR"}</button>
            </article>;
          })}</div>
        </section>
      </aside>

      <main className="icb-reference-center">
        <section className="icb-dark-panel icb-building-panel">
          <header className="icb-building-heading">
            <div><span>TACTICAL WORKSHEET</span><h2>BUILDING PROFILE</h2></div>
            <div className="icb-building-settings">
              <label><span>BUILDING HEIGHT</span><select disabled={commandDisabled} value={floorCount} onChange={(event) => void mutate({ action: "set-building", floorCount: Number(event.target.value), basement: state.building.basement })}>{Array.from({ length: 20 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count} {count === 1 ? "Floor" : "Floors"}</option>)}</select></label>
              <label className="icb-basement"><input type="checkbox" disabled={commandDisabled} checked={state.building.basement === "present"} onChange={(event) => void mutate({ action: "set-building", floorCount, basement: event.target.checked ? "present" : "none" })} /><span>BASEMENT</span></label>
            </div>
          </header>

          <nav className="icb-floor-tabs" aria-label="Building floors">{levels.map((level) => <button key={level} className={activeLevel === level ? "active" : ""} onClick={() => setSelectedLevel(level)}>{level}</button>)}</nav>

          <div className="icb-building-orientation">
            <button className="icb-side side-c" disabled={commandDisabled} onClick={() => placeUnit("C")}><b>C</b><span>SIDE C</span></button>
            <button className="icb-side side-b" disabled={commandDisabled} onClick={() => placeUnit("B")}><b>B</b><span>SIDE B</span></button>
            <div className="icb-building-stack" aria-label="Selectable stacked building floors">
              {levels.map((level, index) => {
                const floorUnits = unitsAtLevel(level);
                return <button key={level} className={`icb-building-floor${activeLevel === level ? " active" : ""}`} style={{ "--floor-order": index } as CSSProperties} onDragOver={(event) => { if (!commandDisabled) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }} onDrop={(event) => dropUnitOnFloor(event, level)} onClick={() => setSelectedLevel(level)}>
                  <span>LEVEL {levels.length - index}</span>
                  <strong>{level}</strong>
                  <div>{floorUnits.length ? floorUnits.map(([unitId, unit]) => <b key={unitId} title={`${unit.assignment} · Side ${unit.side || "unassigned"}`}>{unitId}<small>{unit.side || "—"}</small></b>) : <em>No crews assigned</em>}</div>
                </button>;
              })}
            </div>
            <button className="icb-side side-d" disabled={commandDisabled} onClick={() => placeUnit("D")}><b>D</b><span>SIDE D</span></button>
            <button className="icb-side side-a" disabled={commandDisabled} onClick={() => placeUnit("A")}><b>A</b><span>A · ADDRESS SIDE</span></button>
          </div>
          <div className="icb-building-instruction"><span>SELECTED TACTICAL LEVEL</span><strong>{activeLevel}</strong><small>{selectedUnit ? `${selectedUnit} selected · Tap A, B, C, or D to place` : "Select a unit, then select its building side"}</small></div>
        </section>

        <div className="icb-lower-center">
          <section className="icb-dark-panel icb-rehab-sector">
            <header><span>REHAB SECTOR</span><small>{rehabDraft.unitIds.length} UNITS</small></header>
            <div className="icb-rehab-fields">
              <label><span>REHAB CREW / AMBULANCE</span><div className="icb-rehab-units">{data.cadUnits.map((unitId) => <button key={unitId} className={rehabDraft.unitIds.includes(unitId) ? "active" : ""} disabled={!data.canManage} onClick={() => setRehabDraft((current) => ({ ...current, unitIds: current.unitIds.includes(unitId) ? current.unitIds.filter((unit) => unit !== unitId) : [...current.unitIds, unitId] }))}>{unitId}</button>)}</div></label>
              <label><span>REHAB CHIEF</span><select disabled={!data.canManage} value={rehabDraft.chiefEmployeeId} onChange={(event) => setRehabDraft((current) => ({ ...current, chiefEmployeeId: event.target.value }))}><option value="">Assign chief</option>{data.personnel.map((person) => <option key={person.id} value={person.id}>{formatEmployeeName(person.name)}</option>)}</select></label>
              <button disabled={commandDisabled} onClick={() => void mutate({ action: "set-rehab", ...rehabDraft })}>SAVE REHAB</button>
            </div>
          </section>

          <section className="icb-dark-panel icb-rit-team">
            <header><span>RIT TEAM</span><small className={ritDraft.readiness === "ready" ? "ready" : ""}>{sentence(ritDraft.readiness)}</small></header>
            <div className="icb-rit-fields">
              <label><span>RIT CHIEF</span><select disabled={!data.canManage} value={ritDraft.chiefEmployeeId} onChange={(event) => setRitDraft((current) => ({ ...current, chiefEmployeeId: event.target.value }))}><option value="">Assign chief</option>{data.personnel.map((person) => <option key={person.id} value={person.id}>{formatEmployeeName(person.name)}</option>)}</select></label>
              <label><span>RIT UNIT</span><select disabled={!data.canManage} value={ritDraft.unitId} onChange={(event) => setRitDraft((current) => ({ ...current, unitId: event.target.value }))}><option value="">Assign unit</option>{data.cadUnits.map((unitId) => <option key={unitId}>{unitId}</option>)}</select></label>
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

        <section className="icb-dark-panel icb-rehab-list">
          <header><span>UNITS IN REHAB</span><small>{state.rehab.unitIds.length}</small></header>
          <div>{state.rehab.unitIds.length ? state.rehab.unitIds.map((unitId) => <article key={unitId}><strong>{unitId}</strong><span>{employeeName(state.rehab.chiefEmployeeId)}</span></article>) : <p>No units assigned to rehab</p>}</div>
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
      <span>{data.incident.source} · RECEIVED {formatTime(data.incident.receivedAt)}</span>
    </footer>
  </section>;
}
