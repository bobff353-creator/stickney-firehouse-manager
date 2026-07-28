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
const emptyDraft = { itemType: "note" as "note" | "event", title: "", body: "", startsAt: "", endsAt: "", expiresAt: "" };

function dateTime(value: string) {
  return value ? new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "";
}

function fileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function ChiefBoardPanel() {
  const [items, setItems] = useState<ChiefItem[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [current, setCurrent] = useState(0);
  const [draft, setDraft] = useState<typeof emptyDraft | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    const response = await fetch("/api/chief-board");
    const result = await response.json() as { items?: ChiefItem[]; canEdit?: boolean; error?: string };
    if (!response.ok) return setMessage(result.error || "Unable to load Chief Notes and Events.");
    setItems(result.items ?? []);
    setCanEdit(Boolean(result.canEdit));
    setCurrent(0);
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const refresh = window.setInterval(() => void load(), 30000);
    return () => { window.clearTimeout(initial); window.clearInterval(refresh); };
  }, [load]);
  useEffect(() => {
    if (items.length < 2) return;
    const timer = window.setInterval(() => setCurrent((value) => (value + 1) % items.length), 9000);
    return () => window.clearInterval(timer);
  }, [items.length]);
  const item = items[current];

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
      <div><h2>Chief Notes & Events</h2><span>{items.length ? `${current + 1} of ${items.length}` : "Department updates"}</span></div>
      {canEdit && <button className="chief-add-button" aria-label="Add Chief Note or Event" onClick={() => { setDraft({ ...emptyDraft }); setSelectedFiles([]); }}>+</button>}
    </header>
    <div className="chief-board-content">
      {item ? <article className={item.itemType}>
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
    {items.length > 1 && <footer className="chief-rotation-dots">{items.map((entry, index) => <button key={entry.id} className={index === current ? "active" : ""} aria-label={`Show ${entry.title}`} onClick={() => setCurrent(index)}/>)}</footer>}
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
