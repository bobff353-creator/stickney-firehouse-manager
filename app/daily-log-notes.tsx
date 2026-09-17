"use client";
import { useState } from "react";
import { useUnsavedWork } from "./use-unsaved-work";
import { logEntryTime, logNoteCategories, readLogNotes, writeLogNotes, type LogNoteCategory } from "./daily-log-workflow";

export default function DailyLogNotes({ value, onChange, recentNotes, onOpenDate, readOnly }: {
  value: string; onChange: (value: string) => void; recentNotes: { logDate: string; note: string }[];
  onOpenDate: (date: string) => void; readOnly: boolean;
}) {
  const { text, entries } = readLogNotes(value);
  const [category, setCategory] = useState<LogNoteCategory>("Station activity");
  const [draft, setDraft] = useState("");
  useUnsavedWork(Boolean(draft.trim()));
  const previousOpen = recentNotes.flatMap(note => readLogNotes(note.note).entries.filter(entry => entry.status === "Open").map(entry => ({ ...entry, logDate: note.logDate })));
  return <article id="log-notes" className="content-card notes-card log-section" aria-labelledby="log-notes-title" tabIndex={-1}>
    <div className="section-header"><div><h2 id="log-notes-title">Notes &amp; Handoff</h2><p>Add an entry during the shift. Review open items before officer sign-off.</p></div></div>
    <label><span>Shift notes · free-form</span><textarea rows={3} placeholder="General shift notes…" value={text} onChange={event => onChange(writeLogNotes(event.target.value, entries))} /></label>
    <div className="log-note-composer no-print">
      <label><span>Entry type</span><select value={category} onChange={event => setCategory(event.target.value as LogNoteCategory)}>{logNoteCategories.map(item => <option key={item}>{item}</option>)}</select></label>
      <label><span>New log entry</span><textarea rows={2} value={draft} onChange={event => setDraft(event.target.value)} placeholder="What happened, or what does the next officer need to know?" /></label>
      <button type="button" disabled={!draft.trim() || readOnly} onClick={() => {
        onChange(writeLogNotes(text, [...entries, { id: crypto.randomUUID(), at: new Date().toISOString(), category, status: category === "Station activity" ? "Recorded" : "Open", text: draft.trim() }]));
        setDraft("");
      }}>Add timestamped entry</button>
      <small>New entries join the autosaved log when you press Add. Equipment issues and handoff items stay open until marked resolved.</small>
    </div>
    <div className="log-note-entries">
      {[...entries].sort((a, b) => Number(b.status === "Open") - Number(a.status === "Open") || b.at.localeCompare(a.at)).map(entry => <article className={`log-note-entry ${entry.status === "Open" ? "open" : ""}`} key={entry.id}>
        <header><strong>{entry.category} · {entry.status}</strong><time dateTime={entry.at}>{logEntryTime(entry.at)} Central</time></header><p>{entry.text}</p>
        {entry.status !== "Recorded" && <button type="button" className="no-print" onClick={() => onChange(writeLogNotes(text, entries.map(item => item.id === entry.id ? { ...item, status: item.status === "Open" ? "Resolved" : "Open" } : item)))}>{entry.status === "Open" ? "Mark resolved" : "Reopen item"}</button>}
      </article>)}
    </div>
    {previousOpen.length > 0 && <section className="log-prior-open"><h3>Open items from the previous 7 days</h3><p>These belong to earlier logs. Review the original record before correcting its status.</p>{previousOpen.map((entry, index) => <article key={`${entry.logDate}-${entry.id}-${index}`}><strong>{entry.logDate} · {entry.category}</strong><p>{entry.text}</p><button type="button" className="no-print" onClick={() => onOpenDate(entry.logDate)}>Open original log · {entry.logDate}</button></article>)}</section>}
  </article>;
}
