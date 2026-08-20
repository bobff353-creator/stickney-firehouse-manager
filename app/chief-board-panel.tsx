"use client";
/* eslint-disable @next/next/no-img-element -- Chief Board photos are served from the portal's authenticated R2 route. */

import { useCallback, useEffect, useRef, useState } from "react";

type Attachment = { id: string; filename: string; contentType: string; sizeBytes: number; url: string };
type ChiefItem = {
  id: string;
  itemType: "note" | "event";
  title: string;
  body: string;
  eventDate: string;
  startsAt: string;
  endsAt: string;
  expiresAt: string;
  inviteStatus: string;
  createdBy: string;
  createdAt: string;
  attachments: Attachment[];
};
type RiverGauge = {
  gaugeId: string; name: string; level: number; unit: string; category: string; validTime: string;
  actionStage: number | null; minorStage: number | null; moderateStage: number | null; majorStage: number | null;
  inService: boolean; serviceMessage: string; sourceUrl: string; hydrographUrl: string; retrievedAt: string;
};
const emptyDraft = { itemType: "note" as "note" | "event", title: "", body: "", startsAt: "", endsAt: "", expiresAt: "" };

function dateTime(value: string) {
  return value ? new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";
}

function fileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function floodLabel(category: string) {
  return category.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ChiefBoardPanel() {
  const [items, setItems] = useState<ChiefItem[]>([]);
  const [river, setRiver] = useState<RiverGauge | null>(null);
  const [riverError, setRiverError] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [current, setCurrent] = useState(0);
  const [draft, setDraft] = useState<typeof emptyDraft | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    const [boardResponse, riverResponse] = await Promise.all([fetch("/api/chief-board"), fetch("/api/river-gauge")]);
    const result = await boardResponse.json() as { items?: ChiefItem[]; canEdit?: boolean; error?: string };
    const riverResult = await riverResponse.json() as RiverGauge & { error?: string };
    if (boardResponse.ok) {
      setItems(result.items ?? []);
      setCanEdit(Boolean(result.canEdit));
    } else setMessage(result.error || "Unable to load Chief Notes and Events.");
    if (riverResponse.ok) {
      setRiver(riverResult);
      setRiverError("");
    } else setRiverError(riverResult.error || "Live river level is temporarily unavailable.");
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const refresh = window.setInterval(() => void load(), 30000);
    return () => { window.clearTimeout(initial); window.clearInterval(refresh); };
  }, [load]);
  const slideCount = items.length + 1;
  useEffect(() => {
    if (slideCount < 2) return;
    const timer = window.setInterval(() => setCurrent((value) => (value + 1) % slideCount), 12000);
    return () => window.clearInterval(timer);
  }, [slideCount]);
  useEffect(() => { setCurrent((value) => value % slideCount); }, [slideCount]);
  const riverActive = current === items.length;
  const item = riverActive ? undefined : items[current];
  const riverScale = river?.majorStage || river?.moderateStage || river?.minorStage || river?.actionStage || 25;
  const riverPercent = river ? Math.max(0, Math.min(100, river.level / riverScale * 100)) : 0;

  function closeEditor() {
    if (saving) return;
    setDraft(null);
    setSelectedFiles([]);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || saving) return;
    setSaving(true);
    setMessage("");
    const form = new FormData();
    form.set("itemType", draft.itemType);
    form.set("title", draft.title);
    form.set("body", draft.body);
    if (draft.itemType === "event") {
      form.set("startsAt", new Date(draft.startsAt).toISOString());
      form.set("endsAt", new Date(draft.endsAt).toISOString());
    } else if (draft.expiresAt) {
      form.set("expiresAt", new Date(draft.expiresAt).toISOString());
    }
    selectedFiles.forEach((file) => form.append("attachments", file));
    try {
      const response = await fetch("/api/chief-board", { method: "POST", body: form });
      const result = await response.json() as { error?: string; invite?: { status: string; sent: number; failed: number } };
      if (!response.ok) return setMessage(result.error || "Unable to add information.");
      setDraft(null);
      setSelectedFiles([]);
      if (draft.itemType === "event") {
        const invite = result.invite;
        setMessage(invite?.status === "sent"
          ? `Event added and ${invite.sent} calendar invitation${invite.sent === 1 ? "" : "s"} sent.`
          : `Event added. Calendar invitations: ${invite?.sent ?? 0} sent, ${invite?.failed ?? 0} not sent.`);
      } else {
        setMessage("Chief Note added to the Live Operations Board.");
      }
      await load();
    } catch {
      setMessage("Unable to add the Chief Note or Event. Check the connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="board-panel chief-board-panel" aria-live="polite">
    <header>
      <div><h2>{riverActive ? "Des Plaines River · Lyons" : "Chief Notes & Events"}</h2><span>{current + 1} of {slideCount}</span></div>
      {canEdit && <button className="chief-add-button" aria-label="Add Chief Note or Event" onClick={() => { setDraft({ ...emptyDraft }); setSelectedFiles([]); }}>+</button>}
    </header>
    <div className="chief-board-content">
      {riverActive ? river ? <article className={`river-gauge-slide ${river.category}`}>
        <div className="river-gauge-heading"><span>LIVE NOAA GAUGE · {river.gaugeId}</span><strong className={river.category}>{floodLabel(river.category)}</strong></div>
        <div className="river-gauge-reading"><strong>{river.level.toFixed(2)}</strong><span>{river.unit}</span><div><b>Current river stage</b><small>Observed {dateTime(river.validTime)}</small></div></div>
        <div className="river-stage-meter"><div className="river-stage-fill" style={{ width: `${riverPercent}%` }}/></div>
        <div className="river-thresholds">
          <span><small>Action</small><b>{river.actionStage?.toFixed(1) ?? "—"} ft</b></span>
          <span><small>Minor flood</small><b>{river.minorStage?.toFixed(1) ?? "—"} ft</b></span>
          <span><small>Moderate</small><b>{river.moderateStage?.toFixed(1) ?? "—"} ft</b></span>
          <span><small>Major</small><b>{river.majorStage?.toFixed(1) ?? "—"} ft</b></span>
        </div>
        <a className="river-source-link" href={river.sourceUrl} target="_blank" rel="noreferrer">Open live NOAA gauge and hydrograph ↗</a>
      </article> : <div className="board-empty"><strong>River gauge unavailable</strong><p>{riverError || "Waiting for the next NOAA update."}</p><a href="https://water.noaa.gov/gauges/lyni2" target="_blank" rel="noreferrer">Open NOAA gauge ↗</a></div> : item ? <article className={item.itemType}>
        <div>
          <span>{item.itemType === "event" ? "UPCOMING EVENT" : "CHIEF NOTE"}</span>
          {item.itemType === "event" && item.startsAt && <time>{dateTime(item.startsAt)} – {dateTime(item.endsAt)}</time>}
          {item.itemType === "note" && item.expiresAt && <time>Until {dateTime(item.expiresAt)}</time>}
        </div>
        <h3>{item.title}</h3>
        <p>{item.body}</p>
        {!!item.attachments?.length && <div className="chief-attachments">
          {item.attachments.map((attachment) => attachment.contentType.startsWith("image/")
            ? <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="chief-photo"><img src={attachment.url} alt={attachment.filename}/></a>
            : <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="chief-file"><span aria-hidden="true">↗</span><strong>{attachment.filename}</strong><small>{fileSize(attachment.sizeBytes)}</small></a>)}
        </div>}
      </article> : <div className="board-empty"><strong>No Chief Notes or Events</strong><p>Administrators can use the + button to post information here.</p></div>}
    </div>
    {message && <div className="chief-board-message" role="status">{message}</div>}
    {draft && <div className="chief-editor-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) closeEditor(); }}>
      <form className="chief-editor" onSubmit={(event) => void save(event)}>
        <header><div><p>Administrator</p><h2>Add Board Information</h2></div><button type="button" aria-label="Close" disabled={saving} onClick={closeEditor}>×</button></header>
        <label><span>Information type</span><select value={draft.itemType} onChange={(event) => setDraft({ ...draft, itemType: event.target.value as "note" | "event", startsAt: "", endsAt: "", expiresAt: "" })}><option value="note">Chief Note</option><option value="event">Event</option></select></label>
        {draft.itemType === "event" ? <div className="chief-date-grid">
          <label><span>Event starts</span><input required type="datetime-local" value={draft.startsAt} onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })}/></label>
          <label><span>Event ends</span><input required type="datetime-local" min={draft.startsAt} value={draft.endsAt} onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })}/></label>
        </div> : <label><span>Show note until (optional)</span><input type="datetime-local" value={draft.expiresAt} onChange={(event) => setDraft({ ...draft, expiresAt: event.target.value })}/><small>Leave blank to keep the note on the board.</small></label>}
        <label><span>Title</span><input required maxLength={80} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder={draft.itemType === "event" ? "Example: Department training" : "Example: Message from the Chief"}/></label>
        <label><span>Message</span><textarea required rows={6} maxLength={700} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })}/></label>
        <label><span>Attachments and photos (up to 5)</span><input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.txt,.doc,.docx,.xls,.xlsx" onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []).slice(0, 5))}/><small>Each file can be up to 10 MB.</small></label>
        {!!selectedFiles.length && <div className="chief-selected-files">{selectedFiles.map((file, index) => <div key={`${file.name}-${index}`}><span>{file.name}</span><small>{fileSize(file.size)}</small><button type="button" aria-label={`Remove ${file.name}`} onClick={() => { const next = selectedFiles.filter((_, fileIndex) => fileIndex !== index); setSelectedFiles(next); if (!next.length && fileInput.current) fileInput.current.value = ""; }}>×</button></div>)}</div>}
        <footer><button type="button" disabled={saving} onClick={closeEditor}>Cancel</button><button type="submit" disabled={saving}>{saving ? "Adding…" : draft.itemType === "event" ? "Add & Send Invites" : "Add to Board"}</button></footer>
      </form>
    </div>}
  </section>;
}
