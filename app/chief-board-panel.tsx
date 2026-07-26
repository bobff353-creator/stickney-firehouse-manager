"use client";

import { useCallback, useEffect, useState } from "react";

type ChiefItem = { id: string; itemType: "note" | "event"; title: string; body: string; eventDate: string; createdBy: string; createdAt: string };
const emptyDraft = { itemType: "note" as "note" | "event", title: "", body: "", eventDate: "" };

export default function ChiefBoardPanel() {
  const [items, setItems] = useState<ChiefItem[]>([]), [canEdit, setCanEdit] = useState(false), [current, setCurrent] = useState(0), [draft, setDraft] = useState<typeof emptyDraft | null>(null), [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/chief-board");
    const result = await response.json() as { items?: ChiefItem[]; canEdit?: boolean; error?: string };
    if (!response.ok) return setMessage(result.error || "Unable to load Chief Notes and Events.");
    setItems(result.items ?? []); setCanEdit(Boolean(result.canEdit)); setCurrent(0);
  }, []);
  useEffect(() => { const initial = window.setTimeout(() => void load(), 0); const refresh = window.setInterval(() => void load(), 30000); return () => { window.clearTimeout(initial); window.clearInterval(refresh); }; }, [load]);
  useEffect(() => { if (items.length < 2) return; const timer = window.setInterval(() => setCurrent((value) => (value + 1) % items.length), 9000); return () => window.clearInterval(timer); }, [items.length]);
  const item = items[current];

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const response = await fetch("/api/chief-board", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
    const result = await response.json() as { error?: string };
    if (!response.ok) return setMessage(result.error || "Unable to add information.");
    setDraft(null); setMessage("Added to the Live Operations Board."); await load();
  }

  return <section className="board-panel chief-board-panel" aria-live="polite">
    <header><div><h2>Chief Notes & Events</h2><span>{items.length ? `${current + 1} of ${items.length}` : "Department updates"}</span></div>{canEdit && <button className="chief-add-button" aria-label="Add Chief Note or Event" onClick={() => setDraft({ ...emptyDraft })}>+</button>}</header>
    <div className="chief-board-content">{item ? <article className={item.itemType}><div><span>{item.itemType === "event" ? "UPCOMING EVENT" : "CHIEF NOTE"}</span>{item.eventDate && <time>{new Date(`${item.eventDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</time>}</div><h3>{item.title}</h3><p>{item.body}</p></article> : <div className="board-empty"><strong>No Chief Notes or Events</strong><p>Administrators can use the + button to post information here.</p></div>}</div>
    {items.length > 1 && <footer className="chief-rotation-dots">{items.map((entry, index) => <button key={entry.id} className={index === current ? "active" : ""} aria-label={`Show ${entry.title}`} onClick={() => setCurrent(index)}/>)}</footer>}
    {message && <div className="chief-board-message" role="status">{message}</div>}
    {draft && <div className="chief-editor-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setDraft(null); }}><form className="chief-editor" onSubmit={(event) => void save(event)}><header><div><p>Administrator</p><h2>Add Board Information</h2></div><button type="button" aria-label="Close" onClick={() => setDraft(null)}>×</button></header><label><span>Information type</span><select value={draft.itemType} onChange={(event) => setDraft({ ...draft, itemType: event.target.value as "note" | "event", eventDate: event.target.value === "event" ? draft.eventDate : "" })}><option value="note">Chief Note</option><option value="event">Event</option></select></label>{draft.itemType === "event" && <label><span>Event date</span><input required type="date" value={draft.eventDate} onChange={(event) => setDraft({ ...draft, eventDate: event.target.value })}/></label>}<label><span>Title</span><input required maxLength={80} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder={draft.itemType === "event" ? "Example: Department training" : "Example: Message from the Chief"}/></label><label><span>Message</span><textarea required rows={6} maxLength={700} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })}/></label><footer><button type="button" onClick={() => setDraft(null)}>Cancel</button><button type="submit">Add to Board</button></footer></form></div>}
  </section>;
}
