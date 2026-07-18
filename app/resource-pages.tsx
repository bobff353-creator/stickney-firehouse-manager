"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RecordCredibility, type Revision } from "./record-credibility";

type AuditFields = { status?: string; createdAt?: string; createdBy?: string; updatedAt?: string; updatedBy?: string; revisions?: Revision[] };
type Policy = AuditFields & { id: string; title: string; policyNumber: string; category: string; effectiveDate: string; body: string };
type BoxCard = AuditFields & { id: string; title: string; address: string; boxNumber: string; accessNotes: string; details: string };
const emptyPolicy: Policy = { id: "", title: "", policyNumber: "", category: "General", effectiveDate: "", body: "" };
const emptyBoxCard: BoxCard = { id: "", title: "", address: "", boxNumber: "", accessNotes: "", details: "" };

function SharedPage({ type }: { type: "policy" | "boxCard" }) {
  const isPolicy = type === "policy";
  const [items, setItems] = useState<Array<Policy | BoxCard>>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Policy | BoxCard | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/resources?type=${type}`);
    const data = await response.json() as { items?: Array<Policy | BoxCard>; canEdit?: boolean; error?: string };
    if (!response.ok) return setMessage(data.error || "Unable to load records");
    setItems(data.items ?? []); setCanEdit(Boolean(data.canEdit));
  }, [type]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const filtered = useMemo(() => items.filter((item) => Object.values(item).join(" ").toLowerCase().includes(search.toLowerCase())), [items, search]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const response = await fetch(`/api/resources?type=${type}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
    const result = await response.json() as { error?: string };
    if (!response.ok) return setMessage(result.error || "Unable to save record");
    setDraft(null); setMessage(isPolicy ? "Policy saved." : "Box Card saved."); await load();
  }

  return <section className="resource-page">
    <div className="resource-heading standard-page-header"><div><span className="page-icon" aria-hidden="true">{isPolicy ? "▤" : "⌑"}</span><div><p className="eyebrow">Stickney Fire Department</p><h1>{isPolicy ? "Policies" : "Box Cards"}</h1><p>{isPolicy ? "Search and review department policies." : "Search building access, box, and response card information."}</p></div></div>{canEdit ? <button className="primary-action" onClick={() => setDraft(isPolicy ? { ...emptyPolicy } : { ...emptyBoxCard })}>+ Add {isPolicy ? "Policy" : "Box Card"}</button> : <span className="read-only-badge">View only</span>}</div>
    <label className="resource-search"><span aria-hidden="true">⌕</span><span className="sr-only">Search {isPolicy ? "policies" : "box cards"}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${isPolicy ? "policies" : "box cards"}…`} /></label>
    {message && <div className="phone-message" role="status">{message}</div>}
    {draft && <form className="content-card resource-form" onSubmit={(event) => void save(event)}><div className="section-header"><div><h2>{draft.id ? "Edit" : "Add"} {isPolicy ? "Policy" : "Box Card"}</h2><p>Changes become available to everyone immediately after saving.</p></div><button type="button" className="quiet-button" onClick={() => setDraft(null)}>Cancel</button></div>
      {isPolicy ? (() => { const value = draft as Policy; return <div className="resource-form-grid"><label className="resource-title"><span>Policy title *</span><input required value={value.title} onChange={(event) => setDraft({ ...value, title: event.target.value })} /></label><label><span>Policy number</span><input value={value.policyNumber} onChange={(event) => setDraft({ ...value, policyNumber: event.target.value })} /></label><label><span>Category</span><input value={value.category} onChange={(event) => setDraft({ ...value, category: event.target.value })} /></label><label><span>Effective date</span><input type="date" value={value.effectiveDate} onChange={(event) => setDraft({ ...value, effectiveDate: event.target.value })} /></label><label className="resource-body"><span>Policy text</span><textarea rows={12} value={value.body} onChange={(event) => setDraft({ ...value, body: event.target.value })} /></label></div>; })() : (() => { const value = draft as BoxCard; return <div className="resource-form-grid"><label className="resource-title"><span>Location / building name *</span><input required value={value.title} onChange={(event) => setDraft({ ...value, title: event.target.value })} /></label><label><span>Box or card number</span><input value={value.boxNumber} onChange={(event) => setDraft({ ...value, boxNumber: event.target.value })} /></label><label className="resource-wide"><span>Address</span><input value={value.address} onChange={(event) => setDraft({ ...value, address: event.target.value })} /></label><label className="resource-wide"><span>Access notes</span><textarea rows={4} value={value.accessNotes} onChange={(event) => setDraft({ ...value, accessNotes: event.target.value })} /></label><label className="resource-body"><span>Card details</span><textarea rows={9} value={value.details} onChange={(event) => setDraft({ ...value, details: event.target.value })} /></label></div>; })()}
      <button className="primary-action compact" type="submit">Save {isPolicy ? "Policy" : "Box Card"}</button></form>}
    <div className="resource-list">{filtered.map((item) => <article className="content-card resource-record official-record" key={item.id}><div className="resource-record-head"><div><span>{isPolicy ? `${(item as Policy).category || "General"}${(item as Policy).policyNumber ? ` · ${(item as Policy).policyNumber}` : ""}` : `Box Card${(item as BoxCard).boxNumber ? ` · ${(item as BoxCard).boxNumber}` : ""}`}</span><h2>{item.title}</h2>{isPolicy ? (item as Policy).effectiveDate && <time>Effective {(item as Policy).effectiveDate}</time> : (item as BoxCard).address && <p>{(item as BoxCard).address}</p>}</div>{canEdit && <button className="edit-employee no-print" onClick={() => setDraft({ ...item })}>Edit</button>}</div>{!isPolicy && (item as BoxCard).accessNotes && <div className="access-note"><strong>Access</strong><p>{(item as BoxCard).accessNotes}</p></div>}<div className="resource-copy">{isPolicy ? (item as Policy).body || "No policy text has been entered." : (item as BoxCard).details || "No card details have been entered."}</div><RecordCredibility audit={{ recordNumber: isPolicy ? `POL-${(item as Policy).policyNumber || item.id.slice(0, 8).toUpperCase()}` : `BOX-${(item as BoxCard).boxNumber || item.id.slice(0, 8).toUpperCase()}`, status: item.status || "Active", createdBy: item.createdBy, createdAt: item.createdAt, updatedBy: item.updatedBy, updatedAt: item.updatedAt, revisions: item.revisions }} /></article>)}</div>
    {filtered.length === 0 && <div className="content-card action-empty-state resource-action-empty"><span aria-hidden="true">⌕</span><div><strong>No matching {isPolicy ? "policies" : "Box Cards"}</strong><p>{search ? "Try another search or clear the current search." : canEdit ? `Add the first ${isPolicy ? "policy" : "Box Card"} to make it available to the department.` : "An administrator has not added any records yet."}</p></div>{search ? <button className="quiet-button" onClick={() => setSearch("")}>Clear Search</button> : canEdit ? <button className="quiet-button" onClick={() => setDraft(isPolicy ? { ...emptyPolicy } : { ...emptyBoxCard })}>Add {isPolicy ? "Policy" : "Box Card"}</button> : null}</div>}
  </section>;
}

export function PoliciesPage() { return <SharedPage type="policy" />; }
export function BoxCardsPage() { return <SharedPage type="boxCard" />; }
