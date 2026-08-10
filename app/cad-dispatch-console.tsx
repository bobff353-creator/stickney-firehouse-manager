"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Unit = {
  id: string; unitNumber: string; name: string; unitType: string; agency: string; station: string;
  status: string; statusSince: string; activeIncidentId: string;
  latitude: number | null; longitude: number | null; heading: number | null; speed: number | null; locationAt: string | null; source: string;
};
type Incident = { incidentId: string; callType: string; category: string; address: string; city: string; respondingUnits: string; longitude: number | null; latitude: number | null; dispatchedAt: string; source: string };
type Note = { id: string; incidentId: string; sequence: number; note: string; category: string; author: string; source: string; agency: string; unitNumber: string; eventAt: string };
type Agency = { id: string; name: string; agencyType: string; contact: string; outboundUrl: string; subscriptions: string; active: number; lastInboundAt: string | null; lastOutboundAt: string | null; hasSecret: number; inboundToken?: string };
type Delivery = { id: string; agencyName: string; eventType: string; incidentId: string; status: string; statusCode: number | null; error: string; createdAt: string };
type Panel = { id: string; name: string; monitorAccount: string; address: string; latitude: number | null; longitude: number | null; protocol: string; autoCreateIncident: number; active: number; lastSignalAt: string | null; inboundToken?: string };
type AlarmEvent = { id: string; panelId: string; panelName: string; signalType: string; zone: string; description: string; priority: string; incidentId: string; eventAt: string; acknowledgedAt: string | null; acknowledgedBy: string };
type Recommendation = { unitNumber: string; name: string; unitType: string; agency: string; status: string; distanceMiles: number | null; dispatchable: boolean; latitude: number | null; longitude: number | null };

type Snapshot = {
  viewer: { email: string; isAdmin: boolean; displayName: string };
  generatedAt: string; unitStatuses: string[];
  units: Unit[]; incidents: Incident[]; notes: Note[]; agencies: Agency[]; deliveries: Delivery[]; panels: Panel[]; alarms: AlarmEvent[];
};

const statusLabels: Record<string, string> = {
  available: "Available", dispatched: "Dispatched", enroute: "En route", onscene: "On scene",
  transporting: "Transporting", returning: "Returning", out_of_service: "Out of service",
};

function clock(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-US", { timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" });
}
function since(value: string | null) {
  if (!value) return "";
  const ms = Date.now() - new Date(value).getTime();
  if (Number.isNaN(ms)) return "";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return hr < 24 ? `${hr}h ago` : `${Math.floor(hr / 24)}d ago`;
}
function locationFresh(value: string | null) {
  if (!value) return "none";
  const ms = Date.now() - new Date(value).getTime();
  return ms < 120000 ? "live" : ms < 900000 ? "recent" : "stale";
}

export default function CadDispatchConsole() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"dispatch" | "interop" | "alarms">("dispatch");
  const [selectedIncident, setSelectedIncident] = useState<string>("");
  const [noteText, setNoteText] = useState("");
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/cad/dispatch", { cache: "no-store" });
      const payload = await response.json() as Snapshot & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to load the CAD dispatch console.");
      setData(payload);
      setError("");
      setSelectedIncident((current) => current || payload.incidents[0]?.incidentId || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load the CAD dispatch console.");
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 6000);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); };
  }, [load]);

  const post = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const response = await fetch("/api/cad/dispatch", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(String(payload.error || "The dispatch action failed."));
      return payload;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The dispatch action failed.");
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const incidentNotes = useMemo(() => (data?.notes ?? []).filter((note) => note.incidentId === selectedIncident).sort((a, b) => a.sequence - b.sequence), [data?.notes, selectedIncident]);
  const selected = useMemo(() => data?.incidents.find((incident) => incident.incidentId === selectedIncident) ?? null, [data?.incidents, selectedIncident]);

  async function recommend(incidentId: string) {
    setRecommendations(null);
    const result = await post({ action: "recommend", incidentId });
    if (result) setRecommendations((result.recommendations as Recommendation[]) ?? []);
  }
  async function dispatchUnit(unitNumber: string) {
    if (!selectedIncident) return;
    if (await post({ action: "assign", incidentId: selectedIncident, unitNumber })) { setRecommendations(null); await load(); }
  }
  async function changeStatus(unitNumber: string, status: string) {
    if (await post({ action: "status", unitNumber, status })) await load();
  }
  async function submitNote() {
    if (!selectedIncident || !noteText.trim()) return;
    if (await post({ action: "note", incidentId: selectedIncident, note: noteText.trim() })) { setNoteText(""); await load(); }
  }

  if (!data) {
    return <section className="cad-console"><div className="standard-page-header"><div><span className="page-icon">CAD</span><div><p className="eyebrow">Operations · Real time</p><h1>CAD Dispatch</h1></div></div></div>{error ? <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => void load()}>Retry</button></div> : <p className="cad-loading">Connecting to the dispatch service…</p>}</section>;
  }

  const availableUnits = data.units.filter((unit) => unit.status === "available").length;
  return (
    <section className="cad-console">
      <div className="standard-page-header">
        <div><span className="page-icon">CAD</span><div><p className="eyebrow">Operations · Real time</p><h1>CAD Dispatch</h1><p>Closest-unit dispatching, live apparatus location, real-time incident notes, and mutual-aid webhooks.</p></div></div>
        <div className="cad-live-indicator"><span className="cad-live-dot" /> Live · updated {clock(data.generatedAt)}</div>
      </div>

      {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => setError("")}>Dismiss</button></div>}

      <div className="cad-summary-row">
        <div><strong>{data.units.length}</strong><span>Units tracked</span></div>
        <div><strong>{availableUnits}</strong><span>Available</span></div>
        <div><strong>{data.incidents.length}</strong><span>Active incidents</span></div>
        <div><strong>{data.alarms.filter((event) => !event.acknowledgedAt).length}</strong><span>Unacknowledged alarms</span></div>
      </div>

      <nav className="cad-tabs">
        <button className={tab === "dispatch" ? "active" : ""} onClick={() => setTab("dispatch")}>Dispatch board</button>
        <button className={tab === "interop" ? "active" : ""} onClick={() => setTab("interop")}>Agency interop</button>
        <button className={tab === "alarms" ? "active" : ""} onClick={() => setTab("alarms")}>Alarm monitoring</button>
      </nav>

      {tab === "dispatch" && <div className="cad-dispatch-grid">
        <section className="content-card cad-units-card">
          <div className="section-header"><div><h2>Apparatus &amp; units</h2><p>Live status and location feed</p></div></div>
          <div className="cad-unit-list">
            {data.units.length === 0 ? <div className="action-empty-state"><span>◎</span><div><strong>No units yet</strong><p>Units appear here once they report location, or when an administrator adds them.</p></div></div> :
              data.units.map((unit) => <div key={unit.id} className={`cad-unit-row status-${unit.status}`}>
                <div className="cad-unit-id"><strong>{unit.unitNumber}</strong><small>{unit.name !== unit.unitNumber ? unit.name : unit.unitType}{unit.agency && unit.agency !== "Stickney" ? ` · ${unit.agency}` : ""}</small></div>
                <div className="cad-unit-loc"><span className={`cad-loc-dot ${locationFresh(unit.locationAt)}`} />{unit.latitude != null && unit.longitude != null ? <span>{unit.latitude.toFixed(4)}, {unit.longitude.toFixed(4)}<small>{since(unit.locationAt)}</small></span> : <span className="cad-no-loc">No location<small>—</small></span>}</div>
                <div className="cad-unit-status"><span className={`cad-status-chip status-${unit.status}`}>{statusLabels[unit.status] ?? unit.status}</span>{unit.activeIncidentId && <small>on {unit.activeIncidentId}</small>}</div>
                <select aria-label={`Set status for ${unit.unitNumber}`} value={unit.status} disabled={busy} onChange={(event) => void changeStatus(unit.unitNumber, event.target.value)}>{data.unitStatuses.map((status) => <option key={status} value={status}>{statusLabels[status] ?? status}</option>)}</select>
              </div>)}
          </div>
        </section>

        <section className="content-card cad-incidents-card">
          <div className="section-header"><div><h2>Active incidents</h2><p>Select an incident to dispatch and log notes</p></div></div>
          <div className="cad-incident-list">
            {data.incidents.length === 0 ? <div className="action-empty-state"><span>↯</span><div><strong>No active incidents</strong><p>Incidents from CAD feeds and alarm panels appear here.</p></div></div> :
              data.incidents.map((incident) => <button key={incident.incidentId} className={`cad-incident-row ${incident.incidentId === selectedIncident ? "selected" : ""}`} onClick={() => { setSelectedIncident(incident.incidentId); setRecommendations(null); }}>
                <div><strong>{incident.callType}</strong><small>{incident.address || "Location pending"}{incident.city ? `, ${incident.city}` : ""}</small></div>
                <div className="cad-incident-meta"><span>{incident.incidentId}</span><small>{clock(incident.dispatchedAt)}</small>{incident.latitude == null && <em className="cad-warn">unmapped</em>}</div>
              </button>)}
          </div>
        </section>

        <section className="content-card cad-incident-detail">
          {!selected ? <div className="action-empty-state"><span>›</span><div><strong>Select an incident</strong><p>Choose an incident to dispatch the closest units and log real-time notes.</p></div></div> : <>
            <div className="section-header"><div><h2>{selected.callType}</h2><p>{selected.incidentId} · {selected.address || "Location pending"}</p></div><button className="primary-action compact" disabled={busy} onClick={() => void recommend(selected.incidentId)}>Closest units</button></div>
            {selected.respondingUnits && <p className="cad-responding">Responding: <strong>{selected.respondingUnits}</strong></p>}
            {recommendations && <div className="cad-recommendations">{recommendations.length === 0 ? <p>No units available to rank.</p> : recommendations.map((unit) => <div key={unit.unitNumber} className={`cad-recommend-row ${unit.dispatchable ? "" : "committed"}`}>
              <div><strong>{unit.unitNumber}</strong><small>{unit.agency} · {statusLabels[unit.status] ?? unit.status}</small></div>
              <span className="cad-distance">{unit.distanceMiles == null ? "no GPS" : `${unit.distanceMiles.toFixed(1)} mi`}</span>
              <button className="quiet-button" disabled={busy || !unit.dispatchable} onClick={() => void dispatchUnit(unit.unitNumber)}>{unit.dispatchable ? "Dispatch" : "Committed"}</button>
            </div>)}</div>}

            <div className="cad-notes">
              <h3>Incident log</h3>
              <div className="cad-note-timeline">
                {incidentNotes.length === 0 ? <p className="cad-note-empty">No notes yet.</p> : incidentNotes.map((note) => <div key={note.id} className={`cad-note cat-${note.category}`}>
                  <span className="cad-note-time">{new Date(note.eventAt).toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                  <div><p>{note.note}</p><small>{note.category !== "note" ? `${note.category.replace(/_/g, " ")} · ` : ""}{note.author || note.agency || note.source}{note.source === "agency" ? ` (${note.agency})` : ""}</small></div>
                </div>)}
              </div>
              <div className="cad-note-input"><input value={noteText} disabled={busy} placeholder="Add a timestamped note…" onChange={(event) => setNoteText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submitNote(); }} /><button className="primary-action compact" disabled={busy || !noteText.trim()} onClick={() => void submitNote()}>Log</button></div>
            </div>
          </>}
        </section>
      </div>}

      {tab === "interop" && <InteropTab isAdmin={data.viewer.isAdmin} deliveries={data.deliveries} agencies={data.agencies} onChanged={load} onError={setError} />}
      {tab === "alarms" && <AlarmsTab isAdmin={data.viewer.isAdmin} events={data.alarms} onChanged={load} onError={setError} />}
    </section>
  );
}

function Copyable({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return <div className="cad-copyable"><span>{label}</span><code>{value}</code><button onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied" : "Copy"}</button></div>;
}

const eventTypeOptions = ["incident", "location", "note", "status", "alarm"];

function InteropTab({ isAdmin, deliveries, agencies, onChanged, onError }: { isAdmin: boolean; deliveries: Delivery[]; agencies: Agency[]; onChanged: () => Promise<void>; onError: (message: string) => void }) {
  const [admin, setAdmin] = useState<{ inboundUrl: string; agencies: Agency[] } | null>(null);
  const [name, setName] = useState("");
  const [agencyType, setAgencyType] = useState("cad");
  const [outboundUrl, setOutboundUrl] = useState("");
  const [outboundSecret, setOutboundSecret] = useState("");
  const [subs, setSubs] = useState<string[]>(["incident", "note"]);
  const [busy, setBusy] = useState(false);
  const [newToken, setNewToken] = useState<{ id: string; token: string } | null>(null);

  const loadAdmin = useCallback(async () => {
    if (!isAdmin) return;
    const response = await fetch("/api/cad/agencies", { cache: "no-store" });
    if (response.ok) setAdmin(await response.json());
  }, [isAdmin]);
  useEffect(() => { const timer = window.setTimeout(() => void loadAdmin(), 0); return () => window.clearTimeout(timer); }, [loadAdmin]);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch("/api/cad/agencies", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(String(payload.error || "Action failed."));
      return payload;
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Action failed.");
      return null;
    } finally { setBusy(false); }
  }

  async function create() {
    if (!name.trim()) return;
    const result = await act({ action: "create", name, agencyType, outboundUrl, outboundSecret, subscriptions: subs });
    if (result) { setNewToken({ id: String(result.id), token: String(result.inboundToken) }); setName(""); setOutboundUrl(""); setOutboundSecret(""); await loadAdmin(); await onChanged(); }
  }

  const list = admin?.agencies ?? agencies;
  return <div className="cad-interop">
    {isAdmin && admin && <section className="content-card">
      <div className="section-header"><div><h2>Add partner agency / vehicle feed</h2><p>Generates an inbound token for their CAD or apparatus clients, and optionally an outbound webhook we push events to.</p></div></div>
      <Copyable label="Inbound webhook URL" value={admin.inboundUrl} />
      <div className="cad-form-grid">
        <label>Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Cicero Consolidated Dispatch" /></label>
        <label>Type<select value={agencyType} onChange={(event) => setAgencyType(event.target.value)}><option value="cad">CAD agency</option><option value="fire">Fire department</option><option value="ems">EMS</option><option value="police">Police</option><option value="fleet">Own apparatus fleet</option></select></label>
        <label>Outbound URL (optional)<input value={outboundUrl} onChange={(event) => setOutboundUrl(event.target.value)} placeholder="https://partner.example/cad/inbound" /></label>
        <label>Outbound signing secret (optional)<input value={outboundSecret} onChange={(event) => setOutboundSecret(event.target.value)} placeholder="Shared HMAC secret" /></label>
      </div>
      <div className="cad-subs">Send events:{eventTypeOptions.map((type) => <label key={type}><input type="checkbox" checked={subs.includes(type)} onChange={(event) => setSubs((current) => event.target.checked ? [...current, type] : current.filter((item) => item !== type))} />{type}</label>)}</div>
      <button className="primary-action compact" disabled={busy || !name.trim()} onClick={() => void create()}>Create agency</button>
      {newToken && <div className="cad-token-reveal"><strong>Inbound token — shown once, store it now:</strong><Copyable label="Bearer token" value={newToken.token} /></div>}
    </section>}

    <section className="content-card">
      <div className="section-header"><div><h2>Connected agencies</h2><p>Bidirectional CAD peers and apparatus feeds</p></div></div>
      {list.length === 0 ? <div className="action-empty-state"><span>⇄</span><div><strong>No agencies yet</strong><p>{isAdmin ? "Add a partner agency above to exchange real-time CAD data." : "An administrator has not configured any CAD peers yet."}</p></div></div> :
        <div className="table-wrap"><table><thead><tr><th>Agency</th><th>Subscriptions</th><th>Outbound</th><th>Last in</th><th>Last out</th>{isAdmin && <th>Actions</th>}</tr></thead><tbody>
          {list.map((agency) => <tr key={agency.id}>
            <td><strong>{agency.name}</strong><small>{agency.agencyType}{agency.active ? "" : " · disabled"}</small></td>
            <td>{(() => { try { return (JSON.parse(agency.subscriptions) as string[]).join(", ") || "—"; } catch { return "—"; } })()}</td>
            <td>{agency.outboundUrl ? <span className="cad-ok">configured{agency.hasSecret ? " · signed" : ""}</span> : <span className="cad-muted">receive only</span>}</td>
            <td>{since(agency.lastInboundAt) || "—"}</td>
            <td>{since(agency.lastOutboundAt) || "—"}</td>
            {isAdmin && <td className="cad-row-actions">{agency.outboundUrl && <button disabled={busy} onClick={async () => { const result = await act({ action: "test", id: agency.id }); if (result) { await loadAdmin(); await onChanged(); } }}>Test</button>}<button disabled={busy} onClick={async () => { const result = await act({ action: "rotate", id: agency.id }); if (result) setNewToken({ id: agency.id, token: String(result.inboundToken) }); }}>Rotate</button><button disabled={busy} className="cad-danger" onClick={async () => { if (await act({ action: "delete", id: agency.id })) { await loadAdmin(); await onChanged(); } }}>Delete</button></td>}
          </tr>)}
        </tbody></table></div>}
    </section>

    <section className="content-card">
      <div className="section-header"><div><h2>Recent outbound deliveries</h2><p>Events pushed to partner agencies</p></div></div>
      {deliveries.length === 0 ? <p className="cad-note-empty">No outbound deliveries yet.</p> :
        <div className="table-wrap"><table><thead><tr><th>Time</th><th>Agency</th><th>Event</th><th>Incident</th><th>Result</th></tr></thead><tbody>
          {deliveries.map((delivery) => <tr key={delivery.id}><td>{clock(delivery.createdAt)}</td><td>{delivery.agencyName}</td><td>{delivery.eventType}</td><td>{delivery.incidentId || "—"}</td><td><span className={`cad-delivery ${delivery.status}`}>{delivery.status}{delivery.statusCode ? ` · ${delivery.statusCode}` : ""}</span>{delivery.error && <small>{delivery.error}</small>}</td></tr>)}
        </tbody></table></div>}
    </section>
  </div>;
}

function AlarmsTab({ isAdmin, events, onChanged, onError }: { isAdmin: boolean; events: AlarmEvent[]; onChanged: () => Promise<void>; onError: (message: string) => void }) {
  const [admin, setAdmin] = useState<{ signalUrl: string; panels: Panel[] } | null>(null);
  const [name, setName] = useState("");
  const [account, setAccount] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [newToken, setNewToken] = useState<{ id: string; token: string } | null>(null);

  const loadAdmin = useCallback(async () => {
    if (!isAdmin) return;
    const response = await fetch("/api/cad/alarms", { cache: "no-store" });
    if (response.ok) setAdmin(await response.json());
  }, [isAdmin]);
  useEffect(() => { const timer = window.setTimeout(() => void loadAdmin(), 0); return () => window.clearTimeout(timer); }, [loadAdmin]);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch("/api/cad/alarms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(String(payload.error || "Action failed."));
      return payload;
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : "Action failed.");
      return null;
    } finally { setBusy(false); }
  }

  async function create() {
    if (!name.trim()) return;
    const result = await act({ action: "createPanel", name, monitorAccount: account, address });
    if (result) { setNewToken({ id: String(result.id), token: String(result.inboundToken) }); setName(""); setAccount(""); setAddress(""); await loadAdmin(); await onChanged(); }
  }

  return <div className="cad-alarms">
    {isAdmin && admin && <section className="content-card">
      <div className="section-header"><div><h2>Add monitored alarm panel</h2><p>Register a fire alarm system this CAD monitors. Its signals post to the URL below with the panel token.</p></div></div>
      <Copyable label="Alarm signal URL" value={admin.signalUrl} />
      <div className="cad-form-grid">
        <label>Panel name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Riverside Plaza FACP" /></label>
        <label>Monitoring account<input value={account} onChange={(event) => setAccount(event.target.value)} placeholder="Account #" /></label>
        <label>Address<input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Protected premises address" /></label>
      </div>
      <button className="primary-action compact" disabled={busy || !name.trim()} onClick={() => void create()}>Register panel</button>
      {newToken && <div className="cad-token-reveal"><strong>Panel token — shown once, store it now:</strong><Copyable label="Bearer token" value={newToken.token} /></div>}
    </section>}

    {isAdmin && admin && <section className="content-card">
      <div className="section-header"><div><h2>Registered panels</h2></div></div>
      {admin.panels.length === 0 ? <p className="cad-note-empty">No panels registered.</p> :
        <div className="table-wrap"><table><thead><tr><th>Panel</th><th>Account</th><th>Auto-dispatch</th><th>Last signal</th><th>Actions</th></tr></thead><tbody>
          {admin.panels.map((panel) => <tr key={panel.id}><td><strong>{panel.name}</strong><small>{panel.address}</small></td><td>{panel.monitorAccount || "—"}</td><td>{panel.autoCreateIncident ? "On" : "Off"}</td><td>{since(panel.lastSignalAt) || "—"}</td><td className="cad-row-actions"><button disabled={busy} onClick={async () => { const result = await act({ action: "rotatePanel", id: panel.id }); if (result) setNewToken({ id: panel.id, token: String(result.inboundToken) }); }}>Rotate</button><button disabled={busy} onClick={async () => { if (await act({ action: "updatePanel", id: panel.id, autoCreateIncident: !panel.autoCreateIncident })) { await loadAdmin(); } }}>{panel.autoCreateIncident ? "Disable dispatch" : "Enable dispatch"}</button><button disabled={busy} className="cad-danger" onClick={async () => { if (await act({ action: "deletePanel", id: panel.id })) { await loadAdmin(); await onChanged(); } }}>Delete</button></td></tr>)}
        </tbody></table></div>}
    </section>}

    <section className="content-card">
      <div className="section-header"><div><h2>Alarm signals</h2><p>Live feed from monitored fire alarm systems</p></div></div>
      {events.length === 0 ? <div className="action-empty-state"><span>🔔</span><div><strong>No alarm signals</strong><p>Signals from monitored panels appear here in real time.</p></div></div> :
        <div className="cad-alarm-list">{events.map((event) => <div key={event.id} className={`cad-alarm-row signal-${event.signalType} priority-${event.priority} ${event.acknowledgedAt ? "acked" : ""}`}>
          <span className={`cad-alarm-badge signal-${event.signalType}`}>{event.signalType}</span>
          <div className="cad-alarm-body"><strong>{event.panelName}{event.zone ? ` · zone ${event.zone}` : ""}</strong><p>{event.description}</p><small>{clock(event.eventAt)}{event.incidentId ? ` · incident ${event.incidentId}` : ""}{event.acknowledgedAt ? ` · ack ${event.acknowledgedBy}` : ""}</small></div>
          {isAdmin && !event.acknowledgedAt && <button className="quiet-button" disabled={busy} onClick={async () => { if (await act({ action: "acknowledge", id: event.id })) await onChanged(); }}>Acknowledge</button>}
        </div>)}</div>}
    </section>
  </div>;
}
