"use client";

import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import ConfirmDialog from "./confirm-dialog";
import { formatEmployeeName } from "./employee-names";
import {
  benchmarkLabels,
  commandPositions,
  searchPhases,
  supportResources,
  supportStatuses,
  tacticalAssignments,
  tacticalLevels,
  unitStatuses,
  type CommandAction,
  type IncidentCommandState,
  type SearchPhase,
  type SearchStatus,
  type TacticalAssignment,
} from "./incident-command-state";

type Incident = {
  incidentId: string; reportNumber: string; callType: string; address: string; city: string;
  dispatchedAt: string; source: string; receivedAt: string;
};
type Personnel = { id: string; name: string; rank: string };
type Preplan = {
  id: string; businessName?: string; address?: string; floorCount?: number | null; construction?: string;
  accessInfo?: string; knoxBox?: string; alarmSystem?: string; riser?: string; fdc?: string;
  sprinklerSystem?: string; status?: string; updatedAt?: string;
  match?: { method: string; distanceFeet: number };
};
type AuditEvent = { id: string; revision: number; eventType: string; summary: string; actor: string; createdAt: string };
type BoardData = {
  incident: Incident | null; preplan: Preplan | null; personnel: Personnel[]; cadUnits: string[];
  state: IncidentCommandState | null; events: AuditEvent[]; canManage: boolean;
  connection: { status: string; label: string; stale: boolean; lastUpdatedAt: string | null };
  generatedAt: string; error?: string;
};
type ConfirmState =
  | { kind: "mayday"; active: boolean }
  | { kind: "search"; level: string; phase: SearchPhase }
  | { kind: "benchmark"; benchmark: typeof benchmarkLabels[number] }
  | null;

const formatTime = (value?: string | null) => value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Not recorded";
const sentence = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const preplanValue = (value: unknown) => String(value ?? "").trim() || "Not documented";

export default function IncidentCommandBoard() {
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
  const [floorDraft, setFloorDraft] = useState("");
  const [basementDraft, setBasementDraft] = useState<IncidentCommandState["building"]["basement"]>("unknown");
  const [ritDraft, setRitDraft] = useState({ unitId: "", chiefEmployeeId: "", readiness: "not_reported" as IncidentCommandState["rit"]["readiness"] });
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
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(timer);
      window.clearTimeout(initialLoad);
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, [load, saving]);

  useEffect(() => {
    if (!data?.state) return;
    const timeout = window.setTimeout(() => {
      setRadioDraft(data.state?.radioChannel ?? "");
      setFloorDraft(String(data.state?.building.floorCount ?? data.preplan?.floorCount ?? ""));
      setBasementDraft(data.state?.building.basement ?? "unknown");
      setRitDraft(data.state?.rit ?? { unitId: "", chiefEmployeeId: "", readiness: "not_reported" });
      setRehabDraft(data.state?.rehab ?? { unitIds: [], chiefEmployeeId: "" });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [data?.incident?.incidentId, data?.state, data?.preplan?.floorCount]);

  const mutate = useCallback(async (mutation: CommandAction) => {
    if (!data?.incident || !data.state || saving) return;
    if (!online) {
      setNotice("This browser is offline. The last known incident remains visible, but command changes cannot be saved until the connection returns.");
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
  const levels = useMemo(() => state ? tacticalLevels(state, data?.preplan?.floorCount) : ["Level unknown"], [data?.preplan?.floorCount, state]);
  const activeLevel = levels.includes(selectedLevel) ? selectedLevel : levels[0];

  const parSeconds = useMemo(() => {
    if (!state) return 0;
    if (state.par.status !== "running" || !state.par.startedAt) return state.par.remainingSeconds;
    return Math.max(0, state.par.remainingSeconds - Math.floor((clock - Date.parse(state.par.startedAt)) / 1000));
  }, [clock, state]);
  const parText = `${String(Math.floor(parSeconds / 60)).padStart(2, "0")}:${String(parSeconds % 60).padStart(2, "0")}`;
  const selected = selectedUnit ? state?.units[selectedUnit] : undefined;
  const assignTo = (assignment: TacticalAssignment, unitId = selectedUnit) => {
    if (!unitId) return setNotice("Select a CAD unit first.");
    void mutate({ action: "assign-unit", unitId, assignment, status: state?.units[unitId]?.status, floor: state?.units[unitId]?.floor, side: state?.units[unitId]?.side, crewStrength: state?.units[unitId]?.crewStrength });
  };
  const dropAssignment = (event: DragEvent<HTMLButtonElement>, assignment: TacticalAssignment) => {
    event.preventDefault();
    assignTo(assignment, event.dataTransfer.getData("text/plain"));
  };
  const setUnitLocation = (floor: string, side: "" | "A" | "B" | "C" | "D") => {
    if (!selectedUnit) return setNotice("Select a CAD unit first.");
    const unit = state?.units[selectedUnit];
    if (!unit) return setNotice("Assign the selected unit to a tactical function first.");
    void mutate({ action: "assign-unit", unitId: selectedUnit, assignment: unit.assignment, status: unit.status, floor, side, crewStrength: unit.crewStrength });
  };
  const searchStatus = (level: string, phase: SearchPhase): SearchStatus => state?.searches[level]?.[phase] ?? "not_started";
  const changeSearch = (level: string, phase: SearchPhase) => {
    const status = searchStatus(level, phase);
    if (status === "not_started") void mutate({ action: "set-search", level, phase, status: "in_progress" });
    else if (status === "in_progress") setConfirm({ kind: "search", level, phase });
  };
  const confirmAction = async () => {
    const pending = confirm;
    setConfirm(null);
    if (!pending) return;
    if (pending.kind === "mayday") await mutate({ action: "set-mayday", active: pending.active, confirmation: pending.active ? "CONFIRM MAYDAY" : "RESOLVE MAYDAY" });
    if (pending.kind === "search") await mutate({ action: "set-search", level: pending.level, phase: pending.phase, status: "confirmed" });
    if (pending.kind === "benchmark") await mutate({ action: "record-benchmark", benchmark: pending.benchmark });
  };

  if (loading && !data) return <section className="icb-page"><div className="icb-empty"><strong>Loading Command Board…</strong><span>Checking the active incident and command record.</span></div></section>;
  if (!data?.incident || !state) return <section className="icb-page">
    <header className="icb-header"><div><span>Stickney Fire Department</span><h1>Incident Command Board</h1></div><b className="icb-connection waiting">Awaiting CAD data</b></header>
    {notice && <div className="icb-notice" role="alert">{notice}<button onClick={() => void load()}>Retry</button></div>}
    <div className="icb-empty"><strong>No active incident</strong><span>The board will remain clear until an active CAD call or an open Daily Log call is received. No sample incident has been inserted.</span></div>
  </section>;

  const confirmCopy = confirm?.kind === "mayday"
    ? { title: confirm.active ? "Activate MAYDAY / emergency traffic?" : "Resolve active MAYDAY?", description: confirm.active ? "This creates a timestamped emergency event for the active incident. Confirm only after the radio declaration." : "This records the MAYDAY as resolved. Confirm only when command has announced the resolution.", label: confirm.active ? "Activate MAYDAY" : "Resolve MAYDAY", tone: "danger" as const }
    : confirm?.kind === "search"
      ? { title: `Confirm ${confirm.phase} search?`, description: `${confirm.level} will be recorded as confirmed complete with your identity and current time.`, label: "Confirm Search", tone: "warning" as const }
      : confirm?.kind === "benchmark"
        ? { title: `Record ${confirm.benchmark}?`, description: "This operational benchmark will be timestamped and added to the incident audit trail.", label: "Record Benchmark", tone: "warning" as const }
        : { title: "", description: "", label: "", tone: "default" as const };

  return <section className={`icb-page${state.mayday.active ? " mayday-active" : ""}`}>
    <ConfirmDialog open={Boolean(confirm)} title={confirmCopy.title} description={confirmCopy.description} confirmLabel={confirmCopy.label} tone={confirmCopy.tone} busy={saving} onCancel={() => setConfirm(null)} onConfirm={() => void confirmAction()} />
    <header className="icb-header">
      <div className="icb-title"><span>Stickney Fire Department · Incident Command</span><h1>{data.incident.callType || "Call type not provided"}</h1><p>{data.incident.address || "Address not provided"}{data.incident.city ? ` · ${data.incident.city}` : ""} · Call {data.incident.reportNumber || "number unavailable"}</p></div>
      <div className="icb-par">
        <span>PAR {state.par.intervalMinutes} MIN</span><strong className={parSeconds === 0 ? "due" : ""}>{parSeconds === 0 ? "DUE" : parText}</strong>
        <div><button disabled={!data.canManage || saving} onClick={() => void mutate({ action: "toggle-par" })}>{state.par.status === "running" ? "Pause" : "Start"}</button><button disabled={!data.canManage || saving} onClick={() => void mutate({ action: "reset-par" })}>Reset</button></div>
      </div>
      <div className="icb-head-controls">
        <b className={`icb-connection ${!online ? "offline" : data.connection.status}`}>{!online ? "Browser offline" : data.connection.label}</b>
        <label><span>PAR interval</span><select disabled={!data.canManage || saving} value={state.par.intervalMinutes} onChange={(event) => void mutate({ action: "set-par-interval", intervalMinutes: Number(event.target.value) })}>{[10, 15, 20, 30].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></label>
        <label><span>Radio / tactical channel</span><div><input disabled={!data.canManage} value={radioDraft} onChange={(event) => setRadioDraft(event.target.value)} placeholder="Not assigned" /><button disabled={!data.canManage || saving} onClick={() => void mutate({ action: "set-radio", radioChannel: radioDraft })}>Save</button></div></label>
        <button className={`icb-mayday ${state.mayday.active ? "active" : ""}`} disabled={!data.canManage || saving} onClick={() => setConfirm({ kind: "mayday", active: !state.mayday.active })}>{state.mayday.active ? "RESOLVE MAYDAY" : "MAYDAY"}</button>
      </div>
    </header>
    {notice && <div className="icb-notice" role="alert">{notice}<button onClick={() => setNotice("")}>Dismiss</button></div>}
    {!online ? <div className="icb-readonly">Offline · Last known incident state is preserved. Command changes are unavailable until the connection returns.</div> : !data.canManage && <div className="icb-readonly">Read only · Operating controls require Incident Command permission.</div>}

    <div className="icb-grid">
      <aside className="icb-left">
        <section className="icb-panel">
          <header><div><span>Command structure</span><h2>Command Positions</h2></div></header>
          <div className="icb-positions">{commandPositions.map((position) => <label key={position}><span>{position}</span><select disabled={!data.canManage || saving} value={state.positions[position]} onChange={(event) => void mutate({ action: "assign-position", position, employeeId: event.target.value })}><option value="">Unassigned</option>{data.personnel.map((person) => <option value={person.id} key={person.id}>{formatEmployeeName(person.name)} · {person.rank}</option>)}</select></label>)}</div>
        </section>

        <section className="icb-panel">
          <header><div><span>CAD assigned</span><h2>Incident Units</h2></div><b>{data.cadUnits.length}</b></header>
          {data.cadUnits.length ? <div className="icb-units">{data.cadUnits.map((unitId) => {
            const unit = state.units[unitId];
            return <button key={unitId} draggable={data.canManage} onDragStart={(event) => event.dataTransfer.setData("text/plain", unitId)} className={selectedUnit === unitId ? "selected" : ""} onClick={() => setSelectedUnit(unitId)}>
              <strong>{unitId}</strong><span>{unit ? unit.assignment : "Not assigned"}</span><small>{unit ? `${unit.status}${unit.crewStrength ? ` · ${unit.crewStrength} members` : " · Crew strength unavailable"}` : "CAD responding · Crew strength unavailable"}</small>
            </button>;
          })}</div> : <p className="icb-empty-row">No responding units were supplied by CAD.</p>}
          <div className="icb-assignments">{tacticalAssignments.map((assignment) => <button key={assignment} disabled={!data.canManage || saving} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropAssignment(event, assignment)} onClick={() => assignTo(assignment)}><span>{assignment}</span><b>{Object.values(state.units).filter((unit) => unit.assignment === assignment).length}</b></button>)}</div>
        </section>

        {selectedUnit && <section className="icb-panel icb-unit-detail">
          <header><div><span>Selected CAD unit</span><h2>{selectedUnit}</h2></div></header>
          {!selected ? <p>Choose an assignment above to place this unit on the tactical board.</p> : <div>
            <label><span>Assignment</span><select disabled={!data.canManage || saving} value={selected.assignment} onChange={(event) => assignTo(event.target.value as TacticalAssignment)}>{tacticalAssignments.map((assignment) => <option key={assignment}>{assignment}</option>)}</select></label>
            <label><span>Status</span><select disabled={!data.canManage || saving} value={selected.status} onChange={(event) => void mutate({ action: "assign-unit", unitId: selectedUnit, assignment: selected.assignment, status: event.target.value as typeof selected.status, floor: selected.floor, side: selected.side, crewStrength: selected.crewStrength })}>{unitStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
            <label><span>Crew strength</span><input key={`${selectedUnit}-${selected.crewStrength ?? "unknown"}`} disabled={!data.canManage || saving} type="number" min="1" max="20" defaultValue={selected.crewStrength ?? ""} placeholder="Unavailable" onBlur={(event) => { if (event.target.value) void mutate({ action: "assign-unit", unitId: selectedUnit, assignment: selected.assignment, status: selected.status, floor: selected.floor, side: selected.side, crewStrength: Number(event.target.value) }); }} /></label>
          </div>}
        </section>}
      </aside>

      <main className="icb-center">
        <section className="icb-panel">
          <header><div><span>Department record</span><h2>Building Intelligence</h2></div><b className={data.preplan ? "available" : ""}>{data.preplan ? data.preplan.status || "Preplan found" : "No matched preplan"}</b></header>
          {data.preplan ? <><h3>{data.preplan.businessName || "Business name not documented"}</h3><p>{data.preplan.address || data.incident.address}</p><div className="icb-intel">
            <div><span>Construction</span><strong>{preplanValue(data.preplan.construction)}</strong></div>
            <div><span>Access</span><strong>{preplanValue(data.preplan.accessInfo)}</strong></div>
            <div><span>Knox box</span><strong>{preplanValue(data.preplan.knoxBox)}</strong></div>
            <div><span>Alarm</span><strong>{preplanValue(data.preplan.alarmSystem)}</strong></div>
            <div><span>Riser</span><strong>{preplanValue(data.preplan.riser)}</strong></div>
            <div><span>FDC</span><strong>{preplanValue(data.preplan.fdc)}</strong></div>
            <div><span>Sprinkler</span><strong>{preplanValue(data.preplan.sprinklerSystem)}</strong></div>
          </div><small className="icb-source">Matched by {data.preplan.match?.method || "department record"} · Record status: {data.preplan.status || "not supplied"} · Updated {data.preplan.updatedAt ? new Date(data.preplan.updatedAt).toLocaleString() : "time unavailable"}</small></> :
          <div className="icb-no-preplan"><strong>No department preplan matched this call</strong><span>Building facts remain unknown until command documents them. Nothing has been inferred.</span></div>}
        </section>

        <section className="icb-panel">
          <header><div><span>Operational worksheet</span><h2>Tactical Building</h2></div></header>
          <div className="icb-building-controls">
            <label><span>Floors</span><input type="number" min="1" max="99" disabled={!data.canManage} value={floorDraft} onChange={(event) => setFloorDraft(event.target.value)} placeholder={data.preplan?.floorCount ? String(data.preplan.floorCount) : "Unknown"} /></label>
            <label><span>Basement</span><select disabled={!data.canManage} value={basementDraft} onChange={(event) => setBasementDraft(event.target.value as typeof basementDraft)}><option value="unknown">Unknown</option><option value="present">Present</option><option value="none">None</option></select></label>
            <button disabled={!data.canManage || saving} onClick={() => void mutate({ action: "set-building", floorCount: floorDraft ? Number(floorDraft) : null, basement: basementDraft })}>Save Profile</button>
          </div>
          <div className="icb-building">
            <div className="icb-levels">{levels.map((level) => <button key={level} className={activeLevel === level ? "selected" : ""} onClick={() => setSelectedLevel(level)}><strong>{level}</strong><span>{Object.values(state.units).filter((unit) => unit.floor === level).map((unit) => unit.assignment).join(" · ") || "No crews placed"}</span></button>)}</div>
            <div className="icb-sides"><div className="side-a">SIDE A</div>{(["A", "B", "C", "D"] as const).map((side) => <button key={side} disabled={!data.canManage || saving} onClick={() => setUnitLocation(activeLevel, side)}><b>{side}</b><span>{Object.entries(state.units).filter(([, unit]) => unit.floor === activeLevel && unit.side === side).map(([unitId]) => unitId).join(", ") || "—"}</span></button>)}</div>
          </div>
          <div className="icb-placements"><span>Selected level: <b>{activeLevel}</b></span><button disabled={!data.canManage || saving || !selectedUnit} onClick={() => setUnitLocation(activeLevel, "")}>Place {selectedUnit || "selected unit"} on level</button></div>
        </section>

        <section className="icb-panel">
          <header><div><span>Accountability</span><h2>PAR Confirmations</h2></div><b>{Object.keys(state.par.confirmations).filter((unit) => data.cadUnits.includes(unit)).length}/{data.cadUnits.length}</b></header>
          <p className="icb-guidance">Each CAD unit must be confirmed individually. There is no global complete button.</p>
          <div className="icb-par-units">{data.cadUnits.map((unitId) => {
            const confirmation = state.par.confirmations[unitId];
            return <button key={unitId} className={confirmation ? "confirmed" : ""} disabled={!data.canManage || saving || Boolean(confirmation)} onClick={() => void mutate({ action: "confirm-par-unit", unitId })}><strong>{unitId}</strong><span>{confirmation ? `Confirmed ${formatTime(confirmation.confirmedAt)}` : "Confirm PAR"}</span></button>;
          })}</div>
        </section>
      </main>

      <aside className="icb-right">
        <section className="icb-panel">
          <header><div><span>Primary · Secondary · Final</span><h2>Search Matrix</h2></div></header>
          <div className="icb-search-table">{levels.map((level) => <div className="icb-search-row" key={level}><strong>{level}</strong>{searchPhases.map((phase) => {
            const status = searchStatus(level, phase);
            return <button key={phase} className={status} disabled={!data.canManage || saving || status === "confirmed"} onClick={() => changeSearch(level, phase)}><span>{sentence(phase)}</span><b>{sentence(status)}</b></button>;
          })}</div>)}</div>
          <p className="icb-guidance">A search marked in progress requires a second confirmation before it becomes complete.</p>
        </section>

        <section className="icb-panel">
          <header><div><span>Standby team</span><h2>RIT</h2></div></header>
          <div className="icb-form">
            <label><span>CAD unit</span><select disabled={!data.canManage} value={ritDraft.unitId} onChange={(event) => setRitDraft((current) => ({ ...current, unitId: event.target.value }))}><option value="">Not assigned</option>{data.cadUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
            <label><span>RIT chief / leader</span><select disabled={!data.canManage} value={ritDraft.chiefEmployeeId} onChange={(event) => setRitDraft((current) => ({ ...current, chiefEmployeeId: event.target.value }))}><option value="">Not assigned</option>{data.personnel.map((person) => <option value={person.id} key={person.id}>{formatEmployeeName(person.name)} · {person.rank}</option>)}</select></label>
            <label><span>Readiness</span><select disabled={!data.canManage} value={ritDraft.readiness} onChange={(event) => setRitDraft((current) => ({ ...current, readiness: event.target.value as typeof current.readiness }))}><option value="not_reported">Not reported</option><option value="assembling">Assembling</option><option value="ready">Ready</option></select></label>
            <button disabled={!data.canManage || saving} onClick={() => void mutate({ action: "set-rit", ...ritDraft })}>Save RIT</button>
          </div>
        </section>

        <section className="icb-panel">
          <header><div><span>Medical monitoring</span><h2>Rehab</h2></div></header>
          <label className="icb-select-label"><span>Rehab chief / leader</span><select disabled={!data.canManage} value={rehabDraft.chiefEmployeeId} onChange={(event) => setRehabDraft((current) => ({ ...current, chiefEmployeeId: event.target.value }))}><option value="">Not assigned</option>{data.personnel.map((person) => <option value={person.id} key={person.id}>{formatEmployeeName(person.name)} · {person.rank}</option>)}</select></label>
          <div className="icb-checks">{data.cadUnits.map((unitId) => <label key={unitId}><input type="checkbox" disabled={!data.canManage} checked={rehabDraft.unitIds.includes(unitId)} onChange={(event) => setRehabDraft((current) => ({ ...current, unitIds: event.target.checked ? [...current.unitIds, unitId] : current.unitIds.filter((unit) => unit !== unitId) }))} /><span>{unitId}</span></label>)}</div>
          <button className="icb-save" disabled={!data.canManage || saving} onClick={() => void mutate({ action: "set-rehab", ...rehabDraft })}>Save Rehab</button>
        </section>

        <section className="icb-panel">
          <header><div><span>Utilities and support</span><h2>Support Status</h2></div></header>
          <div className="icb-support">{supportResources.map((resource) => <label key={resource}><span>{resource}</span><select disabled={!data.canManage || saving} value={state.support[resource]} onChange={(event) => void mutate({ action: "set-support", resource, status: event.target.value as typeof state.support[typeof resource] })}>{supportStatuses.map((status) => <option value={status} key={status}>{sentence(status)}</option>)}</select></label>)}</div>
        </section>

        <section className="icb-panel">
          <header><div><span>Timestamped actions</span><h2>Benchmarks</h2></div></header>
          <div className="icb-benchmarks">{benchmarkLabels.map((benchmark) => {
            const recorded = state.benchmarks[benchmark];
            return <button key={benchmark} className={recorded ? "recorded" : ""} disabled={!data.canManage || saving || Boolean(recorded)} onClick={() => setConfirm({ kind: "benchmark", benchmark })}><strong>{benchmark}</strong><span>{recorded ? `${formatTime(recorded.recordedAt)} · ${recorded.recordedBy}` : "Record"}</span></button>;
          })}</div>
        </section>

        <section className="icb-panel">
          <header><div><span>Revision {state.revision}</span><h2>Incident Audit</h2></div></header>
          <div className="icb-audit">{data.events.length ? data.events.slice(0, 12).map((event) => <article key={event.id}><time>{formatTime(event.createdAt)}</time><div><strong>{event.summary}</strong><span>{event.actor} · Revision {event.revision}</span></div></article>) : <p>No command-board changes recorded yet.</p>}</div>
        </section>
      </aside>
    </div>
    <footer className="icb-footer"><span>Source: {data.incident.source} · Received {new Date(data.incident.receivedAt).toLocaleString()}</span><span>Last command change: {state.updatedAt ? `${new Date(state.updatedAt).toLocaleString()} by ${state.updatedBy}` : "None"}</span><span>{saving ? "Saving…" : online ? "Ready" : "Offline · changes disabled by connection"}</span></footer>
  </section>;
}
