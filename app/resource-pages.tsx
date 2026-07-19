"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RecordCredibility, type Revision } from "./record-credibility";

type AuditFields = {
  status?: string;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
  revisions?: Revision[];
};

type Policy = AuditFields & { id: string; title: string; policyNumber: string; category: string; effectiveDate: string; body: string };
type BoxCard = AuditFields & { id: string; title: string; address: string; boxNumber: string; accessNotes: string; details: string; department: string; documentUrl?: string; documentPage?: number };

const emptyPolicy: Policy = { id: "", title: "", policyNumber: "", category: "General", effectiveDate: "", body: "" };
const emptyBoxCard: BoxCard = { id: "", title: "", address: "", boxNumber: "", accessNotes: "", details: "", department: "Stickney" };

function PolicyRecord({ policy, canEdit, onEdit }: { policy: Policy; canEdit: boolean; onEdit: () => void }) {
  return <article className="content-card resource-record official-record policy-reader">
    <div className="resource-record-head">
      <div><span>{policy.category || "General"} · Policy {policy.policyNumber}</span><h2>{policy.title}</h2>{policy.effectiveDate && <time>Effective {policy.effectiveDate}</time>}</div>
      {canEdit && <button className="edit-employee no-print" onClick={onEdit}>Edit</button>}
    </div>
    <div className="resource-copy">{policy.body || "No policy text has been entered."}</div>
    <RecordCredibility audit={{ recordNumber: `POL-${policy.policyNumber || policy.id.slice(0, 8).toUpperCase()}`, status: policy.status || "Active", createdBy: policy.createdBy, createdAt: policy.createdAt, updatedBy: policy.updatedBy, updatedAt: policy.updatedAt, revisions: policy.revisions }} />
  </article>;
}

function PolicyLibrary({ policies, selectedId, onSelect, canEdit, onEdit }: {
  policies: Policy[];
  selectedId: string;
  onSelect: (id: string) => void;
  canEdit: boolean;
  onEdit: (policy: Policy) => void;
}) {
  const selected = policies.find((policy) => policy.id === selectedId) ?? policies[0];
  if (!selected) return null;

  return <div className="policy-library">
    <nav className="content-card policy-toc" aria-label="Policy table of contents">
      <div className="policy-toc-head"><div><p className="eyebrow">Table of contents</p><h2>Department policies</h2></div><strong>{policies.length}</strong></div>
      <div className="policy-toc-list">
        {policies.map((policy) => {
          const isCurrent = policy.id === selected.id;
          return <button className={isCurrent ? "current" : ""} key={policy.id} type="button" aria-current={isCurrent ? "page" : undefined} onClick={() => onSelect(policy.id)}>
            <span>{policy.policyNumber || "—"}</span><strong>{policy.title}</strong><small>{policy.category || "General"}</small>
          </button>;
        })}
      </div>
    </nav>
    <PolicyRecord policy={selected} canEdit={canEdit} onEdit={() => onEdit(selected)} />
  </div>;
}

function SharedPage({ type }: { type: "policy" | "boxCard" }) {
  const isPolicy = type === "policy";
  const [items, setItems] = useState<Array<Policy | BoxCard>>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedPolicyId, setSelectedPolicyId] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedBoxCardId, setSelectedBoxCardId] = useState("");
  const [draft, setDraft] = useState<Policy | BoxCard | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/resources?type=${type}`);
    const data = await response.json() as { items?: Array<Policy | BoxCard>; canEdit?: boolean; error?: string };
    if (!response.ok) return setMessage(data.error || "Unable to load records");
    setItems(data.items ?? []);
    setCanEdit(Boolean(data.canEdit));
  }, [type]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? items.filter((item) => Object.values(item).join(" ").toLowerCase().includes(query)) : items;
  }, [items, search]);
  const filteredPolicies = isPolicy ? filtered as Policy[] : [];
  const boxCards = useMemo(() => !isPolicy ? items as BoxCard[] : [], [isPolicy, items]);
  const departments = useMemo(() => Array.from(new Set(boxCards.map((card) => card.department || "Stickney"))).sort(), [boxCards]);
  const departmentCards = (filtered as BoxCard[])
    .filter((card) => (card.department || "Stickney") === selectedDepartment)
    .sort((a, b) => a.boxNumber.localeCompare(b.boxNumber, undefined, { numeric: true, sensitivity: "base" }) || a.title.localeCompare(b.title));
  const selectedBoxCard = departmentCards.find((card) => card.id === selectedBoxCardId);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const response = await fetch(`/api/resources?type=${type}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
    const result = await response.json() as { error?: string };
    if (!response.ok) return setMessage(result.error || "Unable to save record");
    setDraft(null);
    setMessage(isPolicy ? "Policy saved." : "Box Card saved.");
    await load();
  }

  return <section className="resource-page">
    <div className="resource-heading standard-page-header">
      <div><span className="page-icon" aria-hidden="true">{isPolicy ? "POL" : "BOX"}</span><div><p className="eyebrow">Stickney Fire Department</p><h1>{isPolicy ? "Policies" : "Box Cards"}</h1><p>{isPolicy ? "Choose a policy from the table of contents to read it." : "Search building access, box, and response card information."}</p></div></div>
      {canEdit ? <button className="primary-action" onClick={() => setDraft(isPolicy ? { ...emptyPolicy } : { ...emptyBoxCard })}>+ Add {isPolicy ? "Policy" : "Box Card"}</button> : <span className="read-only-badge">View only</span>}
    </div>
    {(isPolicy || selectedDepartment) && <label className="resource-search"><span aria-hidden="true">⌕</span><span className="sr-only">Search {isPolicy ? "policies" : "box cards"}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${isPolicy ? "by number, title, category, or policy text" : `${selectedDepartment} by box number, type, or area`}…`} /></label>}
    {message && <div className="phone-message" role="status">{message}</div>}

    {draft && <form className="content-card resource-form" onSubmit={(event) => void save(event)}>
      <div className="section-header"><div><h2>{draft.id ? "Edit" : "Add"} {isPolicy ? "Policy" : "Box Card"}</h2><p>Changes become available to everyone immediately after saving.</p></div><button type="button" className="quiet-button" onClick={() => setDraft(null)}>Cancel</button></div>
      {isPolicy ? (() => { const value = draft as Policy; return <div className="resource-form-grid">
        <label className="resource-title"><span>Policy title *</span><input required value={value.title} onChange={(event) => setDraft({ ...value, title: event.target.value })} /></label>
        <label><span>Policy number</span><input value={value.policyNumber} onChange={(event) => setDraft({ ...value, policyNumber: event.target.value })} /></label>
        <label><span>Category</span><input value={value.category} onChange={(event) => setDraft({ ...value, category: event.target.value })} /></label>
        <label><span>Effective date</span><input type="date" value={value.effectiveDate} onChange={(event) => setDraft({ ...value, effectiveDate: event.target.value })} /></label>
        <label className="resource-body"><span>Policy text</span><textarea rows={12} value={value.body} onChange={(event) => setDraft({ ...value, body: event.target.value })} /></label>
      </div>; })() : (() => { const value = draft as BoxCard; return <div className="resource-form-grid">
        <label className="resource-title"><span>Location / building name *</span><input required value={value.title} onChange={(event) => setDraft({ ...value, title: event.target.value })} /></label>
        <label><span>Box or card number</span><input value={value.boxNumber} onChange={(event) => setDraft({ ...value, boxNumber: event.target.value })} /></label>
        <label><span>Department *</span><input required value={value.department} onChange={(event) => setDraft({ ...value, department: event.target.value })} placeholder="Stickney, Berwyn, Forest View…" /></label>
        <label className="resource-wide"><span>Address</span><input value={value.address} onChange={(event) => setDraft({ ...value, address: event.target.value })} /></label>
        <label className="resource-wide"><span>Access notes</span><textarea rows={4} value={value.accessNotes} onChange={(event) => setDraft({ ...value, accessNotes: event.target.value })} /></label>
        <label className="resource-body"><span>Card details</span><textarea rows={9} value={value.details} onChange={(event) => setDraft({ ...value, details: event.target.value })} /></label>
      </div>; })()}
      <button className="primary-action compact" type="submit">Save {isPolicy ? "Policy" : "Box Card"}</button>
    </form>}

    {isPolicy && filteredPolicies.length > 0 && <PolicyLibrary policies={filteredPolicies} selectedId={selectedPolicyId} onSelect={setSelectedPolicyId} canEdit={canEdit} onEdit={setDraft} />}

    {!isPolicy && !selectedDepartment && <div className="box-department-grid">{departments.map((department) => {
      const count = boxCards.filter((card) => (card.department || "Stickney") === department).length;
      return <button className="content-card box-department-card" type="button" key={department} onClick={() => { setSelectedDepartment(department); setSelectedBoxCardId(""); setSearch(""); }}><span aria-hidden="true">BOX</span><div><strong>{department}</strong><small>{count} box {count === 1 ? "card" : "cards"}</small></div><b aria-hidden="true">›</b></button>;
    })}</div>}

    {!isPolicy && selectedDepartment && <div className="box-card-browser">
      <div className="box-browser-bar"><button className="quiet-button" type="button" onClick={() => { setSelectedDepartment(""); setSelectedBoxCardId(""); setSearch(""); }}>← All departments</button><div><span className="eyebrow">Department</span><strong>{selectedDepartment}</strong></div><span>{departmentCards.length} cards</span></div>
      <div className="policy-library box-card-library">
        <nav className="content-card policy-toc" aria-label={`${selectedDepartment} box cards`}><div className="policy-toc-head"><div><p className="eyebrow">Select a card</p><h2>{selectedDepartment} Box Cards</h2></div><strong>{departmentCards.length}</strong></div><div className="policy-toc-list">{departmentCards.map((item) => <button className={selectedBoxCard?.id === item.id ? "current" : ""} key={item.id} type="button" onClick={() => setSelectedBoxCardId(item.id)}><span>{item.boxNumber || "—"}</span><strong>{item.title}</strong><small>{item.address || "Response card"}</small></button>)}</div></nav>
        {selectedBoxCard ? <article className="content-card resource-record official-record box-card-viewer"><div className="resource-record-head"><div><span>{selectedDepartment} · Box Card {selectedBoxCard.boxNumber}</span><h2>{selectedBoxCard.title}</h2>{selectedBoxCard.address && <p>{selectedBoxCard.address}</p>}</div><div className="box-card-actions">{selectedBoxCard.documentUrl && <a className="primary-action compact" href={`${selectedBoxCard.documentUrl}#page=${selectedBoxCard.documentPage || 1}`} target="_blank" rel="noreferrer">Open full size</a>}{canEdit && <button className="edit-employee no-print" onClick={() => setDraft({ ...selectedBoxCard })}>Edit</button>}</div></div>{selectedBoxCard.documentUrl ? <iframe className="box-card-pdf" title={`${selectedBoxCard.title} box card`} src={`${selectedBoxCard.documentUrl}#page=${selectedBoxCard.documentPage || 1}&view=FitH`} /> : <><div className="resource-copy">{selectedBoxCard.details || "No card details have been entered."}</div><RecordCredibility audit={{ recordNumber: `BOX-${selectedBoxCard.boxNumber || selectedBoxCard.id.slice(0, 8).toUpperCase()}`, status: selectedBoxCard.status || "Active", createdBy: selectedBoxCard.createdBy, createdAt: selectedBoxCard.createdAt, updatedBy: selectedBoxCard.updatedBy, updatedAt: selectedBoxCard.updatedAt, revisions: selectedBoxCard.revisions }} /></>}</article> : <div className="content-card box-select-prompt"><span aria-hidden="true">BOX</span><div><strong>Select a box card</strong><p>Choose a card from the list to open the official response document.</p></div></div>}
      </div>
    </div>}

    {(isPolicy ? filtered.length === 0 : selectedDepartment ? departmentCards.length === 0 : departments.length === 0) && <div className="content-card action-empty-state resource-action-empty"><span aria-hidden="true">⌕</span><div><strong>No matching {isPolicy ? "policies" : "Box Cards"}</strong><p>{search ? "Try another search or clear the current search." : canEdit ? `Add the first ${isPolicy ? "policy" : "Box Card"} to make it available to the department.` : "An administrator has not added any records yet."}</p></div>{search ? <button className="quiet-button" onClick={() => setSearch("")}>Clear Search</button> : canEdit ? <button className="quiet-button" onClick={() => setDraft(isPolicy ? { ...emptyPolicy } : { ...emptyBoxCard })}>Add {isPolicy ? "Policy" : "Box Card"}</button> : null}</div>}
  </section>;
}

export function PoliciesPage() { return <SharedPage type="policy" />; }
export function BoxCardsPage() { return <SharedPage type="boxCard" />; }
