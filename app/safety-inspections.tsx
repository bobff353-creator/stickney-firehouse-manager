"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Template = { id: string; slug: string; title: string; description: string; cadence: string; category: string; active: number };
type TemplateItem = { id: string; templateId: string; sectionName: string; label: string; equipmentType: string; required: number; active: number; sortOrder: number };
type InspectionSummary = { id: string; templateId: string; templateTitle: string; inspectionDate: string; inspectorName: string; status: string; overallNotes: string; updatedAt: string; submittedAt?: string | null; totalItems: number; passedItems: number; deficientItems: number; notApplicableItems: number };
type Inspection = { id: string; templateId: string; inspectionDate: string; inspectorName: string; status: string; overallNotes: string; createdBy: string; updatedBy: string; updatedAt: string; submittedBy?: string | null; submittedAt?: string | null };
type InspectionResult = { id: string; inspectionId: string; templateItemId: string; status: "not_checked" | "pass" | "deficient" | "not_applicable"; deficiencyNote: string; correctedOnSite: number; snapshotSectionName: string; snapshotLabel: string; snapshotEquipmentType: string; snapshotRequired: number; snapshotSortOrder: number };
type Attachment = { id: string; filename: string; contentType: string; sizeBytes: number; createdBy: string; createdAt: string };
type Payload = {
  viewer: { name: string; employeeId: string | null; canComplete: boolean; canManage: boolean };
  templates: Template[];
  templateItems: TemplateItem[];
  inspections: InspectionSummary[];
  inspection: Inspection | null;
  results: InspectionResult[];
  attachments: Attachment[];
  error?: string;
};

function chicagoDate() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function displayDate(value: string) {
  if (!value) return "Date not entered";
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T12:00:00Z`));
}

function statusLabel(status: string) {
  return status === "submitted" ? "Submitted" : status === "reopened" ? "Reopened for correction" : "Draft";
}

function bytesLabel(value: number) {
  return value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`;
}

export default function SafetyInspections({ readOnly = false }: { readOnly?: boolean }) {
  const [data, setData] = useState<Payload | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<{ date: string; notes: string; results: InspectionResult[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState(chicagoDate().slice(0, 7));
  const [editingChecklist, setEditingChecklist] = useState(false);
  const [itemDrafts, setItemDrafts] = useState<TemplateItem[]>([]);

  const load = useCallback(async (inspectionId = "") => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/safety-inspections${inspectionId ? `?inspectionId=${encodeURIComponent(inspectionId)}` : ""}`, { cache: "no-store" });
      const payload = await response.json() as Payload;
      if (!response.ok) throw new Error(payload.error || "Unable to load monthly safety inspections.");
      setData(payload);
      setSelectedId(inspectionId);
      setDraft(payload.inspection ? { date: payload.inspection.inspectionDate, notes: payload.inspection.overallNotes, results: payload.results } : null);
      setItemDrafts(payload.templateItems);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load monthly safety inspections.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const template = useMemo(() => data?.templates.find((item) => item.id === (data.inspection?.templateId || data.templates[0]?.id)), [data]);
  const templateItems = useMemo(() => (data?.templateItems || []).filter((item) => item.templateId === template?.id && item.active).sort((a, b) => a.sortOrder - b.sortOrder), [data?.templateItems, template?.id]);
  const recordItems = useMemo(() => draft?.results.map((result) => ({
    id: result.templateItemId,
    sectionName: result.snapshotSectionName,
    label: result.snapshotLabel,
    equipmentType: result.snapshotEquipmentType,
    required: result.snapshotRequired,
    active: 1,
    sortOrder: result.snapshotSortOrder,
    templateId: data?.inspection?.templateId || "",
  })).sort((a, b) => a.sortOrder - b.sortOrder) || [], [data?.inspection?.templateId, draft?.results]);
  const recordSections = useMemo(() => [...new Set(recordItems.map((item) => item.sectionName))], [recordItems]);
  const filtered = useMemo(() => (data?.inspections || []).filter((item) => (statusFilter === "all" || item.status === statusFilter) && (!monthFilter || item.inspectionDate.startsWith(monthFilter))), [data?.inspections, monthFilter, statusFilter]);
  const monthSubmitted = filtered.filter((item) => item.status === "submitted").length;
  const monthDeficiencies = filtered.reduce((sum, item) => sum + Number(item.deficientItems || 0), 0);
  const currentEditable = Boolean(data?.inspection && draft && data.viewer.canComplete && !readOnly && data.inspection.status !== "submitted");

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/safety-inspections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => ({})) as { error?: string; inspectionId?: string };
    if (!response.ok) throw new Error(payload.error || "The inspection could not be saved.");
    return payload;
  }

  async function startInspection() {
    if (!template || readOnly) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const result = await post({ action: "create", templateId: template.id, inspectionDate: chicagoDate() });
      await load(result.inspectionId || "");
      setMessage("New monthly inspection started. Every required extinguisher is ready to check.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to start the inspection."); }
    finally { setSaving(false); }
  }

  function updateResult(itemId: string, patch: Partial<InspectionResult>) {
    setDraft((current) => current ? { ...current, results: current.results.map((item) => item.templateItemId === itemId ? { ...item, ...patch } : item) } : current);
  }

  async function save(submit = false) {
    if (!data?.inspection || !draft) return;
    if (submit && !window.confirm("Submit this monthly safety inspection? It will become read only until an officer reopens it.")) return;
    setSaving(true); setError(""); setMessage("");
    try {
      await post({ action: submit ? "submit" : "save", inspectionId: data.inspection.id, inspectionDate: draft.date, overallNotes: draft.notes, results: draft.results });
      await load(data.inspection.id);
      setMessage(submit ? "Inspection submitted and time stamped." : "Draft saved.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save the inspection."); }
    finally { setSaving(false); }
  }

  async function reopen() {
    if (!data?.inspection || !window.confirm("Reopen this submitted inspection for correction? The action will be time stamped.")) return;
    setSaving(true); setError("");
    try { await post({ action: "reopen", inspectionId: data.inspection.id }); await load(data.inspection.id); setMessage("Inspection reopened for correction."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to reopen the inspection."); }
    finally { setSaving(false); }
  }

  async function upload(file: File | null) {
    if (!file || !data?.inspection) return;
    setSaving(true); setError("");
    try {
      const form = new FormData(); form.set("inspectionId", data.inspection.id); form.set("file", file);
      const response = await fetch("/api/safety-inspections/attachments", { method: "POST", body: form });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "The file could not be attached.");
      await load(data.inspection.id); setMessage("Supporting file attached.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to attach the file."); }
    finally { setSaving(false); }
  }

  async function removeAttachment(id: string) {
    if (!data?.inspection || !window.confirm("Remove this supporting file?")) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/safety-inspections/attachments/${id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "The file could not be removed.");
      await load(data.inspection.id); setMessage("Supporting file removed.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to remove the file."); }
    finally { setSaving(false); }
  }

  async function saveChecklistItem(item: TemplateItem) {
    setSaving(true); setError(""); setMessage("");
    try {
      await post({ action: "updateItem", item: { ...item, required: Boolean(item.required), active: Boolean(item.active) } });
      await load(selectedId); setEditingChecklist(true); setMessage(`Checklist location “${item.label}” updated. Existing submitted records were not changed.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update the checklist."); }
    finally { setSaving(false); }
  }

  function emailSummary() {
    const lines = filtered.map((item) => `${displayDate(item.inspectionDate)} — ${item.inspectorName} — ${statusLabel(item.status)} — ${item.deficientItems} deficient`);
    window.location.href = `mailto:?subject=${encodeURIComponent(`Monthly Safety Inspections — ${monthFilter || "All dates"}`)}&body=${encodeURIComponent(["Stickney Fire Department", "Monthly Safety Inspections", "", ...lines].join("\n"))}`;
  }

  function emailDetail() {
    if (!data?.inspection || !draft) return;
    const resultById = new Map(draft.results.map((item) => [item.templateItemId, item]));
    const lines = recordItems.map((item) => {
      const result = resultById.get(item.id);
      const resultText = result?.status === "pass" ? "PASS" : result?.status === "deficient" ? "DEFICIENT" : result?.status === "not_applicable" ? "N/A" : "NOT CHECKED";
      return `${item.sectionName} — ${item.label} (${item.equipmentType}): ${resultText}${result?.deficiencyNote ? ` — ${result.deficiencyNote}` : ""}`;
    });
    const body = [template?.title || "Safety Inspection", displayDate(data.inspection.inspectionDate), `Inspector: ${data.inspection.inspectorName}`, `Status: ${statusLabel(data.inspection.status)}`, "", ...lines, "", `Notes: ${draft.notes || "None"}`].join("\n");
    window.location.href = `mailto:?subject=${encodeURIComponent(`${template?.title || "Safety Inspection"} — ${data.inspection.inspectionDate}`)}&body=${encodeURIComponent(body)}`;
  }

  if (loading && !data) return <div className="safety-loading" aria-busy="true">Loading monthly safety inspections…</div>;
  if (!data) return <section className="safety-inspections-page"><div className="safety-message error">{error || "Monthly safety inspections are unavailable."}</div></section>;

  if (editingChecklist && data.viewer.canManage) return <section className="safety-inspections-page safety-template-editor">
    <header className="safety-page-head"><div><p className="eyebrow">Field · Monthly safety inspections</p><h1>Edit extinguisher checklist</h1><p>Update the current location and equipment labels. Submitted inspections retain their saved results.</p></div><button className="quiet-button" onClick={() => setEditingChecklist(false)}>Back to inspections</button></header>
    {message && <div className="safety-message success" role="status">{message}</div>}{error && <div className="safety-message error" role="alert">{error}</div>}
    <div className="safety-template-list">{itemDrafts.filter((item) => item.templateId === template?.id).sort((a,b) => a.sortOrder-b.sortOrder).map((item) => <article key={item.id}>
      <label><span>Section</span><input value={item.sectionName} onChange={(event) => setItemDrafts((current) => current.map((entry) => entry.id === item.id ? { ...entry, sectionName: event.target.value } : entry))}/></label>
      <label><span>Location / unit</span><input value={item.label} onChange={(event) => setItemDrafts((current) => current.map((entry) => entry.id === item.id ? { ...entry, label: event.target.value } : entry))}/></label>
      <label><span>Extinguisher type</span><input value={item.equipmentType} onChange={(event) => setItemDrafts((current) => current.map((entry) => entry.id === item.id ? { ...entry, equipmentType: event.target.value } : entry))}/></label>
      <label className="check"><input type="checkbox" checked={Boolean(item.required)} onChange={(event) => setItemDrafts((current) => current.map((entry) => entry.id === item.id ? { ...entry, required: event.target.checked ? 1 : 0 } : entry))}/><span>Required every month</span></label>
      <label className="check"><input type="checkbox" checked={Boolean(item.active)} onChange={(event) => setItemDrafts((current) => current.map((entry) => entry.id === item.id ? { ...entry, active: event.target.checked ? 1 : 0 } : entry))}/><span>Active</span></label>
      <button className="primary-action compact" disabled={saving} onClick={() => void saveChecklistItem(item)}>Save location</button>
    </article>)}</div>
  </section>;

  if (data.inspection && draft) {
    const resultById = new Map(draft.results.map((item) => [item.templateItemId, item]));
    const passed = draft.results.filter((item) => item.status === "pass").length;
    const deficient = draft.results.filter((item) => item.status === "deficient").length;
    const remaining = draft.results.filter((item) => item.status === "not_checked").length;
    return <section className="safety-inspections-page safety-record-page">
      <header className="safety-page-head"><div><p className="eyebrow">Field · Monthly safety inspections</p><h1>{template?.title}</h1><p>{template?.description}</p></div><div className="safety-head-actions no-print"><button className="quiet-button" onClick={() => void load()}>All inspections</button><button className="quiet-button" onClick={() => window.print()}>Print / Save PDF</button><button className="quiet-button" onClick={emailDetail}>Email</button></div></header>
      {message && <div className="safety-message success" role="status">{message}</div>}{error && <div className="safety-message error" role="alert">{error}</div>}
      <div className="safety-record-identity"><label><span>Inspection date</span><input type="date" value={draft.date} readOnly={!currentEditable} onChange={(event) => setDraft({ ...draft, date: event.target.value })}/></label><div><span>Inspector</span><strong>{data.inspection.inspectorName}</strong></div><div><span>Record status</span><strong className={`safety-status ${data.inspection.status}`}>{statusLabel(data.inspection.status)}</strong></div><div><span>Last update</span><strong>{data.inspection.updatedAt || "Not recorded"}</strong></div></div>
      <div className="safety-progress" aria-label="Inspection progress"><span><b>{passed}</b> passed</span><span className={deficient ? "danger" : ""}><b>{deficient}</b> deficient</span><span><b>{remaining}</b> remaining</span></div>
      {recordSections.map((section) => <section className="safety-section" key={section}><header><h2>{section}</h2><span>{recordItems.filter((item) => item.sectionName === section).length} locations</span></header><div className="safety-checklist">
        {recordItems.filter((item) => item.sectionName === section).map((item) => { const result = resultById.get(item.id); if (!result) return null; return <article className={`safety-check-row ${result.status}`} key={item.id}>
          <div className="safety-item-name"><strong>{item.label}</strong><span>{item.equipmentType}{item.required ? " · Required" : ""}</span></div>
          <div className="safety-result-buttons" role="group" aria-label={`Result for ${item.label}`}>{([['pass','Pass'],['deficient','Deficient'],['not_applicable','N/A']] as const).map(([value,label]) => <button type="button" key={value} disabled={!currentEditable} className={result.status === value ? "selected" : ""} onClick={() => updateResult(item.id,{status:value})}>{label}</button>)}</div>
          {result.status === "deficient" && <div className="safety-deficiency"><label><span>What is deficient and what action is needed? *</span><textarea readOnly={!currentEditable} value={result.deficiencyNote} onChange={(event) => updateResult(item.id,{deficiencyNote:event.target.value})}/></label><label className="check"><input type="checkbox" disabled={!currentEditable} checked={Boolean(result.correctedOnSite)} onChange={(event) => updateResult(item.id,{correctedOnSite:event.target.checked ? 1 : 0})}/><span>Corrected during this inspection</span></label></div>}
        </article>})}
      </div></section>)}
      <section className="safety-notes"><label><span>Overall notes</span><textarea readOnly={!currentEditable} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Condition, service needed, replacement information, or follow-up owner…"/></label></section>
      <section className="safety-attachments"><header><div><h2>Supporting files</h2><p>Add deficiency photos, service tags, or a PDF receipt.</p></div>{currentEditable && <label className="safety-upload no-print"><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" onChange={(event) => { void upload(event.target.files?.[0] || null); event.currentTarget.value=""; }}/><span>Attach file</span></label>}</header>{data.attachments.length ? <ul>{data.attachments.map((attachment) => <li key={attachment.id}><a href={`/api/safety-inspections/attachments/${attachment.id}`} target="_blank" rel="noreferrer">{attachment.filename}</a><span>{bytesLabel(attachment.sizeBytes)} · {attachment.createdBy}</span>{currentEditable && <button className="no-print" onClick={() => void removeAttachment(attachment.id)}>Remove</button>}</li>)}</ul> : <p className="safety-empty-inline">No files attached.</p>}</section>
      <footer className="safety-record-actions no-print"><span>{data.inspection.status === "submitted" ? `Submitted ${data.inspection.submittedAt || ""} by ${data.inspection.submittedBy || data.inspection.inspectorName}` : "Save a draft at any time. Submission requires every required extinguisher to be checked."}</span><div>{data.inspection.status === "submitted" && data.viewer.canManage && <button className="quiet-button" disabled={saving} onClick={() => void reopen()}>Reopen for correction</button>}{currentEditable && <><button className="quiet-button" disabled={saving} onClick={() => void save(false)}>Save draft</button><button className="primary-action" disabled={saving} onClick={() => void save(true)}>Submit inspection</button></>}</div></footer>
    </section>;
  }

  return <section className="safety-inspections-page safety-report-page">
    <header className="safety-page-head"><div><p className="eyebrow">Field · Monthly safety inspections</p><h1>Monthly Safety Inspections</h1><p>Complete editable field checks, follow deficiencies, and produce general or detailed records.</p></div><div className="safety-head-actions no-print">{data.viewer.canManage && <button className="quiet-button" onClick={() => setEditingChecklist(true)}>Edit checklist</button>}<button className="primary-action" disabled={saving || readOnly || !data.viewer.canComplete} onClick={() => void startInspection()}>Start monthly check</button></div></header>
    {readOnly && <div className="safety-message">Test view is read only. Exit test view to start or edit an inspection.</div>}{message && <div className="safety-message success" role="status">{message}</div>}{error && <div className="safety-message error" role="alert">{error}</div>}
    <section className="safety-template-card"><div><span className="safety-template-icon">FE</span><div><p className="eyebrow">Available checklist</p><h2>{template?.title}</h2><p>{template?.description}</p></div></div><dl><div><dt>Frequency</dt><dd>Monthly</dd></div><div><dt>Locations</dt><dd>{templateItems.length}</dd></div><div><dt>Current inspector</dt><dd>{data.viewer.name}</dd></div></dl></section>
    <section className="safety-report-tools no-print"><label><span>Month</span><input type="month" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}/></label><label><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="reopened">Reopened</option><option value="submitted">Submitted</option></select></label><button className="quiet-button" onClick={() => window.print()}>Print general report</button><button className="quiet-button" onClick={emailSummary}>Email general report</button></section>
    <div className="safety-kpis"><article><span>Records shown</span><strong>{filtered.length}</strong></article><article><span>Submitted</span><strong>{monthSubmitted}</strong></article><article className={monthDeficiencies ? "danger" : ""}><span>Deficiencies</span><strong>{monthDeficiencies}</strong></article><article><span>Checklist locations</span><strong>{templateItems.length}</strong></article></div>
    <section className="safety-report-table"><header><div><h2>Inspection history</h2><p>Open any record for the detailed printable or emailable report.</p></div><span>{monthFilter || "All dates"}</span></header>{filtered.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Inspector</th><th>Status</th><th>Passed</th><th>Deficient</th><th>Updated</th><th className="no-print">Action</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td data-label="Date">{displayDate(item.inspectionDate)}</td><td data-label="Inspector"><strong>{item.inspectorName}</strong></td><td data-label="Status"><span className={`safety-status ${item.status}`}>{statusLabel(item.status)}</span></td><td data-label="Passed">{item.passedItems}/{item.totalItems}</td><td data-label="Deficient"><span className={item.deficientItems ? "safety-deficient-count" : ""}>{item.deficientItems}</span></td><td data-label="Updated">{item.updatedAt}</td><td data-label="Action" className="no-print"><button className="quiet-button compact" onClick={() => void load(item.id)}>Open detailed report</button></td></tr>)}</tbody></table></div> : <div className="safety-empty"><strong>No inspections match this report.</strong><span>Choose another month or start the first monthly check.</span></div>}</section>
  </section>;
}
