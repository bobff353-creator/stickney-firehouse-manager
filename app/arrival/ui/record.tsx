"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  MapPin,
  Phone,
  Printer,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import {
  type PlanRecord,
  type PlanEvent,
  systemKeys,
  systemLabels,
  unknowns,
  formatDate,
  chicagoDate,
  systemWarnings,
} from "../lib/preplan";
import {useArrivalAccess} from "../access";
import { request } from "../lib/client";
import type { Observation } from "../lib/observations";
import { ObservationList } from "./observation";
import { FootprintReadout } from "./footprint";
import {ImportedSource,HydrantLibrary} from "./import-tools";
import { BuildingDetailReadout } from "./record-deep";
import { Pill, Field, Blueprint } from "./ui";
import { downloadJson, saveOffline } from "../lib/device";
export default function RecordView({
  record,
  userId,
  review = false,
  onBack,
  backLabel = 'Back to preplans',
  onEdit,
  onDetails,
  onFootprint,
  onObserve,
  onObservationUpdate,
  observationsLoadedAt: workspaceNotesRefreshedAt,
  onUpdate,
  onToast,
}: {
  record: PlanRecord;
  userId: string | null;
  review?: boolean;
  onBack: () => void;
  backLabel?: string;
  onEdit: (r: PlanRecord) => void;
  onDetails: (r: PlanRecord) => void;
  onFootprint: () => void;
  onObserve: () => void;
  onObservationUpdate: (o: Observation) => void;
  observationsLoadedAt: string | null;
  onUpdate: (r: PlanRecord) => void;
  onToast: (s: string) => void;
}) {
  const access=useArrivalAccess();
  const [tab, setTab] = useState("arrival");
  const [ack, setAck] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [events, setEvents] = useState<PlanEvent[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [observations, setObservations] = useState<Observation[]>([]);
  const [observationError, setObservationError] = useState("");
  const [observationsLoadedAt, setNotesLoadedAt] = useState<string | null>(null);
  const [notesLimited, setNotesLimited] = useState(false);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesTick, setNotesTick] = useState(0);
  const onObservationRefresh = () => setNotesTick(v => v + 1);
  useEffect(() => {
    if (record.id === "example") return;
    let live = true;
    setNotesLoading(true);
    request<{observations: Observation[]; limited:boolean}>("/api/arrival/observations?active=1&planId="+encodeURIComponent(record.id))
      .then(r => { if(live) { setObservations(r.observations); setNotesLimited(r.limited); setObservationError(""); setNotesLoadedAt(new Date().toISOString()); } })
      .catch(e => { if(live) setObservationError((e as Error).message); })
      .finally(() => { if(live) setNotesLoading(false); });
    return () => { live=false; };
  },[record.id, workspaceNotesRefreshedAt, notesTick]);
  const demo = record.id === "example";
  const p = review ? record.working : record.published || record.working;
  const u = unknowns(p);
  const draftView = review || !record.published;
  useEffect(() => {
    if (demo) return;
    request<{ events: PlanEvent[] }>("/api/arrival/plans/" + record.id)
      .then((x) => setEvents(x.events))
      .catch(() =>
        setHistoryError(
          "History could not be loaded. Reopen this record to retry.",
        ),
      );
  }, [record.id, record.revision, demo]);
  async function transition(action: string) {
    if(!access.has(action==="publish"?"field_preplans.publish":action==="return"?"field_preplans.review":"field_preplans.edit")){onToast("Your account does not have permission for this action.");return;}
    setBusy(true);
    setError("");
    try {
      const result = await request<{ plan: PlanRecord }>(
        "/api/arrival/plans/" + record.id + "/transition",
        {
          method: "POST",
          body: JSON.stringify({
            action,
            revision: record.revision,
            acknowledged: ack,
            note,
          }),
        },
      );
      onUpdate(result.plan);
      setAck(false);
      onToast(
        action === "publish"
          ? "Approved arrival version published."
          : "Returned to draft with your correction note.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function offline() {
    if (!userId || demo) return;
    setBusy(true);
    setError("");
    try {
      await saveOffline(userId, record);
      onToast(
        "Published text and photos saved offline on this device. PDFs remain online-only.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="record-page">
      <div className="page-actions">
        <button className="btn ghost" onClick={onBack}>
          <ArrowLeft size={17} /> {backLabel}
        </button>
        <div className="action-group">
          {!demo && (
            <>
              <button className="btn primary" onClick={onObserve}>
                Add observation
              </button>
              <button
                className="btn"
                disabled={busy}
                onClick={() => onDetails(record)}
              >
                Building details
              </button>
              <button className="btn" disabled={busy} onClick={onFootprint}>Capture building outline</button>
            </>
          )}
          <button className="btn" onClick={() => window.print()}>
            <Printer size={16} /> Print
          </button>
          <button
            className="btn"
            onClick={() =>
              downloadJson(record, "arrival-" + record.id + ".json")
            }
          >
            <Download size={16} /> Export
          </button>
          {!demo && (
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => onEdit(record)}
            >
              Edit quick preplan
              <ArrowRight size={17} />
            </button>
          )}
        </div>
      </div>
      {demo && (
        <div className="demo-banner">
          <Eye size={19} />
          <b>EXAMPLE ONLY</b>
          <span>
            Fictional building and conditions. This example is never stored in
            your department records.
          </span>
        </div>
      )}
      {p.imported && <div className="review-notice warning"><ShieldAlert size={20}/><div><b>Imported source record</b><p>Original review and publication status retained where available. Importing is not a new field verification. See Building & systems for source history and linked documents.</p></div></div>}
      {draftView && (
        <div className="review-notice warning">
          <ShieldAlert size={22} />
          <div>
            <b>
              {review
                ? "REVIEW COPY — NOT PUBLISHED"
                : "DRAFT PREVIEW — NOT AN APPROVED PLAN"}
            </b>
            <p>
              {record.published
                ? "The previous approved version remains in the arrival view."
                : "This building has no published arrival version."}
            </p>
          </div>
        </div>
      )}
      <header className="record-heading">
        <div>
          <div className="eyebrow">
            {review
              ? "OWNER REVIEW"
              : draftView
                ? "WORKING COPY"
                : "ARRIVAL BRIEF"}{" "}
            <span>/</span>{" "}
            {demo
              ? "DEMONSTRATION"
              : draftView
                ? "REVISION " + record.revision
                : "PUBLISHED REVISION " + record.publishedRevision}
          </div>
          <h1>{p.name}</h1>
          <p>
            <MapPin size={16} />
            {p.address}, {p.city} {p.region}
          </p>
        </div>
        <Pill tone={draftView ? "orange" : "green"}>
          {draftView ? "Working copy" : "Published"}
        </Pill>
      </header>
      <div className="record-meta">
        <span>
          <ShieldCheck size={16} /> Visited {formatDate(p.visited)}
        </span>
        <span>
          {draftView
            ? "Working copy saved " + formatDate(record.updatedAt)
            : "Published " + formatDate(record.publishedAt)}
        </span>
        <span>
          {p.reviewDue
            ? "Next review " + formatDate(p.reviewDue)
            : "Next review not scheduled"}
        </span>
      </div>
      {p.reviewDue && p.reviewDue <= chicagoDate() && (
        <div className="review-notice warning">
          <TriangleAlert size={20} />
          <b>
            This preplan is due for review. Verify current building conditions.
          </b>
        </div>
      )}
      <nav className="record-tabs" aria-label="Preplan views">
        {[
          ["arrival", "Arrival brief"],
          ["building", "Building & systems"],
          ["photos", "Photos & plans"],
          ["history", "Revision history"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-current={tab === key ? "page" : undefined}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "arrival" && !demo && (
        <section className="panel record-observations">
          <div className="panel-title">
            <div>
              <h2>Field observations</h2>
              <p>
                {observationsLoadedAt
                  ? "Notes refreshed " +
                    new Date(observationsLoadedAt).toLocaleTimeString("en-US", {
                      timeZone: "America/Chicago",
                      hour: "numeric",
                      minute: "2-digit",
                    }) +
                    " CT"
                  : "Notes not loaded yet"}{" "}
                · separate from the approved snapshot.
              </p>
            </div>
            <button className="text-button" onClick={onObservationRefresh}>
              Refresh notes
            </button>
            <button className="btn small" onClick={onObserve}>
              Add observation
            </button>
          </div>
          {notesLoading && <p role="status">Refreshing this building’s active observations…</p>}
          {notesLimited && <p role="alert">Only the first 200 active observations are shown, with crew alerts first. Review the full history separately.</p>}
          {observationError ? (
            <div className="form-error" role="alert">
              Observations could not be loaded. Reopen or refresh before relying
              on this list.
            </div>
          ) : observations.length ? (
            <ObservationList
              observations={observations}
              onUpdate={(o) => { setObservations(v => o.state === "resolved" ? v.filter(x => x.id !== o.id) : v.map(x => x.id === o.id ? o : x)); onObservationUpdate(o); }}
            />
          ) : (
            <p className="field-help">
              {observationsLoadedAt ? "No active observations in the loaded list." : "Active observations have not been loaded yet."}
            </p>
          )}
        </section>
      )}
      {tab === "arrival" && (
        <>
          {systemWarnings(p).length > 0 && (
            <section className="critical-card">
              <h2>Recorded system impairment</h2>
              {systemWarnings(p).map((s) => (
                <p key={s}>{s}</p>
              ))}
              <small>Recorded observation — verify current condition.</small>
            </section>
          )}
          <div className="arrival-grid">
            <div className="arrival-main">
              {(p.hazardStatus === "Present" || p.hazardNotes) && (
                <section className="critical-card">
                  <div className="section-label">
                    <TriangleAlert size={20} /> HAZARDS & SPECIAL CONSIDERATIONS
                  </div>
                  <h2>
                    {p.hazards.length
                      ? p.hazards.join(" · ")
                      : "Review field observations"}
                  </h2>
                  <p>
                    {p.hazardNotes || "Hazard locations were not recorded."}
                  </p>
                  <small>
                    Field observation: {p.hazardStatus || "Unknown"}. Reconcile
                    with current conditions.
                  </small>
                </section>
              )}
              {p.hydrantStatus === "Out of service" && (
                <section className="critical-card">
                  <h2>Recorded water source out of service</h2>
                  <p>{p.hydrant}</p>
                  <small>
                    Observation from {formatDate(p.visited)}. Confirm current
                    service status.
                  </small>
                </section>
              )}
              <section className="panel arrival-access">
                <div className="panel-title">
                  <h2>First-in essentials</h2>
                  <Pill>{p.occupancy || "Unknown occupancy"}</Pill>
                </div>
                <div className="essential-row">
                  <span className="essential-icon">A</span>
                  <div>
                    <h3>Main entrance / A side</h3>
                    <p>{p.entrance || "Unknown — not recorded"}</p>
                  </div>
                </div>
                <div className="essential-row">
                  <span className="essential-icon blue">W</span>
                  <div>
                    <h3>
                      Water supply{" "}
                      <Pill
                        tone={
                          p.hydrantStatus === "In service" ? "green" : "orange"
                        }
                      >
                        {p.hydrantStatus || "Unknown"}
                      </Pill>
                    </h3>
                    <p>{p.hydrant || "Unknown — not recorded"}</p>
                    <small>
                      {p.flow
                        ? "Recorded test: " +
                          p.flow +
                          " GPM on " +
                          formatDate(p.flowDate) +
                          ". This is not a current flow guarantee."
                        : "No verified flow test recorded."}
                    </small>
                  </div>
                </div>
                {(["fdc", "keybox", "gas", "electric"] as const).map((k) => (
                  <div className="essential-row" key={k}>
                    <span className="essential-icon">
                      {k === "fdc"
                        ? "F"
                        : k === "keybox"
                          ? "K"
                          : k === "gas"
                            ? "G"
                            : "E"}
                    </span>
                    <div>
                      <h3>
                        {systemLabels[k]}
                        <Pill
                          tone={
                            p.systems[k].answer === "Unknown" ||
                            !p.systems[k].answer
                              ? "orange"
                              : "neutral"
                          }
                        >
                          {p.systems[k].answer === "Yes"
                            ? "Present"
                            : p.systems[k].answer === "No"
                              ? "Recorded absent"
                              : "Unknown"}
                        </Pill>
                      </h3>
                      <p>
                        {p.systems[k].answer === "Yes"
                          ? p.systems[k].location || "Location unknown"
                          : p.systems[k].answer === "No"
                            ? "Reported absent at the field visit."
                            : "Presence and location need verification."}
                      </p>
                    </div>
                  </div>
                ))}
              </section>
            </div>
            <aside className="arrival-aside">
              <section className="panel">
                <div className="panel-title">
                  <h2>Building at a glance</h2>
                  <FileText size={17} />
                </div>
                <dl className="facts">
                  <div>
                    <dt>Occupancy</dt>
                    <dd>{p.occupancy || "Unknown"}</dd>
                  </div>
                  <div>
                    <dt>Floors</dt>
                    <dd>{p.floors || "Unknown"}</dd>
                  </div>
                  <div>
                    <dt>Construction</dt>
                    <dd>{p.construction || "Unknown"}</dd>
                  </div>
                  <div>
                    <dt>Roof</dt>
                    <dd>{p.roof || "Unknown"}</dd>
                  </div>
                  <div>
                    <dt>Basement</dt>
                    <dd>{p.basement || "Unknown"}</dd>
                  </div>
                </dl>
              </section>
              <section className="panel">
                <h2>People & access</h2>
                <h3>Occupant / rescue considerations</h3>
                <p>
                  {p.lifeSafety ||
                    "Unknown — no occupant or rescue considerations recorded."}
                </p>
                <h3>Access restrictions</h3>
                <p>
                  {p.access || "Unknown — no access restrictions recorded."}
                </p>
                <h3>Emergency contact</h3>
                <p>{p.contactName || "Not recorded"}</p>
                {p.contactPhone && (
                  <a
                    className="phone-link"
                    href={"tel:" + p.contactPhone.replace(/[^+\d]/g, "")}
                  >
                    <Phone size={16} />
                    {p.contactPhone}
                  </a>
                )}
              </section>
              {!draftView && !demo && (
                <button
                  className="btn offline-download"
                  disabled={busy}
                  onClick={offline}
                >
                  <WifiOff size={17} />
                  {busy ? "Preparing packet…" : "Save published plan offline"}
                </button>
              )}
            </aside>
          </div>
          <section className="panel visual-panel">
            <div className="panel-title">
              <div>
                <h2>Site reference</h2>
                <p>Relative sketch · not to scale · A side at bottom</p>
              </div>
              <button className="text-button" onClick={() => setTab("photos")}>
                Photos & plans <ArrowRight size={16} />
              </button>
            </div>
            <div className="site-reference">
              <div className="site-sketch">
                <div className="sketch-building">
                  {p.name}
                  <span>Not a geographic footprint</span>
                </div>
                <span className="sketch-side side-a">A · FRONT</span>
                <span className="sketch-side side-b">B</span>
                <span className="sketch-side side-c">C · REAR</span>
                <span className="sketch-side side-d">D</span>
                {p.pins.map((mark) => (
                  <span
                    className={
                      "sketch-pin " + (mark.label === "Hazard" ? "hazard" : "")
                    }
                    key={mark.id}
                    style={{ left: mark.x + "%", top: mark.y + "%" }}
                  >
                    {mark.label}
                  </span>
                ))}
                {!p.pins.length && (
                  <span className="sketch-empty">
                    No relative symbols added
                  </span>
                )}
              </div>
              <div className="site-reference-list">
                <h3>Sketch symbols</h3>
                {p.pins.length ? (
                  p.pins.map((m, i) => (
                    <p key={m.id}>
                      <b>{String(i + 1).padStart(2, "0")}</b> {m.label}
                      <small>
                        {Math.round(m.x)}% from left · {Math.round(m.y)}% from
                        top
                      </small>
                    </p>
                  ))
                ) : (
                  <p>No sketch symbols. Use the written locations above.</p>
                )}
                <p className="field-help">
                  Symbol positions are diagram coordinates. They do not
                  establish geographic locations.
                </p>
                {p.latitude && p.longitude && (
                  <a
                    className="btn"
                    href={
                      "https://www.google.com/maps/search/?api=1&query=" +
                      encodeURIComponent(p.latitude + "," + p.longitude)
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MapPin size={16} /> Open recorded coordinates
                  </a>
                )}
              </div>
            </div>
          </section>
        </>
      )}
      {tab === "building" && (
        <div className="detail-grid">
          <section className="panel">
            <h2>Building information</h2>
            <dl className="facts">
              {[
                ["Address", p.address + ", " + p.city + " " + p.region],
                ["Occupancy", p.occupancy],
                ["Floors", p.floors],
                ["Construction", p.construction],
                ["Roof", p.roof],
                ["Basement", p.basement],
                ["Visit date", formatDate(p.visited)],
              ].map(([label, v]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{v || "Unknown"}</dd>
                </div>
              ))}
            </dl>
            <h3>Additional field notes</h3>
            <p>{p.notes || "Not recorded"}</p>
          </section>
          <section className="panel">
            <h2>Fire protection & utilities</h2>
            {systemKeys.map((k) => (
              <div key={k} className="system-fact">
                <h3>
                  {systemLabels[k]}
                  <Pill>{p.systems[k].answer || "Unknown"}</Pill>
                </h3>
                <p>
                  {p.systems[k].answer === "Yes"
                    ? p.systems[k].location || "Location unknown"
                    : p.systems[k].answer === "No"
                      ? "Recorded absent at the visit."
                      : "Not verified."}
                </p>
                {p.systems[k].answer === "Yes" && (
                  <p>
                    Service condition: {p.systems[k].status || "Not checked"}
                  </p>
                )}
              </div>
            ))}
          </section>
        </div>
      )}
      {tab === "building" && <><BuildingDetailReadout data={p}/>{p.imported&&<ImportedSource recordId={p.imported.recordId}/>}</>}
      {tab === "arrival" && p.imported && p.imported.linkedHydrantIds.length>0 && <details className="panel"><summary>Source-linked hydrants · {p.imported.linkedHydrantIds.length} records</summary><HydrantLibrary planId={record.id} ownerId={userId||""}/></details>}
      {(tab === "arrival" || tab === "building") && p.footprint && (
        <FootprintReadout value={p.footprint} />
      )}
      {tab === "photos" && (
        <section className="panel">
          <div className="panel-title">
            <h2>Exterior photos</h2>
            <Pill>
              {p.photos.filter((x) => ["A","B","C","D"].includes(x.side)).length} recorded
            </Pill>
          </div>
          <div className="photo-grid viewing">
            {["A", "B", "C", "D"].map((side, i) => {
              const photo = p.photos.find((x) => x.side === side);
              return (
                <figure className="photo-tile" key={side}>
                  <div className="photo-preview">
                    {photo ? (
                      <a
                        href={"/api/arrival/files/" + photo.id}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={"/api/arrival/files/" + photo.id}
                          alt={side + " side: " + photo.caption}
                        />
                      </a>
                    ) : (
                      <div>
                        <CameraIcon />
                        <p>No photo recorded</p>
                      </div>
                    )}
                    <span className="side-tag">{side}</span>
                  </div>
                  <figcaption className="photo-info">
                    <b>
                      {side} ·{" "}
                      {
                        [
                          "Front / main entrance",
                          "Left side",
                          "Rear side",
                          "Right side",
                        ][i]
                      }
                    </b>
                    <p>{photo?.caption || "No caption recorded"}</p>
                  </figcaption>
                </figure>
              );
            })}
          </div>
          {p.photos.some(x=>x.side==="Overview")&&<><h2 className="mt24">Imported overview photos</h2><p>Original source photos. A / B / C / D sides were not assigned in the source.</p><div className="photo-grid viewing">{p.photos.filter(x=>x.side==="Overview").map(x=><figure className="photo-tile" key={x.id}><a href={"/api/arrival/files/"+x.id} target="_blank" rel="noreferrer"><img loading="lazy" className="import-overview-image" src={"/api/arrival/files/"+x.id} alt={x.caption||x.name}/></a><figcaption className="photo-info"><b>{x.name}</b><p>{x.caption||"No source caption"}</p></figcaption></figure>)}</div></>}
          <h2 className="mt24">Floor plans & documents</h2>
          {p.photos.filter((x) => x.side === "Plan").length ? (
            p.photos
              .filter((x) => x.side === "Plan")
              .map((x) => (
                <a
                  className="file-row"
                  href={"/api/arrival/files/" + x.id}
                  key={x.id}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FileText size={20} />
                  {x.name}
                  <span>Open / download</span>
                </a>
              ))
          ) : (
            p.imported ? null : <p>No floor plans or documents uploaded.</p>
          )}
        </section>
      )}
      {tab === "photos" && p.imported && <section className="panel"><h2>Original source documents</h2><ImportedSource recordId={p.imported.recordId} documentsOnly/></section>}
      {tab === "history" && (
        <section className="panel">
          <div className="panel-title">
            <h2>Revision history</h2>
            <Pill>Latest 100 events</Pill>
          </div>
          {demo ? (
            <p>This fictional example has no server history.</p>
          ) : historyError ? (
            <p role="alert">{historyError}</p>
          ) : events.length ? (
            events.map((e, i) => (
              <div className="history-row" key={i}>
                <span className="history-dot" />
                <div>
                  <b>{e.action}</b>
                  <p>{e.note || "No additional note."}</p>
                </div>
                <span>
                  Revision {e.revision}
                  <small>
                    {new Date(e.at).toLocaleString("en-US", {
                      timeZone: "America/Chicago",
                    })}{" "}
                    CT
                  </small>
                </span>
              </div>
            ))
          ) : (
            <p>Loading revision history…</p>
          )}
        </section>
      )}
      <section className="unknown-box">
        <div className="panel-title">
          <h2>{u.length} unknown or missing details</h2>
          <TriangleAlert size={19} />
        </div>
        <p>
          Unknown does not mean absent. Missing details remain visible after
          approval.
        </p>
        <div className="tags">
          {u.length ? (
            u.map((v) => <span key={v}>{v}</span>)
          ) : (
            <span>No tracked unknowns. Confirm current conditions.</span>
          )}
        </div>
      </section>
      {review && record.status === "review" && !demo && (
        <section className="panel approval-panel">
          <div>
            <h2>Make this the approved arrival version?</h2>

          </div>
          <Field label="Review / correction note">
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              placeholder="Record corrections or review comments"
              disabled={busy}
            />
          </Field>
          <label className="check-card">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              disabled={busy}
            />
            <span>
              <b>
                I reviewed this visit and the {u.length} unknown or missing
                details
              </b>
              <small>
                I understand that approval does not verify unknown information.
              </small>
            </span>
          </label>
          <div className="action-group">
            <button
              className="btn"
              disabled={busy || !note.trim() || !access.has("field_preplans.review")}
              onClick={() => transition("return")}
            >
              Return for correction
            </button>
            <button
              className="btn primary"
              disabled={!ack || busy || !access.has("field_preplans.publish")}
              onClick={() => transition("publish")}
            >
              <CheckCircle2 size={17} />
              {busy ? "Saving…" : "Approve & publish"}
            </button>
          </div>
          {!note.trim() && (
            <p className="field-help">
              A correction note is required to return the visit.
            </p>
          )}
        </section>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

    </div>
  );
}
function CameraIcon() {
  return <FileText size={28} strokeWidth={1.3} />;
}
