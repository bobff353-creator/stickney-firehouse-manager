"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { readPortalJson } from "./portal-status";
import { confirmLeavingWork, useUnsavedWork } from "./use-unsaved-work";

type FleetCheck = { apparatusId: string; unit: string; checkType: "daily" | "weekly" | "inventory" | "air_pack"; startTime: string; endTime: string; status: "pending" | "in_progress" | "completed" | "not_needed"; startedAt: string | null; completedAt: string | null };
type Duty = { id: string; dayOfWeek: number; shiftKey: "morning" | "afternoon" | "night"; duty: string; updatedBy: string; updatedAt: string; fleetChecks?: FleetCheck[] };
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const orderedDays = [1, 2, 3, 4, 5, 6, 0];
const shiftLabels = { morning: "Morning · 6:00 AM–Noon", afternoon: "Afternoon · Noon–6:00 PM", night: "Night · 6:00 PM–6:00 AM" };

export default function DailyDuties() {
  const [items, setItems] = useState<Duty[]>([]), [canEdit, setCanEdit] = useState(false), [draft, setDraft] = useState<Duty | null>(null), [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showWeek, setShowWeek] = useState(false);
  const today = days.indexOf(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "long" }).format(new Date()));
  const dirty = Boolean(draft && draft.duty !== items.find(item => item.id === draft.id)?.duty);
  useUnsavedWork(dirty, saving);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await readPortalJson<{ items?: Duty[]; canEdit?: boolean }>("/api/daily-duties", "Unable to load Daily Duties.");
      setItems(result.items ?? []); setCanEdit(Boolean(result.canEdit)); setError("");
    } catch { setError("Daily duties could not be loaded. Retry to verify the assigned work."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const grouped = useMemo(() => orderedDays.map((day) => {
    const duties = items.filter((item) => item.dayOfWeek === day);
    const weeklyChecks = [...new Map(
      duties.flatMap((item) => item.fleetChecks ?? []).map((check) => [`${check.apparatusId}-${check.checkType}`, check]),
    ).values()];
    return { day, duties, weeklyChecks };
  }), [items]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/daily-duties", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to save Daily Duty.");
      setDraft(null); setMessage("Daily Duty approved and saved."); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The duty was not saved. Your wording is still here; retry when connected."); }
    finally { setSaving(false); }
  }

  function closeEditor() { if (confirmLeavingWork()) setDraft(null); }

  return <section className="daily-duties-page">
    <div className="standard-page-header"><div><span className="page-icon">DUTY</span><div><p className="eyebrow">Documents</p><h1>Daily Duties</h1><p>The Live Operations Board automatically shows only the duty for the current day and shift.</p></div></div>{canEdit ? <span className="admin-edit-badge">Administrator editing enabled</span> : <span className="read-only-badge">View only</span>}</div>
    {message && <div className="phone-message" role="status">{message}</div>}
    {error && <div className="error-banner" role="alert"><span>{error}</span>{!draft && <button disabled={loading} onClick={() => void load()}>Retry duties</button>}</div>}
    <div className="duty-view-controls" aria-label="Duty schedule range"><button aria-pressed={!showWeek} onClick={() => setShowWeek(false)}>Today · {days[today]}</button><button aria-pressed={showWeek} onClick={() => setShowWeek(true)}>Whole week</button></div>
    {loading && <p role="status">Loading assigned duties…</p>}
    {!loading && !error && !items.length && <p>No duty instructions have been entered. This does not confirm that checks are complete.</p>}
    <div className="daily-duty-schedule">{grouped.filter(group => showWeek || group.day === today).map(({ day, duties, weeklyChecks }) => <article className="content-card duty-day-card" key={day}><header><span>{days[day].slice(0, 3).toUpperCase()}</span><h2>{days[day]}</h2></header><div>{weeklyChecks.length ? <section className="day-fleet-duty"><div><strong>Scheduled apparatus and inventory checks</strong><p>Admin scheduling controls the required day, time window, Operations Board, and officer sign-out requirement.</p><div className="duty-fleet-links">{weeklyChecks.map((check) => check.status === "not_needed" ? <span key={`${check.apparatusId}-${check.checkType}`} className="duty-fleet-link not_needed"><b>— {check.unit} · {check.checkType.replaceAll("_", " ")}</b><span>Not needed — apparatus out of service</span></span> : <Link key={`${check.apparatusId}-${check.checkType}`} className={`duty-fleet-link ${check.status}`} href={`/inventory?apparatus=${encodeURIComponent(check.apparatusId)}&check=${encodeURIComponent(check.checkType)}`}><b>{check.status === "completed" ? "✓" : check.status === "in_progress" ? "↻" : "→"} {check.unit} · {check.checkType.replaceAll("_", " ")}</b><span>{check.status === "completed" ? "Check completed" : check.status === "in_progress" ? "Resume shared check" : "Start required check"} · {check.startTime}–{check.endTime}</span></Link>)}</div></div></section> : null}{duties.map((item) => <section key={item.id}><div><strong>{shiftLabels[item.shiftKey]}</strong><p>{item.duty}</p></div>{canEdit && <button className="edit-employee no-print" onClick={() => setDraft({ ...item })}>Edit</button>}</section>)}</div></article>)}</div>
    {draft && <div className="duty-editor-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) closeEditor(); }}><form className="content-card duty-editor" role="dialog" aria-modal="true" aria-label="Edit daily duty" onSubmit={(event) => void save(event)}><div className="section-header"><div><p className="eyebrow">Administrator approval</p><h2>Edit {days[draft.dayOfWeek]} duty</h2><p>{shiftLabels[draft.shiftKey]}</p></div><button type="button" className="quiet-button" onClick={closeEditor}>Cancel</button></div>{error && <div className="error-banner" role="alert">{error}</div>}{dirty && <p className="unsaved-work-notice">Unsaved duty wording</p>}<label><span>Duty instructions</span><textarea readOnly={saving} required rows={7} value={draft.duty} onChange={(event) => setDraft({ ...draft, duty: event.target.value })} /></label><div className="duty-editor-actions"><small>Saving publishes this approved wording to Documents and the rotating Live Operations Board.</small><button className="primary-action compact" type="submit" disabled={saving}>{saving ? "Saving…" : "Approve & Save"}</button></div></form></div>}
  </section>;
}
