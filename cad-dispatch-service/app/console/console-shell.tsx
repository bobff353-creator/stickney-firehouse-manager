"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Unit = { id: string; unitNumber: string; name: string; unitType: string; agency: string; station: string; status: string; statusSince: string; activeIncidentId: string; latitude: number | null; longitude: number | null; heading: number | null; speed: number | null; locationAt: string | null; source: string };
type Incident = { incidentId: string; callType: string; category: string; address: string; city: string; respondingUnits: string; longitude: number | null; latitude: number | null; dispatchedAt: string; source: string };
type Note = { id: string; incidentId: string; sequence: number; note: string; category: string; author: string; source: string; agency: string; unitNumber: string; eventAt: string };
type Agency = { id: string; name: string; agencyType: string; contact: string; outboundUrl: string; subscriptions: string; active: number; lastInboundAt: string | null; lastOutboundAt: string | null; hasSecret: number };
type Delivery = { id: string; agencyName: string; eventType: string; incidentId: string; status: string; statusCode: number | null; error: string; createdAt: string };
type Panel = { id: string; name: string; monitorAccount: string; address: string; protocol: string; autoCreateIncident: number; active: number; lastSignalAt: string | null };
type AlarmEvent = { id: string; panelId: string; panelName: string; signalType: string; zone: string; description: string; priority: string; incidentId: string; eventAt: string; acknowledgedAt: string | null; acknowledgedBy: string };
type Recommendation = { unitNumber: string; name: string; unitType: string; agency: string; status: string; distanceMiles: number | null; dispatchable: boolean };
type Snapshot = { viewer: { email: string; isAdmin: boolean; displayName: string }; generatedAt: string; unitStatuses: string[]; units: Unit[]; incidents: Incident[]; notes: Note[]; agencies: Agency[]; deliveries: Delivery[]; panels: Panel[]; alarms: AlarmEvent[] };

const statusLabels: Record<string, string> = { available: "Available", dispatched: "Dispatched", enroute: "En route", onscene: "On scene", transporting: "Transporting", returning: "Returning", out_of_service: "Out of service" };

function clock(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" });
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

export default function ConsoleShell({ name, email, role }: { name: string; email: string; role: string }) {
  const router = useRouter();
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"dispatch" | "interop" | "alarms">("dispatch");
  const [selectedIncident, setSelectedIncident] = useState("");
  const [noteText, setNoteText] = useState("");
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/cad/dispatch", { cache: "no-store" });
      if (response.status === 401) { router.replace("/login"); return; }
      const payload = await response.json() as Snapshot & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to load the dispatch console.");
      setData(payload);
      setError("");
      setSelectedIncident((current) => current || payload.incidents[0]?.incidentId || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load the dispatch console.");
    }
  }, [router]);

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
      if (!response.ok) throw new Error(String(payload.error || "The action failed."));
      return payload;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The action failed.");
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const incidentNotes = useMemo(() => (data?.notes ?? []).filter((note) => note.incidentId === selectedIncident).sort((a, b) => a.sequence - b.sequence), [data?.notes, selectedIncident]);
  const selected = useMemo(() => data?.incidents.find((incident) => incident.incidentId === selectedIncident) ?? null, [data?.incidents, selectedIncident]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }
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
  async function clearIncident() {
    if (!selectedIncident) return;
    if (await post({ action: "clearIncident", incidentId: selectedIncident })) { setRecommendations(null); await load(); }
  }

  return (
    <>
      <header className="app-bar">
        <div className="app-brand"><div className="app-mark">CAD</div><div><b>CAD Dispatch</b><small>Computer-Aided Dispatch service</small></div></div>
        <div className="app-user"><span>Signed in as <strong>{name || email}</strong>{role === "admin" ? " · Admin" : ""}</span><button onClick={() => void logout()}>Sign out</button></div>
      </header>

      <main className="app-main">
        {error && <div className="error-banner"><span>{error}</span><button onClick={() => setError("")}>Dismiss</button></div>}

        {!data ? <p className="loading">Connecting to the dispatch service…</p> : <>
          <div className="page-head">
            <div><p className="eyebrow">Real time</p><h1>Dispatch console</h1></div>
            <div className="live"><span className="live-dot" /> Live · updated {clock(data.generatedAt)}</div>
          </div>

          <div className="summary">
            <div><strong>{data.units.length}</strong><span>Units tracked</span></div>
            <div><strong>{data.units.filter((unit) => unit.status === "available").length}</strong><span>Available</span></div>
            <div><strong>{data.incidents.length}</strong><span>Active incidents</span></div>
            <div><strong>{data.alarms.filter((event) => !event.acknowledgedAt).length}</strong><span>Unack. alarms</span></div>
          </div>

          <nav className="tabs">
            <button className={tab === "dispatch" ? "active" : ""} onClick={() => setTab("dispatch")}>Dispatch board</button>
            <button className={tab === "interop" ? "active" : ""} onClick={() => setTab("interop")}>Agency interop</button>
            <button className={tab === "alarms" ? "active" : ""} onClick={() => setTab("alarms")}>Alarm monitoring</button>
          </nav>

          {tab === "dispatch" && <div className="dispatch-grid">
            <section className="card">
              <div className="section-header"><div><h2>Apparatus &amp; units</h2><p>Live status and location</p></div></div>
              <div className="scroll">
                {data.units.length === 0 ? <div className="empty">No units yet. They appear once they report location, or when an admin adds them.</div> :
                  data.units.map((unit) => <div key={unit.id} className={`unit-row status-${unit.status}`}>
                    <div className="unit-id"><strong>{unit.unitNumber}</strong><small>{unit.name !== unit.unitNumber ? unit.name : unit.unitType}{unit.agency && unit.agency !== "Local" ? ` · ${unit.agency}` : ""}</small></div>
                    <div className="unit-loc"><span className={`loc-dot ${locationFresh(unit.locationAt)}`} />{unit.latitude != null && unit.longitude != null ? <span>{unit.latitude.toFixed(4)}, {unit.longitude.toFixed(4)}<small>{since(unit.locationAt)}</small></span> : <span className="muted">No location<small>—</small></span>}</div>
                    <div className="unit-status"><span className={`chip status-${unit.status}`}>{statusLabels[unit.status] ?? unit.status}</span>{unit.activeIncidentId && <small>on {unit.activeIncidentId}</small>}</div>
                    <select aria-label={`Set status for ${unit.unitNumber}`} value={unit.status} disabled={busy} onChange={(event) => void changeStatus(unit.unitNumber, event.target.value)}>{data.unitStatuses.map((status) => <option key={status} value={status}>{statusLabels[status] ?? status}</option>)}</select>
                  </div>)}
              </div>
            </section>

            <section className="card">
              <div className="section-header"><div><h2>Active incidents</h2><p>Select to dispatch &amp; log</p></div><button className="primary compact" onClick={() => setCreating((value) => !value)}>{creating ? "Close" : "New"}</button></div>
              {creating && <NewIncident busy={busy} onCreate={async (fields) => { const result = await post({ action: "createIncident", ...fields }); if (result) { setCreating(false); setSelectedIncident(String(result.incidentId)); await load(); } }} />}
              <div className="scroll">
                {data.incidents.length === 0 ? <div className="empty">No active incidents. Create one, or they arrive from CAD feeds and alarm panels.</div> :
                  data.incidents.map((incident) => <button key={incident.incidentId} className={`incident-row ${incident.incidentId === selectedIncident ? "selected" : ""}`} onClick={() => { setSelectedIncident(incident.incidentId); setRecommendations(null); }}>
                    <div><strong>{incident.callType}</strong><br /><small>{incident.address || "Location pending"}{incident.city ? `, ${incident.city}` : ""}</small></div>
                    <div className="incident-meta"><span>{incident.incidentId}</span><small>{clock(incident.dispatchedAt)}</small>{incident.latitude == null && <em className="warn">unmapped</em>}</div>
                  </button>)}
              </div>
            </section>

            <section className="card">
              {!selected ? <div className="empty">Select an incident to dispatch the closest units and log real-time notes.</div> : <>
                <div className="section-header"><div><h2>{selected.callType}</h2><p>{selected.incidentId} · {selected.address || "Location pending"}</p></div><div className="row-actions"><button className="primary compact" disabled={busy} onClick={() => void recommend(selected.incidentId)}>Closest units</button><button className="quiet danger" disabled={busy} onClick={() => void clearIncident()}>Clear</button></div></div>
                {selected.respondingUnits && <p className="responding">Responding: <strong>{selected.respondingUnits}</strong></p>}
                {recommendations && <div className="recommend">{recommendations.length === 0 ? <p className="muted">No units available to rank.</p> : recommendations.map((unit) => <div key={unit.unitNumber} className={`recommend-row ${unit.dispatchable ? "" : "committed"}`}>
                  <div><strong>{unit.unitNumber}</strong><small>{unit.agency} · {statusLabels[unit.status] ?? unit.status}</small></div>
                  <span className="distance">{unit.distanceMiles == null ? "no GPS" : `${unit.distanceMiles.toFixed(1)} mi`}</span>
                  <button className="quiet" disabled={busy || !unit.dispatchable} onClick={() => void dispatchUnit(unit.unitNumber)}>{unit.dispatchable ? "Dispatch" : "Committed"}</button>
                </div>)}</div>}
                <div className="notes">
                  <h3>Incident log</h3>
                  <div className="note-timeline">
                    {incidentNotes.length === 0 ? <p className="muted">No notes yet.</p> : incidentNotes.map((note) => <div key={note.id} className={`note cat-${note.category}`}>
                      <span className="note-time">{new Date(note.eventAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                      <div><p>{note.note}</p><small>{note.category !== "note" ? `${note.category.replace(/_/g, " ")} · ` : ""}{note.author || note.agency || note.source}{note.source === "agency" ? ` (${note.agency})` : ""}</small></div>
                    </div>)}
                  </div>
                  <div className="note-input"><input value={noteText} disabled={busy} placeholder="Add a timestamped note…" onChange={(event) => setNoteText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void submitNote(); }} /><button className="primary compact" disabled={busy || !noteText.trim()} onClick={() => void submitNote()}>Log</button></div>
                </div>
              </>}
            </section>
          </div>}

          {tab === "interop" && <InteropTab isAdmin={data.viewer.isAdmin} deliveries={data.deliveries} agencies={data.agencies} onChanged={load} onError={setError} />}
          {tab === "alarms" && <AlarmsTab isAdmin={data.viewer.isAdmin} events={data.alarms} onChanged={load} onError={setError} />}
        </>}
      </main>
    </>
  );
}

function NewIncident({ busy, onCreate }: { busy: boolean; onCreate: (fields: Record<string, string>) => Promise<void> }) {
  const [callType, setCallType] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  return <div className="form-grid" style={{ marginTop: 4 }}>
    <label>Call type<input value={callType} onChange={(event) => setCallType(event.target.value)} placeholder="Structure Fire" /></label>
    <label>Address<input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="100 Main St" /></label>
    <label>Latitude<input value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="41.8228" /></label>
    <label>Longitude<input value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="-87.7834" /></label>
    <div style={{ gridColumn: "1 / -1" }}><button className="primary compact" disabled={busy || !callType.trim()} onClick={() => void onCreate({ callType, address, latitude, longitude })}>Create incident</button></div>
  </div>;
}

function Copyable({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return <div className="copyable"><span>{label}</span><code>{value}</code><button onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied" : "Copy"}</button></div>;
}

const eventTypeOptions = ["incident", "location", "note", "status", "alarm"];

function InteropTab({ isAdmin, deliveries, agencies, onChanged, onError }: { isAdmin: boolean; deliveries: Delivery[]; agencies: Agency[]; onChanged: () => Promise<void>; onError: (message: string) => void }) {
  const [admin, setAdmin] = useState<{ inboundUrl: string; agencies: (Agency & { inboundToken?: string })[] } | null>(null);
  const [name, setName] = useState("");
  const [agencyType, setAgencyType] = useState("cad");
  const [outboundUrl, setOutboundUrl] = useState("");
  const [outboundSecret, setOutboundSecret] = useState("");
  const [subs, setSubs] = useState<string[]>(["incident", "note"]);
  const [busy, setBusy] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);

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
    } catch (caught) { onError(caught instanceof Error ? caught.message : "Action failed."); return null; } finally { setBusy(false); }
  }
  async function create() {
    if (!name.trim()) return;
    const result = await act({ action: "create", name, agencyType, outboundUrl, outboundSecret, subscriptions: subs });
    if (result) { setNewToken(String(result.inboundToken)); setName(""); setOutboundUrl(""); setOutboundSecret(""); await loadAdmin(); await onChanged(); }
  }

  const list = admin?.agencies ?? agencies;
  return <div className="stack">
    {isAdmin && admin && <section className="card">
      <div className="section-header"><div><h2>Add partner agency / vehicle feed</h2><p>Generates an inbound token for their CAD or apparatus clients; optionally push events to their webhook.</p></div></div>
      <Copyable label="Inbound webhook URL" value={admin.inboundUrl} />
      <div className="form-grid">
        <label>Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="County Dispatch" /></label>
        <label>Type<select value={agencyType} onChange={(event) => setAgencyType(event.target.value)}><option value="cad">CAD agency</option><option value="fire">Fire department</option><option value="ems">EMS</option><option value="police">Police</option><option value="fleet">Own apparatus fleet</option></select></label>
        <label>Outbound URL (optional)<input value={outboundUrl} onChange={(event) => setOutboundUrl(event.target.value)} placeholder="https://partner.example/cad/inbound" /></label>
        <label>Outbound signing secret (optional)<input value={outboundSecret} onChange={(event) => setOutboundSecret(event.target.value)} placeholder="Shared HMAC secret" /></label>
      </div>
      <div className="subs">Send events:{eventTypeOptions.map((type) => <label key={type}><input type="checkbox" checked={subs.includes(type)} onChange={(event) => setSubs((current) => event.target.checked ? [...current, type] : current.filter((item) => item !== type))} />{type}</label>)}</div>
      <button className="primary compact" disabled={busy || !name.trim()} onClick={() => void create()}>Create agency</button>
      {newToken && <div className="token-reveal"><strong>Inbound token — shown once, store it now:</strong><Copyable label="Bearer token" value={newToken} /></div>}
    </section>}

    <section className="card">
      <div className="section-header"><div><h2>Connected agencies</h2><p>Bidirectional CAD peers and apparatus feeds</p></div></div>
      {list.length === 0 ? <div className="empty">{isAdmin ? "Add a partner agency above to exchange real-time CAD data." : "An administrator has not configured any CAD peers yet."}</div> :
        <div className="table-wrap"><table><thead><tr><th>Agency</th><th>Subscriptions</th><th>Outbound</th><th>Last in</th><th>Last out</th>{isAdmin && <th>Actions</th>}</tr></thead><tbody>
          {list.map((agency) => <tr key={agency.id}>
            <td><strong>{agency.name}</strong><small>{agency.agencyType}{agency.active ? "" : " · disabled"}</small></td>
            <td>{(() => { try { return (JSON.parse(agency.subscriptions) as string[]).join(", ") || "—"; } catch { return "—"; } })()}</td>
            <td>{agency.outboundUrl ? <span className="ok">configured{agency.hasSecret ? " · signed" : ""}</span> : <span className="muted">receive only</span>}</td>
            <td>{since(agency.lastInboundAt) || "—"}</td>
            <td>{since(agency.lastOutboundAt) || "—"}</td>
            {isAdmin && <td className="row-actions">{agency.outboundUrl && <button disabled={busy} onClick={async () => { if (await act({ action: "test", id: agency.id })) { await loadAdmin(); await onChanged(); } }}>Test</button>}<button disabled={busy} onClick={async () => { const result = await act({ action: "rotate", id: agency.id }); if (result) setNewToken(String(result.inboundToken)); }}>Rotate</button><button disabled={busy} className="danger" onClick={async () => { if (await act({ action: "delete", id: agency.id })) { await loadAdmin(); await onChanged(); } }}>Delete</button></td>}
          </tr>)}
        </tbody></table></div>}
    </section>

    <section className="card">
      <div className="section-header"><div><h2>Recent outbound deliveries</h2><p>Events pushed to partner agencies</p></div></div>
      {deliveries.length === 0 ? <p className="muted">No outbound deliveries yet.</p> :
        <div className="table-wrap"><table><thead><tr><th>Time</th><th>Agency</th><th>Event</th><th>Incident</th><th>Result</th></tr></thead><tbody>
          {deliveries.map((delivery) => <tr key={delivery.id}><td>{clock(delivery.createdAt)}</td><td>{delivery.agencyName}</td><td>{delivery.eventType}</td><td>{delivery.incidentId || "—"}</td><td><span className={`pill ${delivery.status}`}>{delivery.status}{delivery.statusCode ? ` · ${delivery.statusCode}` : ""}</span>{delivery.error && <small>{delivery.error}</small>}</td></tr>)}
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
  const [newToken, setNewToken] = useState<string | null>(null);

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
    } catch (caught) { onError(caught instanceof Error ? caught.message : "Action failed."); return null; } finally { setBusy(false); }
  }
  async function create() {
    if (!name.trim()) return;
    const result = await act({ action: "createPanel", name, monitorAccount: account, address });
    if (result) { setNewToken(String(result.inboundToken)); setName(""); setAccount(""); setAddress(""); await loadAdmin(); await onChanged(); }
  }

  return <div className="stack">
    {isAdmin && admin && <section className="card">
      <div className="section-header"><div><h2>Add monitored alarm panel</h2><p>Register a fire alarm system this CAD monitors. Signals post to the URL below with the panel token.</p></div></div>
      <Copyable label="Alarm signal URL" value={admin.signalUrl} />
      <div className="form-grid">
        <label>Panel name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Riverside Plaza FACP" /></label>
        <label>Monitoring account<input value={account} onChange={(event) => setAccount(event.target.value)} placeholder="Account #" /></label>
        <label>Address<input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Protected premises address" /></label>
      </div>
      <button className="primary compact" disabled={busy || !name.trim()} onClick={() => void create()}>Register panel</button>
      {newToken && <div className="token-reveal"><strong>Panel token — shown once, store it now:</strong><Copyable label="Bearer token" value={newToken} /></div>}
    </section>}

    {isAdmin && admin && <section className="card">
      <div className="section-header"><div><h2>Registered panels</h2></div></div>
      {admin.panels.length === 0 ? <p className="muted">No panels registered.</p> :
        <div className="table-wrap"><table><thead><tr><th>Panel</th><th>Account</th><th>Auto-dispatch</th><th>Last signal</th><th>Actions</th></tr></thead><tbody>
          {admin.panels.map((panel) => <tr key={panel.id}><td><strong>{panel.name}</strong><small>{panel.address}</small></td><td>{panel.monitorAccount || "—"}</td><td>{panel.autoCreateIncident ? "On" : "Off"}</td><td>{since(panel.lastSignalAt) || "—"}</td><td className="row-actions"><button disabled={busy} onClick={async () => { const result = await act({ action: "rotatePanel", id: panel.id }); if (result) setNewToken(String(result.inboundToken)); }}>Rotate</button><button disabled={busy} onClick={async () => { if (await act({ action: "updatePanel", id: panel.id, autoCreateIncident: !panel.autoCreateIncident })) await loadAdmin(); }}>{panel.autoCreateIncident ? "Disable dispatch" : "Enable dispatch"}</button><button disabled={busy} className="danger" onClick={async () => { if (await act({ action: "deletePanel", id: panel.id })) { await loadAdmin(); await onChanged(); } }}>Delete</button></td></tr>)}
        </tbody></table></div>}
    </section>}

    <section className="card">
      <div className="section-header"><div><h2>Alarm signals</h2><p>Live feed from monitored fire alarm systems</p></div></div>
      {events.length === 0 ? <div className="empty">No alarm signals. Signals from monitored panels appear here in real time.</div> :
        <div className="alarm-list">{events.map((event) => <div key={event.id} className={`alarm-row signal-${event.signalType} ${event.acknowledgedAt ? "acked" : ""}`}>
          <span className={`alarm-badge signal-${event.signalType}`}>{event.signalType}</span>
          <div className="alarm-body"><strong>{event.panelName}{event.zone ? ` · zone ${event.zone}` : ""}</strong><p>{event.description}</p><small>{clock(event.eventAt)}{event.incidentId ? ` · incident ${event.incidentId}` : ""}{event.acknowledgedAt ? ` · ack ${event.acknowledgedBy}` : ""}</small></div>
          {isAdmin && !event.acknowledgedAt && <button className="quiet" disabled={busy} onClick={async () => { if (await act({ action: "acknowledge", id: event.id })) await onChanged(); }}>Acknowledge</button>}
        </div>)}</div>}
    </section>
  </div>;
}
