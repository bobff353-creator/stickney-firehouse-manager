"use client";

import { useEffect, useMemo, useState } from "react";
import ConfirmDialog from "./confirm-dialog";
import { confirmLeavingWork, useUnsavedWork } from "./use-unsaved-work";
import { readPortalJson } from "./portal-status";

type PhoneEntry = { id: string; category: "fire" | "hospital" | "misc"; name: string; emergencyNumber: string; nonEmergencyNumber: string; notes: string; sortOrder: number };
const sectionNames = { fire: "Surrounding Area Fire Departments", hospital: "Area Hospitals", misc: "Miscellaneous & Department Numbers" };
const empty: PhoneEntry = { id: "", category: "misc", name: "", emergencyNumber: "", nonEmergencyNumber: "", notes: "", sortOrder: 99 };
const callHref = (number: string) => `tel:${number.replace(/[^\d+]/g, "")}`;

export default function PhoneNumbers() {
  const [numbers, setNumbers] = useState<PhoneEntry[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(true);
  const [draft, setDraft] = useState<PhoneEntry | null>(null);
  const [draftBaseline, setDraftBaseline] = useState("");
  const [message, setMessage] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<PhoneEntry | null>(null);
  const [removing, setRemoving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useUnsavedWork(Boolean(draft) && JSON.stringify(draft) !== draftBaseline, saving || removing);

  function editContact(entry: PhoneEntry) {
    if (!confirmLeavingWork()) return;
    setDraft({ ...entry }); setDraftBaseline(JSON.stringify(entry));
    window.setTimeout(() => { const form = document.querySelector<HTMLElement>(".phone-form"); form?.scrollIntoView({ block: "start", behavior: "instant" }); form?.querySelector<HTMLInputElement>("input[required]")?.focus({ preventScroll: true }); }, 0);
  }

  async function load() {
    setLoading(true);
    try {
    const data = await readPortalJson<{ numbers?: PhoneEntry[]; canEdit?: boolean }>("/api/phone-numbers", "Unable to load phone numbers");
    setNumbers(data.numbers ?? []); setCanEdit(Boolean(data.canEdit));
    setError("");
    } catch (caught) { setError(`${caught instanceof Error ? caught.message : "Directory unavailable"}. Retry to confirm the latest directory.`); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(new URLSearchParams(window.location.search).get("query") ?? ""); void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const filtered = useMemo(() => numbers.filter((entry) => `${entry.name} ${entry.emergencyNumber} ${entry.nonEmergencyNumber} ${entry.notes}`.toLowerCase().includes(search.toLowerCase())), [numbers, search]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
    const response = await fetch("/api/phone-numbers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || "Unable to save contact");
    setDraft(null); setMessage("Phone number saved."); await load();
    } catch (caught) { setError(`${caught instanceof Error ? caught.message : "Contact was not saved"}. Your edits are still here. Retry Save Contact.`); }
    finally { setSaving(false); }
  }
  async function remove(entry: PhoneEntry) {
    if (removing) return;
    setRemoving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/phone-numbers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete", id: entry.id }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Contact was not removed");
      setMessage("Contact removed."); setPendingRemove(null); await load();
    } catch (caught) { setError(`${caught instanceof Error ? caught.message : "Contact was not removed"}. No removal has been confirmed. Retry when ready.`); setPendingRemove(null); }
    finally { setRemoving(false); }
  }

  return <section className="phone-page">
    <ConfirmDialog open={Boolean(pendingRemove)} title="Remove this contact?" description={`${pendingRemove?.name ?? "This contact"} will be removed from the shared Important Phone Numbers directory.`} confirmLabel="Remove Contact" tone="danger" busy={removing} onCancel={() => setPendingRemove(null)} onConfirm={() => { if (pendingRemove) void remove(pendingRemove); }} />
    <div className="phone-hero standard-page-header">
      <div><span className="page-icon" aria-hidden="true">☏</span><div><p className="eyebrow">Quick reference directory</p><h1>Important Phone Numbers</h1><p>Tap any listed number to call.</p></div></div>
      {canEdit && <button className={editing ? "quiet-button" : "primary-action"} disabled={saving || removing} onClick={() => { if (confirmLeavingWork()) { setEditing((value) => !value); setDraft(null); } }}>{editing ? "Preview directory" : "Back to editing"}</button>}
    </div>
    {canEdit && !editing && <p className="admin-preview-banner">Directory preview · Editing controls are hidden. This does not change your account or access.</p>}
    <label className="phone-search"><span aria-hidden="true">⌕</span><span className="sr-only">Search phone numbers</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search departments, hospitals, or numbers…" /></label>
    {loading && <p role="status">Loading directory…</p>}
    {error && <div className="error-banner" role="alert"><span>{error}</span><button type="button" disabled={loading || saving || removing} onClick={() => void load()}>Retry directory</button></div>}
    {message && <div className="phone-message" role="status">{message}</div>}
    {canEdit && editing && <div className="admin-edit-banner"><div><strong>Edit the shared directory</strong><span>Choose Edit beside a contact, or add a new one. Changes apply only after Save Contact.</span></div><button className="primary-action compact" disabled={saving} onClick={() => editContact(empty)}>+ Add Contact</button></div>}
    {draft && <form className="content-card phone-form" onSubmit={(event) => void save(event)}>
      <fieldset className="portal-save-fields" disabled={saving}>
      <div className="section-header"><div><h2>{draft.id ? "Edit contact" : "Add contact"}</h2><p>Use the notes field for extensions, hours, or special instructions.</p></div><button type="button" className="quiet-button" disabled={saving} onClick={() => { if (confirmLeavingWork()) setDraft(null); }}>Cancel</button></div>
      <div className="phone-form-grid">
        <label><span>Section</span><select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as PhoneEntry["category"] })}><option value="fire">Fire Departments</option><option value="hospital">Hospitals</option><option value="misc">Miscellaneous</option></select></label>
        <label className="phone-name"><span>Name *</span><input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <label><span>Emergency number</span><input type="tel" value={draft.emergencyNumber} onChange={(event) => setDraft({ ...draft, emergencyNumber: event.target.value })} /></label>
        <label><span>Non-emergency / main number</span><input type="tel" value={draft.nonEmergencyNumber} onChange={(event) => setDraft({ ...draft, nonEmergencyNumber: event.target.value })} /></label>
        <label><span>Display order</span><input type="number" min="0" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) })} /></label>
        <label className="phone-notes"><span>Notes</span><input value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
      </div><div className="admin-save-bar"><span>{JSON.stringify(draft) !== draftBaseline ? "Unsaved changes" : "Editing contact"}</span><div><button type="button" className="quiet-button" disabled={saving} onClick={() => { if (confirmLeavingWork()) setDraft(null); }}>Cancel editing</button><button className="primary-action compact" disabled={saving} type="submit">{saving ? "Saving…" : "Save Contact"}</button></div></div>
      </fieldset>
    </form>}
    {(["fire", "hospital", "misc"] as const).map((category) => <section className="phone-section content-card" key={category}>
      <div className="phone-section-title"><span className="phone-section-icon" aria-hidden="true">{category === "fire" ? "◆" : category === "hospital" ? "+" : "☎"}</span><div><h2>{sectionNames[category]}</h2><p>{filtered.filter((entry) => entry.category === category).length} contacts</p></div></div>
      <div className="phone-grid">{filtered.filter((entry) => entry.category === category).map((entry) => <article className="phone-entry" key={entry.id}>
        <div className="phone-entry-heading"><h3>{entry.name}</h3>{canEdit && editing && <div><button disabled={saving} onClick={() => editContact(entry)}>Edit</button><button className="danger-link" disabled={saving || removing} onClick={() => { if (confirmLeavingWork()) { setDraft(null); setPendingRemove(entry); } }}>Remove</button></div>}</div>
        <div className="phone-actions">{entry.emergencyNumber && <a className="emergency-call" href={callHref(entry.emergencyNumber)}><span>Emergency</span><strong>{entry.emergencyNumber}</strong></a>}{entry.nonEmergencyNumber && <a href={callHref(entry.nonEmergencyNumber)}><span>{category === "fire" ? "Non-emergency" : "Main number"}</span><strong>{entry.nonEmergencyNumber}</strong></a>}</div>
        {entry.notes && <p className="phone-note">{entry.notes}</p>}
      </article>)}{!loading && !error && filtered.filter((entry) => entry.category === category).length === 0 && <div className="action-empty-state phone-empty"><span aria-hidden="true">⌕</span><div><strong>No contacts found</strong><p>{search ? "Try a different search or clear the search box." : `No contacts have been added to ${sectionNames[category]}.`}</p></div>{search ? <button className="quiet-button" onClick={() => setSearch("")}>Clear Search</button> : canEdit && editing ? <button className="quiet-button" onClick={() => editContact({ ...empty, category })}>Add Contact</button> : null}</div>}</div>
    </section>)}
    <p className="phone-disclaimer">Phone numbers can change. Administrators should review this directory regularly and correct any outdated listing.</p>
  </section>;
}
