"use client";

import { useEffect, useMemo, useState } from "react";

type PhoneEntry = { id: string; category: "fire" | "hospital" | "misc"; name: string; emergencyNumber: string; nonEmergencyNumber: string; notes: string; sortOrder: number };
const sectionNames = { fire: "Surrounding Area Fire Departments", hospital: "Area Hospitals", misc: "Miscellaneous & Department Numbers" };
const empty: PhoneEntry = { id: "", category: "misc", name: "", emergencyNumber: "", nonEmergencyNumber: "", notes: "", sortOrder: 99 };
const callHref = (number: string) => `tel:${number.replace(/[^\d+]/g, "")}`;

export default function PhoneNumbers() {
  const [numbers, setNumbers] = useState<PhoneEntry[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PhoneEntry | null>(null);
  const [message, setMessage] = useState("");
  const [canEdit, setCanEdit] = useState(false);

  async function load() {
    const response = await fetch("/api/phone-numbers");
    const data = await response.json() as { numbers?: PhoneEntry[]; canEdit?: boolean; error?: string };
    if (!response.ok) return setMessage(data.error || "Unable to load phone numbers");
    setNumbers(data.numbers ?? []); setCanEdit(Boolean(data.canEdit));
  }
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const filtered = useMemo(() => numbers.filter((entry) => `${entry.name} ${entry.emergencyNumber} ${entry.nonEmergencyNumber} ${entry.notes}`.toLowerCase().includes(search.toLowerCase())), [numbers, search]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const response = await fetch("/api/phone-numbers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
    const result = await response.json() as { error?: string };
    if (!response.ok) return setMessage(result.error || "Unable to save contact");
    setDraft(null); setMessage("Phone number saved."); await load();
  }
  async function remove(entry: PhoneEntry) {
    if (!window.confirm(`Remove ${entry.name} from the directory?`)) return;
    await fetch("/api/phone-numbers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "delete", id: entry.id }) });
    setMessage("Contact removed."); await load();
  }

  return <section className="phone-page">
    <div className="phone-hero standard-page-header">
      <div><span className="page-icon" aria-hidden="true">☏</span><div><p className="eyebrow">Quick reference directory</p><h1>Important Phone Numbers</h1><p>Tap any listed number to call.</p></div></div>
      {canEdit && <button className={editing ? "quiet-button" : "primary-action"} onClick={() => { setEditing((value) => !value); setDraft(null); }}>{editing ? "Done Editing" : "Admin Edit"}</button>}
    </div>
    <label className="phone-search"><span aria-hidden="true">⌕</span><span className="sr-only">Search phone numbers</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search departments, hospitals, or numbers…" /></label>
    {message && <div className="phone-message" role="status">{message}</div>}
    {editing && <div className="admin-edit-banner"><div><strong>Administrator editing enabled</strong><span>Select Edit beside a contact or add a new one. Changes are saved for everyone.</span></div><button className="primary-action compact" onClick={() => setDraft({ ...empty })}>+ Add Contact</button></div>}
    {draft && <form className="content-card phone-form" onSubmit={(event) => void save(event)}>
      <div className="section-header"><div><h2>{draft.id ? "Edit contact" : "Add contact"}</h2><p>Use the notes field for extensions, hours, or special instructions.</p></div><button type="button" className="quiet-button" onClick={() => setDraft(null)}>Cancel</button></div>
      <div className="phone-form-grid">
        <label><span>Section</span><select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as PhoneEntry["category"] })}><option value="fire">Fire Departments</option><option value="hospital">Hospitals</option><option value="misc">Miscellaneous</option></select></label>
        <label className="phone-name"><span>Name *</span><input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <label><span>Emergency number</span><input type="tel" value={draft.emergencyNumber} onChange={(event) => setDraft({ ...draft, emergencyNumber: event.target.value })} /></label>
        <label><span>Non-emergency / main number</span><input type="tel" value={draft.nonEmergencyNumber} onChange={(event) => setDraft({ ...draft, nonEmergencyNumber: event.target.value })} /></label>
        <label><span>Display order</span><input type="number" min="0" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) })} /></label>
        <label className="phone-notes"><span>Notes</span><input value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
      </div><button className="primary-action compact" type="submit">Save Contact</button>
    </form>}
    {(["fire", "hospital", "misc"] as const).map((category) => <section className="phone-section content-card" key={category}>
      <div className="phone-section-title"><span className="phone-section-icon" aria-hidden="true">{category === "fire" ? "◆" : category === "hospital" ? "+" : "☎"}</span><div><h2>{sectionNames[category]}</h2><p>{filtered.filter((entry) => entry.category === category).length} contacts</p></div></div>
      <div className="phone-grid">{filtered.filter((entry) => entry.category === category).map((entry) => <article className="phone-entry" key={entry.id}>
        <div className="phone-entry-heading"><h3>{entry.name}</h3>{editing && <div><button onClick={() => setDraft({ ...entry })}>Edit</button><button className="danger-link" onClick={() => void remove(entry)}>Remove</button></div>}</div>
        <div className="phone-actions">{entry.emergencyNumber && <a className="emergency-call" href={callHref(entry.emergencyNumber)}><span>Emergency</span><strong>{entry.emergencyNumber}</strong></a>}{entry.nonEmergencyNumber && <a href={callHref(entry.nonEmergencyNumber)}><span>{category === "fire" ? "Non-emergency" : "Main number"}</span><strong>{entry.nonEmergencyNumber}</strong></a>}</div>
        {entry.notes && <p className="phone-note">{entry.notes}</p>}
      </article>)}</div>
    </section>)}
    <p className="phone-disclaimer">Phone numbers can change. Administrators should review this directory regularly and correct any outdated listing.</p>
  </section>;
}
