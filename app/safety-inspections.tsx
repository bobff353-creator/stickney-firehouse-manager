"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { confirmLeavingWork, useUnsavedWork } from "./use-unsaved-work";
import { preserveEditorDrafts } from "./preserve-editor-drafts";

type Template = { id: string; slug: string; title: string; description: string; cadence: string; category: string; locationOptions: string; active: number };
type TemplateItem = { id: string; templateId: string; sectionName: string; label: string; equipmentType: string; required: number; active: number; sortOrder: number };
type InspectionSummary = { id: string; templateId: string; templateTitle: string; inspectionDate: string; inspectionLocation: string; inspectorName: string; status: string; overallNotes: string; updatedAt: string; submittedAt?: string | null; totalItems: number; passedItems: number; deficientItems: number; notApplicableItems: number };
type Inspection = { id: string; templateId: string; inspectionDate: string; inspectionLocation: string; inspectorName: string; status: string; overallNotes: string; createdBy: string; updatedBy: string; updatedAt: string; submittedBy?: string | null; submittedAt?: string | null };
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

function cadenceLabel(value: string) {
  return value === "weekly" ? "Weekly" : "Monthly";
}

function inspectionIcon(template: Template) {
  return template.category === "Fire extinguishers" ? "FE" : template.cadence === "weekly" ? "EW" : "SI";
}

function parseLocationOptions(value: string) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export default function SafetyInspections({ readOnly = false }: { readOnly?: boolean }) {
  const [data, setData] = useState<Payload | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<{ date: string; location: string; notes: string; results: InspectionResult[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState(chicagoDate().slice(0, 7));
  const [editingChecklist, setEditingChecklist] = useState(false);
  const [itemDrafts, setItemDrafts] = useState<TemplateItem[]>([]);
  const [templateDrafts, setTemplateDrafts] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [editorSearch, setEditorSearch] = useState("");
  const [editorSectionFilter, setEditorSectionFilter] = useState("all");

  const load = useCallback(async (inspectionId = "", options: { keepDraft?: boolean; keepEditor?: boolean; savedItemId?: string; savedTemplateId?: string } = {}) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/safety-inspections${inspectionId ? `?inspectionId=${encodeURIComponent(inspectionId)}` : ""}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
      const payload = await response.json() as Payload;
      if (!response.ok) throw new Error(payload.error || "Unable to load safety inspections.");
      setData(payload);
      setSelectedId(inspectionId);
      if (!options.keepDraft) setDraft(payload.inspection ? { date: payload.inspection.inspectionDate, location: payload.inspection.inspectionLocation || "", notes: payload.inspection.overallNotes, results: payload.results } : null);
      setItemDrafts(current => options.keepEditor ? preserveEditorDrafts(current, payload.templateItems, options.savedItemId) : payload.templateItems);
      const incomingTemplates = payload.templates.map((item) => ({ ...item, locationOptions: parseLocationOptions(item.locationOptions).join("\n") }));
      setTemplateDrafts(current => options.keepEditor ? preserveEditorDrafts(current, incomingTemplates, options.savedTemplateId) : incomingTemplates);
      setSelectedTemplateId((current) => payload.inspection?.templateId || current || payload.templates[0]?.id || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load safety inspections.");
    } finally {
      setLoading(false);
    }
  }, []);

  // The first render must synchronize with the protected inspection API.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const template = useMemo(() => data?.templates.find((item) => item.id === (data.inspection?.templateId || selectedTemplateId)) || data?.templates[0], [data, selectedTemplateId]);
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
  const filtered = useMemo(() => (data?.inspections || []).filter((item) => (statusFilter === "all" || item.status === statusFilter) && (templateFilter === "all" || item.templateId === templateFilter) && (!monthFilter || item.inspectionDate.startsWith(monthFilter))), [data?.inspections, monthFilter, statusFilter, templateFilter]);
  const monthSubmitted = filtered.filter((item) => item.status === "submitted").length;
  const monthDeficiencies = filtered.reduce((sum, item) => sum + Number(item.deficientItems || 0), 0);
  const canCompleteRecord = Boolean(data?.inspection && draft && data.viewer.canComplete && !readOnly && data.inspection.status !== "submitted");
  const currentEditable = canCompleteRecord && !saving;
  const recordDirty = Boolean(data?.inspection && draft && JSON.stringify(draft) !== JSON.stringify({ date: data.inspection.inspectionDate, location: data.inspection.inspectionLocation || "", notes: data.inspection.overallNotes, results: data.results }));
  const editorDirty = Boolean(data && (itemDrafts.some(item => JSON.stringify(item) !== JSON.stringify(data.templateItems.find(saved => saved.id === item.id))) || templateDrafts.some(item => {
    const saved = data.templates.find(entry => entry.id === item.id);
    return saved && JSON.stringify(item) !== JSON.stringify({ ...saved, locationOptions: parseLocationOptions(saved.locationOptions).join("\n") });
  })));
  useUnsavedWork(recordDirty || editorDirty, saving);
  const templateDraft = templateDrafts.find((item) => item.id === template?.id);
  const currentLocationOptions = parseLocationOptions(template?.locationOptions || "[]");
  const editorItems = useMemo(() => itemDrafts.filter((item) => item.templateId === template?.id).sort((a, b) => a.sortOrder - b.sortOrder), [itemDrafts, template?.id]);
  const editorSections = useMemo(() => [...new Set(editorItems.map((item) => item.sectionName).filter(Boolean))], [editorItems]);
  const visibleEditorItems = useMemo(() => {
    const query = editorSearch.trim().toLowerCase();
    return editorItems.filter((item) => (editorSectionFilter === "all" || item.sectionName === editorSectionFilter) && (!query || `${item.sectionName} ${item.label} ${item.equipmentType}`.toLowerCase().includes(query)));
  }, [editorItems, editorSearch, editorSectionFilter]);

  function chooseTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    setEditorSearch("");
    setEditorSectionFilter("all");
  }

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/safety-inspections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => ({})) as { error?: string; inspectionId?: string };
    if (!response.ok) throw new Error(payload.error || "The inspection could not be saved.");
    return payload;
  }

  async function startInspection(templateId = template?.id || "") {
    if (!templateId || readOnly) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const result = await post({ action: "create", templateId, inspectionDate: chicagoDate() });
      await load(result.inspectionId || "");
      setMessage("New inspection started. Every required checkpoint is ready to check.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to start the inspection."); }
    finally { setSaving(false); }
  }

  function updateResult(itemId: string, patch: Partial<InspectionResult>) {
    setDraft((current) => current ? { ...current, results: current.results.map((item) => item.templateItemId === itemId ? { ...item, ...patch } : item) } : current);
  }

  async function save(submit = false) {
    if (!data?.inspection || !draft) return;
    if (submit && !window.confirm("Submit this safety inspection? It will become read only until an officer reopens it.")) return;
    setSaving(true); setError(""); setMessage("");
    try {
      await post({ action: submit ? "submit" : "save", inspectionId: data.inspection.id, inspectionDate: draft.date, inspectionLocation: draft.location, overallNotes: draft.notes, results: draft.results });
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
      await load(data.inspection.id, { keepDraft: true, keepEditor: true }); setMessage("Supporting file attached. Any unsaved checkmarks and notes are still here; save the draft to keep them.");
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
      await load(data.inspection.id, { keepDraft: true, keepEditor: true }); setMessage("Supporting file removed. Your current checkmarks and notes were kept.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to remove the file."); }
    finally { setSaving(false); }
  }

  async function saveChecklistItem(item: TemplateItem) {
    setSaving(true); setError(""); setMessage("");
    try {
      await post({ action: "updateItem", item: { ...item, required: Boolean(item.required), active: Boolean(item.active) } });
      await load(selectedId, { keepEditor: true, savedItemId: item.id }); setEditingChecklist(true); setMessage(`Checkpoint “${item.label}” updated. Other unsaved edits were kept. Existing submitted records were not changed.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update the checklist."); }
    finally { setSaving(false); }
  }

  async function saveTemplate(templateDraft: Template) {
    setSaving(true); setError(""); setMessage("");
    try {
      await post({
        action: "updateTemplate",
        template: {
          ...templateDraft,
          locationOptions: templateDraft.locationOptions.split("\n").map((value) => value.trim()).filter(Boolean),
        },
      });
      await load(selectedId, { keepEditor: true, savedTemplateId: templateDraft.id }); setEditingChecklist(true); setMessage(`Form “${templateDraft.title}” updated. Other unsaved edits were kept. Existing submitted records were not changed.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update the form."); }
    finally { setSaving(false); }
  }

  async function addCheckpoint() {
    if (!template) return;
    setSaving(true); setError(""); setMessage("");
    try {
      await post({ action: "createItem", templateId: template.id });
      await load(selectedId, { keepEditor: true }); setEditingChecklist(true); setMessage("New checkpoint added. Edit its section and wording below. Other unsaved edits were kept.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to add a checkpoint."); }
    finally { setSaving(false); }
  }

  function emailSummary() {
    const lines = filtered.map((item) => `${displayDate(item.inspectionDate)} — ${item.templateTitle}${item.inspectionLocation ? ` — ${item.inspectionLocation}` : ""} — ${item.inspectorName} — ${statusLabel(item.status)} — ${item.deficientItems} deficient`);
    window.location.href = `mailto:?subject=${encodeURIComponent(`Safety Inspections — ${monthFilter || "All dates"}`)}&body=${encodeURIComponent(["Stickney Fire Department", "Safety Inspections", "", ...lines].join("\n"))}`;
  }

  function emailDetail() {
    if (!data?.inspection || !draft) return;
    const resultById = new Map(draft.results.map((item) => [item.templateItemId, item]));
    const lines = recordItems.map((item) => {
      const result = resultById.get(item.id);
      const resultText = result?.status === "pass" ? "PASS" : result?.status === "deficient" ? "DEFICIENT" : result?.status === "not_applicable" ? "N/A" : "NOT CHECKED";
      return `${item.sectionName} — ${item.label} (${item.equipmentType}): ${resultText}${result?.deficiencyNote ? ` — ${result.deficiencyNote}` : ""}`;
    });
    const body = [template?.title || "Safety Inspection", displayDate(draft.date), ...(draft.location ? [`Location: ${draft.location}`] : []), `Inspector: ${data.inspection.inspectorName}`, `Status: ${statusLabel(data.inspection.status)}`, "", ...lines, "", `Notes: ${draft.notes || "None"}`].join("\n");
    window.location.href = `mailto:?subject=${encodeURIComponent(`${template?.title || "Safety Inspection"} — ${data.inspection.inspectionDate}`)}&body=${encodeURIComponent(body)}`;
  }

  if (loading && !data) return <div className="safety-loading" aria-busy="true">Loading safety inspections…</div>;
  if (!data) return <section className="safety-inspections-page"><div className="safety-message error" role="alert">{error || "Safety inspections are unavailable."}<button className="quiet-button" disabled={loading} onClick={() => void load()}>{loading ? "Retrying…" : "Retry inspections"}</button></div></section>;

  if (editingChecklist && data.viewer.canManage) return <section className="safety-inspections-page safety-template-editor">
    <header className="safety-page-head"><div><p className="eyebrow">Field · Safety inspections</p><h1>Edit inspection forms</h1><p>Choose a form, then update its instructions, locations, and checkpoints. Submitted inspections retain their saved wording and results.</p></div><button className="quiet-button" disabled={saving} onClick={() => { if (confirmLeavingWork()) { setEditingChecklist(false); void load(); } }}>Back to inspections</button></header>
    {editorDirty && <div className="unsaved-work-notice" role="status">Unsaved form edits. Save each changed checkpoint or form setting before leaving. Saving one does not discard edits to another.</div>}
    {message && <div className="safety-message success" role="status">{message}</div>}{error && <div className="safety-message error" role="alert">{error}</div>}
    <section className="safety-editor-picker" aria-labelledby="safety-editor-picker-title">
      <div><p className="eyebrow">Form library</p><h2 id="safety-editor-picker-title">Choose the form to edit</h2><p>Changes affect new inspections only. Submitted records stay unchanged.</p></div>
      <label><span>Inspection form</span><select value={template?.id || ""} onChange={(event) => chooseTemplate(event.target.value)}>{data.templates.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}</select></label>
    </section>
    <nav className="safety-template-tabs" aria-label="Inspection forms">{data.templates.map((entry) => <button type="button" key={entry.id} aria-current={entry.id === template?.id ? "page" : undefined} className={entry.id === template?.id ? "selected" : ""} onClick={() => chooseTemplate(entry.id)}>{entry.title}</button>)}</nav>
    {templateDraft && <section className="safety-template-settings">
      <header><div><p className="eyebrow">Form settings</p><h2>{templateDraft.title}</h2></div><span>{editorItems.length} checkpoints</span></header>
      <label><span>Form name</span><input value={templateDraft.title} onChange={(event) => setTemplateDrafts((current) => current.map((entry) => entry.id === templateDraft.id ? { ...entry, title: event.target.value } : entry))}/></label>
      <label><span>Category</span><input value={templateDraft.category} onChange={(event) => setTemplateDrafts((current) => current.map((entry) => entry.id === templateDraft.id ? { ...entry, category: event.target.value } : entry))}/></label>
      <label><span>Frequency</span><select value={templateDraft.cadence} onChange={(event) => setTemplateDrafts((current) => current.map((entry) => entry.id === templateDraft.id ? { ...entry, cadence: event.target.value } : entry))}><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
      <label className="wide"><span>Instructions</span><textarea value={templateDraft.description} onChange={(event) => setTemplateDrafts((current) => current.map((entry) => entry.id === templateDraft.id ? { ...entry, description: event.target.value } : entry))}/></label>
      <label className="wide"><span>Facility choices (one per line; leave blank when the form does not need one)</span><textarea value={templateDraft.locationOptions} onChange={(event) => setTemplateDrafts((current) => current.map((entry) => entry.id === templateDraft.id ? { ...entry, locationOptions: event.target.value } : entry))}/></label>
      <div className="safety-template-setting-actions"><button className="quiet-button" disabled={saving} onClick={() => void addCheckpoint()}>Add checkpoint</button><button className="primary-action" disabled={saving} onClick={() => void saveTemplate(templateDraft)}>Save form settings</button></div>
    </section>}
    <section className="safety-editor-checkpoints" aria-labelledby="safety-editor-checkpoints-title">
      <header><div><p className="eyebrow">Checkpoint editor</p><h2 id="safety-editor-checkpoints-title">Find and update a checkpoint</h2></div><span>{visibleEditorItems.length} of {editorItems.length} shown</span></header>
      <div className="safety-editor-tools">
        <label><span>Search checkpoints</span><input type="search" value={editorSearch} onChange={(event) => setEditorSearch(event.target.value)} placeholder="Search wording, equipment, or room…"/></label>
        <label><span>Section</span><select value={editorSectionFilter} onChange={(event) => setEditorSectionFilter(event.target.value)}><option value="all">All sections</option>{editorSections.map((section) => <option key={section} value={section}>{section}</option>)}</select></label>
      </div>
      <div className="safety-template-list">{visibleEditorItems.map((item) => <article key={item.id}>
        <header><span>Checkpoint {editorItems.indexOf(item) + 1}</span><strong>{item.label || "Untitled checkpoint"}</strong></header>
        <div className="safety-template-fields">
          <label><span>Section</span><input value={item.sectionName} onChange={(event) => setItemDrafts((current) => current.map((entry) => entry.id === item.id ? { ...entry, sectionName: event.target.value } : entry))}/></label>
          <label><span>Checkpoint wording</span><input value={item.label} onChange={(event) => setItemDrafts((current) => current.map((entry) => entry.id === item.id ? { ...entry, label: event.target.value } : entry))}/></label>
          <label><span>Equipment / location detail</span><input value={item.equipmentType} onChange={(event) => setItemDrafts((current) => current.map((entry) => entry.id === item.id ? { ...entry, equipmentType: event.target.value } : entry))}/></label>
        </div>
        <footer><div><label className="check"><input type="checkbox" checked={Boolean(item.required)} onChange={(event) => setItemDrafts((current) => current.map((entry) => entry.id === item.id ? { ...entry, required: event.target.checked ? 1 : 0 } : entry))}/><span>Required each {template?.cadence === "weekly" ? "week" : "month"}</span></label><label className="check"><input type="checkbox" checked={Boolean(item.active)} onChange={(event) => setItemDrafts((current) => current.map((entry) => entry.id === item.id ? { ...entry, active: event.target.checked ? 1 : 0 } : entry))}/><span>Active</span></label></div><button className="primary-action compact" disabled={saving} onClick={() => void saveChecklistItem(item)}>Save checkpoint</button></footer>
      </article>)}{visibleEditorItems.length === 0 && <div className="safety-empty"><strong>No checkpoints found.</strong><span>Clear the search or choose another section.</span></div>}</div>
    </section>
  </section>;

  if (data.inspection && draft) {
    const resultById = new Map(draft.results.map((item) => [item.templateItemId, item]));
    const passed = draft.results.filter((item) => item.status === "pass").length;
    const deficient = draft.results.filter((item) => item.status === "deficient").length;
    const remaining = draft.results.filter((item) => item.status === "not_checked").length;
    const completed = draft.results.length - remaining;
    const percentComplete = draft.results.length ? Math.round((completed / draft.results.length) * 100) : 0;
    return <section className="safety-inspections-page safety-record-page">
      <header className="safety-page-head"><div><button className="safety-back-link no-print" disabled={saving} onClick={() => { if (confirmLeavingWork()) void load(); }}>← All inspections</button><p className="eyebrow">Field · Safety inspections</p><h1>{template?.title}</h1><p>{template?.description}</p></div><div className="safety-head-actions no-print"><button className="quiet-button" disabled={recordDirty || saving} onClick={() => window.print()}>Print / Save PDF</button><button className="quiet-button" disabled={recordDirty || saving} onClick={emailDetail}>Email detailed report</button></div></header>
      {recordDirty && <div className="unsaved-work-notice no-print" role="status"><strong>Unsaved changes</strong><span>Your checkmarks and notes are only on this device until you save. Save the draft before printing or emailing.</span><button className="quiet-button" disabled={saving} onClick={() => void save(false)}>{saving ? "Saving…" : "Save draft now"}</button></div>}
      {message && <div className="safety-message success" role="status">{message}</div>}{error && <div className="safety-message error" role="alert">{error}</div>}
      <div className="safety-record-identity"><label><span>Inspection date</span><input type="date" value={draft.date} readOnly={!currentEditable} onChange={(event) => setDraft({ ...draft, date: event.target.value })}/></label>{currentLocationOptions.length > 0 && <label><span>Facility inspected</span><select value={draft.location} disabled={!currentEditable} onChange={(event) => setDraft({ ...draft, location: event.target.value })}><option value="">Choose facility</option>{currentLocationOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>}<div><span>Inspector</span><strong>{data.inspection.inspectorName}</strong></div><div><span>Record status</span><strong className={`safety-status ${data.inspection.status}`}>{statusLabel(data.inspection.status)}</strong></div><div><span>Last update</span><strong>{data.inspection.updatedAt || "Not recorded"}</strong></div></div>
      <section className="safety-progress-panel" aria-labelledby="safety-progress-title">
        <div className="safety-progress-heading"><div><span>Inspection progress</span><strong id="safety-progress-title">{completed} of {draft.results.length} complete</strong></div><b>{percentComplete}%</b></div>
        <div className="safety-progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentComplete} aria-label={`${percentComplete}% complete`}><span style={{ width: `${percentComplete}%` }}/></div>
        <div className="safety-progress" aria-label="Inspection totals"><span><b>{passed}</b> passed</span><span className={deficient ? "danger" : ""}><b>{deficient}</b> deficient</span><span><b>{remaining}</b> remaining</span></div>
      </section>
      {recordSections.length > 1 && <nav className="safety-section-jump no-print" aria-label="Jump to an inspection section"><strong>Jump to section</strong><div>{recordSections.map((section, sectionIndex) => { const sectionItems = recordItems.filter((item) => item.sectionName === section); const sectionComplete = sectionItems.filter((item) => resultById.get(item.id)?.status !== "not_checked").length; return <a key={section} href={`#safety-section-${sectionIndex}`}><span>{section}</span><b>{sectionComplete}/{sectionItems.length}</b></a>; })}</div></nav>}
      {recordSections.map((section, sectionIndex) => { const sectionItems = recordItems.filter((item) => item.sectionName === section); const sectionComplete = sectionItems.filter((item) => resultById.get(item.id)?.status !== "not_checked").length; return <section className="safety-section" id={`safety-section-${sectionIndex}`} key={section}><header><div><p>Section {sectionIndex + 1} of {recordSections.length}</p><h2>{section}</h2></div><span>{sectionComplete}/{sectionItems.length} complete</span></header><div className="safety-checklist">
        {sectionItems.map((item, itemIndex) => { const result = resultById.get(item.id); if (!result) return null; return <article className={`safety-check-row ${result.status}`} key={item.id}>
          <div className="safety-item-name"><span className="safety-check-number">{itemIndex + 1}</span><div><strong>{item.label}</strong><span>{item.equipmentType || "General condition"}</span></div>{item.required ? <b>Required</b> : <b className="optional">Optional</b>}</div>
          <div className="safety-result-buttons" role="group" aria-label={`Result for ${item.label}`}>{([['pass','Pass'],['deficient','Deficient'],['not_applicable','N/A']] as const).map(([value,label]) => <button type="button" key={value} disabled={!currentEditable} aria-pressed={result.status === value} className={result.status === value ? "selected" : ""} onClick={() => updateResult(item.id,{status:value})}>{label}</button>)}</div>
          {result.status === "deficient" && <div className="safety-deficiency"><label><span>What is deficient and what action is needed? *</span><textarea readOnly={!currentEditable} value={result.deficiencyNote} onChange={(event) => updateResult(item.id,{deficiencyNote:event.target.value})}/></label><label className="check"><input type="checkbox" disabled={!currentEditable} checked={Boolean(result.correctedOnSite)} onChange={(event) => updateResult(item.id,{correctedOnSite:event.target.checked ? 1 : 0})}/><span>Corrected during this inspection</span></label></div>}
        </article>})}
      </div></section>})}
      <section className="safety-notes"><label><span>Overall notes</span><textarea readOnly={!currentEditable} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Condition, service needed, replacement information, or follow-up owner…"/></label></section>
      <section className="safety-attachments"><header><div><h2>Supporting files</h2><p>Add deficiency photos, service tags, or a PDF receipt.</p></div>{currentEditable && <label className="safety-upload no-print"><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" onChange={(event) => { void upload(event.target.files?.[0] || null); event.currentTarget.value=""; }}/><span>Attach file</span></label>}</header>{data.attachments.length ? <ul>{data.attachments.map((attachment) => <li key={attachment.id}><a href={`/api/safety-inspections/attachments/${attachment.id}`} target="_blank" rel="noreferrer">{attachment.filename}</a><span>{bytesLabel(attachment.sizeBytes)} · {attachment.createdBy}</span>{currentEditable && <button className="no-print" onClick={() => void removeAttachment(attachment.id)}>Remove</button>}</li>)}</ul> : <p className="safety-empty-inline">No files attached.</p>}</section>
      <footer className="safety-record-actions no-print"><span>{data.inspection.status === "submitted" ? `Submitted ${data.inspection.submittedAt || ""} by ${data.inspection.submittedBy || data.inspection.inspectorName}` : remaining ? `${remaining} checkpoint${remaining === 1 ? "" : "s"} remaining. Save now and finish later on any device.` : "All checkpoints are complete. Review any deficiencies, then submit the inspection."}</span><div>{data.inspection.status === "submitted" && data.viewer.canManage && <button className="quiet-button" disabled={saving} onClick={() => void reopen()}>Reopen for correction</button>}{canCompleteRecord && <><button className="quiet-button" disabled={saving} onClick={() => void save(false)}>{saving ? "Saving…" : "Save draft"}</button><button className="primary-action" disabled={saving} onClick={() => void save(true)}>Submit inspection</button></>}</div></footer>
    </section>;
  }

  return <section className="safety-inspections-page safety-report-page">
    <header className="safety-page-head"><div><p className="eyebrow">Field · Safety inspections</p><h1>Safety Inspections</h1><p>Choose the inspection you need, complete its checkpoints, and print or email general and detailed reports.</p></div><div className="safety-head-actions no-print">{data.viewer.canManage && <button className="quiet-button" onClick={() => setEditingChecklist(true)}>Edit inspection forms</button>}</div></header>
    {readOnly && <div className="safety-message">Test view is read only. Exit test view to start or edit an inspection.</div>}{message && <div className="safety-message success" role="status">{message}</div>}{error && <div className="safety-message error" role="alert">{error}</div>}
    <section className="safety-workflow-guide no-print" aria-labelledby="safety-workflow-title"><div><p className="eyebrow">Simple field workflow</p><h2 id="safety-workflow-title">Start, check, and submit</h2></div><ol><li><b>1</b><span><strong>Choose a form</strong><small>Use the exact facility or safety inspection below.</small></span></li><li><b>2</b><span><strong>Complete checkpoints</strong><small>Mark Pass, Deficient, or N/A and add evidence.</small></span></li><li><b>3</b><span><strong>Submit and report</strong><small>Print, save as PDF, or prepare an email report.</small></span></li></ol></section>
    <header className="safety-library-head"><div><p className="eyebrow">Available inspection forms</p><h2>What are you inspecting?</h2></div><span>{data.templates.length} forms</span></header>
    <div className="safety-template-grid">{data.templates.map((entry) => {
      const itemCount = data.templateItems.filter((item) => item.templateId === entry.id && item.active).length;
      return <article className="safety-template-card" key={entry.id}>
        <header><span className="safety-template-icon" aria-hidden="true">{inspectionIcon(entry)}</span><div><div className="safety-template-badges"><span>{cadenceLabel(entry.cadence)}</span><span>{entry.category}</span></div><h2>{entry.title}</h2></div></header>
        <p>{entry.description}</p>
        <footer><dl><div><dt>Checkpoints</dt><dd>{itemCount}</dd></div><div><dt>Inspector</dt><dd>{data.viewer.name}</dd></div></dl><button className="primary-action no-print" disabled={saving || readOnly || !data.viewer.canComplete} onClick={() => void startInspection(entry.id)}>Start inspection</button></footer>
      </article>;
    })}</div>
    <section className="safety-report-controls no-print" aria-labelledby="safety-report-controls-title"><header><div><p className="eyebrow">Reports and records</p><h2 id="safety-report-controls-title">Find completed work</h2><p>Filter the history before printing or preparing an email.</p></div><div><button className="quiet-button" onClick={() => window.print()}>Print general report</button><button className="quiet-button" onClick={emailSummary}>Email general report</button></div></header><div className="safety-report-tools"><label><span>Month</span><input type="month" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}/></label><label><span>Inspection form</span><select value={templateFilter} onChange={(event) => setTemplateFilter(event.target.value)}><option value="all">All inspection forms</option>{data.templates.map((entry) => <option value={entry.id} key={entry.id}>{entry.title}</option>)}</select></label><label><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="reopened">Reopened</option><option value="submitted">Submitted</option></select></label></div></section>
    <div className="safety-kpis"><article><span>Records shown</span><strong>{filtered.length}</strong></article><article><span>Submitted</span><strong>{monthSubmitted}</strong></article><article className={monthDeficiencies ? "danger" : ""}><span>Deficiencies</span><strong>{monthDeficiencies}</strong></article><article><span>Available forms</span><strong>{data.templates.length}</strong></article></div>
    <section className="safety-report-table"><header><div><h2>Inspection history</h2><p>Open any record for the detailed printable or emailable report.</p></div><span>{monthFilter || "All dates"}</span></header>{filtered.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Inspection</th><th>Facility</th><th>Inspector</th><th>Status</th><th>Passed</th><th>Deficient</th><th className="no-print">Action</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td data-label="Date">{displayDate(item.inspectionDate)}</td><td data-label="Inspection"><strong>{item.templateTitle}</strong></td><td data-label="Facility">{item.inspectionLocation || "—"}</td><td data-label="Inspector">{item.inspectorName}</td><td data-label="Status"><span className={`safety-status ${item.status}`}>{statusLabel(item.status)}</span></td><td data-label="Passed">{item.passedItems}/{item.totalItems}</td><td data-label="Deficient"><span className={item.deficientItems ? "safety-deficient-count" : ""}>{item.deficientItems}</span></td><td data-label="Action" className="no-print"><button className="quiet-button compact" onClick={() => void load(item.id)}>Open detailed report</button></td></tr>)}</tbody></table></div> : <div className="safety-empty"><strong>No inspections match this report.</strong><span>Choose another report filter or start an inspection above.</span></div>}</section>
  </section>;
}
