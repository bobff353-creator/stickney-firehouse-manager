"use client";

/* Authenticated photos use the department session, not a public image proxy. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { airCheckLines, airTemplateLines, type AirRow } from "./inventory-air-checks";

import { ServiceScheduleFields, ServiceScheduleSummary } from "./inventory-service-fields";
import { serviceScheduleInput } from "./inventory-service-schedule";

type Data = { apparatus: AirRow[]; compartments: AirRow[]; equipment: AirRow[]; retiredEquipment: AirRow[]; inspectionSchedules: AirRow[]; scbaTemplates: AirRow[]; scbaEntries: AirRow[]; checks: AirRow[]; workOrders: AirRow[]; workOrderDocuments: AirRow[] };
type Save = (name: string, payload: Record<string, unknown>) => Promise<boolean>;
const val = (row: AirRow | undefined, key: string) => String(row?.[key] ?? "");
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dateFields = [["purchase_date", "Date purchased"], ["in_service_date", "Placed in service"], ["expiration_date", "Retirement / expiration due"], ["hydro_test_date", "Last hydro-test date"], ["hydro_due_date", "Next hydro-test due"]] as const;
function dateLabel(input: string) { return input ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${input.slice(0, 10)}T12:00:00Z`)) : "Not recorded"; }
function eligible(row: AirRow) { return val(row, "name") !== "1211" && !val(row, "name").toLowerCase().includes("utv") && row.asset_type !== "utv"; }

function AirScheduleEditor({ apparatusId, schedule, busy, onSave }: { apparatusId: string; schedule?: AirRow; busy: boolean; onSave: Save }) {
  return <form className="air-form" onSubmit={async event => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    await onSave("air-schedule", { action: "save_inspection_schedule", id: val(schedule, "id"), apparatusId, checkType: "air_pack", dayOfWeek: Number(form.get("day")), startTime: form.get("start"), endTime: form.get("end"), active: true, feedsDailyDuties: true, feedsOperationsBoard: true, requireOfficerSignoff: true });
  }}>
    <h3>{schedule ? "Edit weekly check time" : "Set a weekly check time"}</h3>
    <p>This location’s air checks appear in Due Now, Station Duties, and Live Operations on the selected day.</p>
    <div className="air-fields"><label>Due day<select name="day" defaultValue={val(schedule, "day_of_week")} required><option value="">Choose a day</option>{days.map((day, index) => <option value={index} key={day}>{day}</option>)}</select></label><label>Start time<input type="time" name="start" defaultValue={val(schedule, "start_time").slice(0, 5) || "06:00"} required /></label><label>Due by<input type="time" name="end" defaultValue={val(schedule, "end_time").slice(0, 5) || "12:00"} required /></label></div>
    <button type="submit" className="ops-primary" disabled={busy}>Save weekly schedule</button>
  </form>;
}

function AssetEditor({ asset, data, busy, onSave, onCancel }: { asset: AirRow; data: Data; busy: boolean; onSave: Save; onCancel: (savedId?: string) => void }) {
  const [scheduleError, setScheduleError] = useState("");
  const [location, setLocation] = useState(val(asset, "compartment_id"));
  const [kind, setKind] = useState(val(asset, "scba_asset_kind") || "pack");
  const [slot, setSlot] = useState(val(asset, "scba_check_slot"));
  const rigId = val(data.compartments.find(item => item.id === location), "apparatus_id");
  const template = data.scbaTemplates.find(item => item.apparatus_id === rigId);
  const slots = airTemplateLines(template).filter(line => kind === "pack" ? line.section === "pack" : line.section !== "pack");
  const locations = data.compartments.filter(item => data.apparatus.some(rig => rig.id === item.apparatus_id && eligible(rig)));
  const scheduled = data.inspectionSchedules.filter(item => item.apparatus_id === rigId && item.check_type === "air_pack" && item.active !== false);
  return <form className="air-form" aria-label="Air asset editor" onSubmit={async event => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const record = Object.fromEntries(form.entries());
    try { serviceScheduleInput(record); setScheduleError(""); } catch (caught) { setScheduleError(caught instanceof Error ? caught.message : "Review the service schedule."); return; }
    record.scba_asset_kind = kind; record.compartment_id = location; record.scba_check_slot = slot;
    if (await onSave("air-asset", { action: "save_air_asset", id: asset.id, expectedUpdatedAt: asset.updated_at || null, asset: record })) onCancel(val(asset, "id"));
  }}>
    <header className="air-heading"><div><p className="eyebrow">{asset.updated_at ? "EDIT EQUIPMENT RECORD" : "REGISTER ONE PHYSICAL ITEM"}</p><h2>{asset.updated_at ? `Edit ${val(asset, "asset_number")}` : "Add a pack or bottle"}</h2><p>One ID per physical item. Saving does not start a check or change past reports.</p></div><button type="button" disabled={busy} onClick={() => onCancel()}>Cancel</button></header>
    <fieldset><legend>1. Identity & location</legend><div className="air-fields">
      <label>Equipment type<select name="scba_asset_kind" value={kind} disabled={Boolean(asset.updated_at)} onChange={event => { setKind(event.target.value); setSlot(""); }}><option value="pack">Air pack</option><option value="bottle">Air bottle</option></select></label>
      <label>Your unique ID <span>(required)</span><input name="asset_number" defaultValue={val(asset, "asset_number")} maxLength={80} required placeholder="Enter the number on this item" autoFocus /></label>
      <label>Name / description <span>(required)</span><input name="name" defaultValue={val(asset, "name")} maxLength={240} required placeholder="Identify this pack or bottle" /></label>
      <label>Assigned apparatus & location <span>(required)</span><select name="compartment_id" value={location} required onChange={event => { setLocation(event.target.value); setSlot(""); }}><option value="">Choose its location</option>{locations.map(item => <option key={val(item, "id")} value={val(item, "id")}>{val(data.apparatus.find(rig => rig.id === item.apparatus_id), "name")} · {val(item, "label")}</option>)}</select></label>
      <label>Weekly checklist position<select value={slot} onChange={event => setSlot(event.target.value)}><option value="">Additional {kind === "pack" ? "pack" : "bottle"}</option>{slot && !slots.some(line => line.slot === slot) ? <option value={slot}>Previous position — choose a current one</option> : null}{slots.map(line => <option key={line.slot} value={line.slot}>{line.label}</option>)}</select><small>Link a position to identify its existing checklist line. “Additional” adds a separate line.</small></label>
    </div>{rigId ? <p className={scheduled.length ? "air-note" : "air-warning"}>{scheduled.length ? `Follows this location’s weekly schedule: ${scheduled.map(item => `${days[Number(item.day_of_week)]} ${val(item, "start_time").slice(0, 5)}–${val(item, "end_time").slice(0, 5)}`).join("; ")}.` : "No weekly air-check schedule is saved for this location. Set one under Weekly checks after saving."} Existing in-progress checks keep their original item list; location changes apply to the next check.</p> : null}</fieldset>
    <details><summary>2. Manufacturer, SKU, serial number & notes</summary><div className="air-fields">{[["manufacturer", "Manufacturer"], ["model", "Model"], ["sku", "SKU / part number"], ["serial_number", "Serial number"], ["barcode", "Barcode"]].map(([name, label]) => <label key={name}>{label}<input name={name} maxLength={["sku", "serial_number", "barcode"].includes(name) ? 80 : 240} defaultValue={val(asset, name)} /></label>)}<label className="air-wide">Equipment notes<textarea name="scba_notes" rows={3} maxLength={2000} defaultValue={val(asset, "scba_notes")} /></label></div></details>
    <details><summary>3. Purchase, service & hydro dates</summary><p>Enter dates from this item’s records. Hydro testing applies to the cylinder, not the harness. No test interval or safe-to-use status is inferred.</p><div className="air-fields">{dateFields.map(([name, label]) => <label key={name}>{label}<input type="date" name={name} defaultValue={val(asset, name)} /></label>)}</div></details>
    <ServiceScheduleFields item={asset} />
    {scheduleError ? <p role="alert">{scheduleError}</p> : null}
    <footer className="air-actions"><button type="button" onClick={() => onCancel()} disabled={busy}>Cancel</button><button type="submit" className="ops-primary" disabled={busy}>{busy ? "Saving…" : "Save & view record"}</button></footer>
  </form>;
}

export default function InventoryAirSystems({ data, busy, canSetup, canManageRepairs, canCheck, onSave, onOpenCheck, renderTemplate, uploadDocument, uploadPhoto, onRepairs }: {
  data: Data; busy: boolean; canSetup: boolean; canManageRepairs: boolean; canCheck: boolean; onSave: Save; onOpenCheck: (id: string) => void;
  renderTemplate: (apparatus: AirRow) => ReactNode;
  uploadDocument: (workOrderId: string, file: File, type: string, note: string) => Promise<void>;
  uploadPhoto: (asset: AirRow, file: File) => Promise<void>;
  onRepairs: () => void;
}) {
  const [tab, setTab] = useState("pack");
  const [search, setSearch] = useState("");
  const [rigFilter, setRigFilter] = useState("");
  const [showRetired, setShowRetired] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState<AirRow | null>(null);
  const [maintenanceId, setMaintenanceId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState("");
  const top = useRef<HTMLDivElement>(null);
  const all = [...data.equipment, ...data.retiredEquipment].filter(item => item.scba_asset_kind);
  const selected = all.find(item => item.id === selectedId);
  useEffect(() => { top.current?.scrollIntoView({ block: "start", behavior: "instant" }); top.current?.focus({ preventScroll: true }); }, [selectedId, editing, tab]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const due = (item: AirRow) => ["hydro_due_date", "expiration_date"].filter(key => val(item, key) && val(item, key) <= today);
  const filtered = all.filter(item => item.scba_asset_kind === tab && Boolean(item.retired_at) === showRetired && (!rigFilter || item.apparatus_id === rigFilter) && ["asset_number", "name", "sku", "serial_number", "barcode", "compartment_label"].some(key => val(item, key).toLowerCase().includes(search.toLowerCase().trim())));
  const assetRig = selected ? data.apparatus.find(item => item.id === selected.apparatus_id) : undefined;
  const history = selected ? data.workOrders.filter(item => item.equipment_id === selected.id).sort((a, b) => val(b, "repair_date").localeCompare(val(a, "repair_date"))) : [];
  const checkHistory = selected ? data.scbaEntries.filter(item => item.equipment_id === selected.id) : [];
  const doUpload = async (event: React.FormEvent<HTMLFormElement>, task: (form: FormData) => Promise<void>) => {
    event.preventDefault(); const formElement = event.currentTarget; setUploading(true); setLocalError("");
    try { await task(new FormData(formElement)); formElement.reset(); } catch (error) { setLocalError(error instanceof Error ? error.message : "Upload failed. Try again."); } finally { setUploading(false); }
  };
  return <div className="air-systems" ref={top} tabIndex={-1}>
    {localError ? <p role="alert" className="air-warning">{localError}</p> : null}
    {editing && canSetup ? <AssetEditor key={val(editing, "id")} asset={editing} data={data} busy={busy} onSave={onSave} onCancel={id => { setEditing(null); if (id) setSelectedId(id); }} /> : selected ? <>
      <header className="air-heading"><div><button type="button" onClick={() => { setSelectedId(""); setMaintenanceId(""); }}>← Back to {selected.scba_asset_kind === "pack" ? "air packs" : "air bottles"}</button><p className="eyebrow">{selected.scba_asset_kind === "pack" ? "AIR PACK" : "AIR BOTTLE"} RECORD</p><h2>ID {val(selected, "asset_number")}</h2><p>{val(selected, "name")}</p></div>{canSetup && !selected.retired_at ? <button type="button" className="ops-primary" onClick={() => setEditing({ ...selected })}>Edit record & location</button> : null}</header>
      <p className="air-note"><strong>{val(assetRig, "name")} · {val(selected, "compartment_label")}</strong><br />Status: {val(selected, "service_status").replaceAll("_", " ") || "Not recorded"}. {selected.retired_at ? "Retired — history retained." : "Use department procedures to determine readiness; dates alone do not confirm serviceability."}</p>
      {due(selected).length ? <p className="air-warning">Recorded date needs attention: {due(selected).map(key => key === "hydro_due_date" ? "hydro test" : "retirement / expiration").join(", ")}. Review the equipment record.</p> : null}
      <section className="air-record"><h3>Equipment details</h3><ServiceScheduleSummary item={selected} />{selected.photo_url ? <img className="air-photo" src={val(selected, "photo_url")} alt={`ID ${val(selected, "asset_number")}`} /> : null}<dl>{[["manufacturer", "Manufacturer"], ["model", "Model"], ["sku", "SKU / part number"], ["serial_number", "Serial number"], ["barcode", "Barcode"], ["scba_check_slot", "Checklist position"]].map(([key, title]) => <div key={key}><dt>{title}</dt><dd>{val(selected, key) || (key === "scba_check_slot" ? "Additional item" : "Not recorded")}</dd></div>)}{dateFields.map(([key, title]) => <div key={key}><dt>{title}</dt><dd>{dateLabel(val(selected, key))}</dd></div>)}</dl>{selected.scba_notes ? <p className="air-preserve">{val(selected, "scba_notes")}</p> : null}
        {canSetup && !selected.retired_at ? <details><summary>Add or replace equipment photo</summary><form className="air-form" onSubmit={event => void doUpload(event, async form => { const file = form.get("photo"); if (file instanceof File && file.size) await uploadPhoto(selected, file); })}><label>Equipment photo<input name="photo" type="file" accept="image/*" required /></label><button disabled={busy || uploading}>Upload photo</button></form></details> : null}
      </section>
      <section className="air-record"><header className="air-heading"><div><h3>Maintenance history</h3><p>Service, repair records, and attachments stay with this ID when it moves.</p></div>{canManageRepairs ? <button type="button" onClick={() => setMaintenanceId(crypto.randomUUID())}>Add completed maintenance</button> : null}</header>
        {maintenanceId && canManageRepairs ? <form className="air-form" onSubmit={async event => { event.preventDefault(); const f = new FormData(event.currentTarget); if (await onSave("air-maintenance", { action: "log_air_maintenance", id: maintenanceId, equipmentId: selected.id, ...Object.fromEntries(f.entries()) })) setMaintenanceId(""); }}>
          <div className="air-fields"><label>Service date<input name="repairDate" type="date" max={today} required /></label><label>Summary<input name="summary" required maxLength={240} /></label><label>Performed by<input name="performedBy" maxLength={240} /></label><label>Vendor<input name="vendor" maxLength={240} /></label><label>Invoice number<input name="invoiceNumber" maxLength={120} /></label><label>Cost <span>(optional)</span><input name="repairCost" type="number" min="0" step="0.01" /></label><label>Next service due <span>(optional)</span><input name="nextServiceDueDate" type="date" /></label><label className="air-wide">Work performed<textarea name="resolutionNotes" required maxLength={1000} rows={3} /></label></div><p>Records completed work only. This does not close open repairs, return equipment to service, or change hydro dates. Edit the asset record to update those dates.</p><div className="air-actions"><button type="button" onClick={() => setMaintenanceId("")} disabled={busy}>Cancel</button><button className="ops-primary" disabled={busy}>Save maintenance record</button></div>
        </form> : null}
        {!history.length ? <p>No maintenance has been linked to this ID yet.</p> : history.map(record => <details key={val(record, "id")}><summary>{dateLabel(val(record, "repair_date") || val(record, "opened_at").slice(0, 10))} · {val(record, "summary")} · {val(record, "status").replaceAll("_", " ")}</summary><p className="air-preserve">{val(record, "resolution_notes") || val(record, "details") || "No details recorded."}</p><dl><div><dt>Vendor / performed by</dt><dd>{[val(record, "vendor"), val(record, "performed_by")].filter(Boolean).join(" · ") || "Not recorded"}</dd></div><div><dt>Cost</dt><dd>{record.repair_cost == null ? "Not recorded" : `$${Number(record.repair_cost).toFixed(2)}`}</dd></div><div><dt>Invoice</dt><dd>{val(record, "invoice_number") || "Not recorded"}</dd></div><div><dt>Next service due</dt><dd>{dateLabel(val(record, "next_service_due_date"))}</dd></div></dl>
          {data.workOrderDocuments.filter(doc => doc.work_order_id === record.id).map(doc => <p key={val(doc, "id")}><a href={`/api/operations/documents/${val(doc, "id")}`} target="_blank" rel="noreferrer">{val(doc, "original_filename")}</a></p>)}
          {canManageRepairs ? <form className="air-form" onSubmit={event => void doUpload(event, async form => { const file = form.get("file"); if (file instanceof File && file.size) await uploadDocument(val(record, "id"), file, "other", String(form.get("note") || "")); })}><label>Attach service record / receipt<input type="file" name="file" required accept="application/pdf,image/jpeg,image/png,image/webp" /></label><label>Attachment note<input name="note" maxLength={500} /></label><button disabled={busy || uploading}>Upload attachment</button></form> : null}
        </details>)}
        {canManageRepairs ? <p><button type="button" onClick={onRepairs}>Open Repairs for a new or ongoing issue →</button></p> : null}
      </section>
      <details className="air-record"><summary>Inspection history · {checkHistory.length} linked entries</summary>{checkHistory.length ? checkHistory.map(entry => <p key={val(entry, "id")}><strong>{val(entry, "result").replaceAll("_", " ")}</strong> · {val(entry, "label")} · {val(entry, "location_snapshot")}<br />{entry.checked_at ? new Date(val(entry, "checked_at")).toLocaleString() : "Not yet checked"} · {val(entry, "notes") || "No note"}</p>) : <p>New inspections link here automatically. Older checklist reports remain in Reports and have not been guessed or reassigned to this ID.</p>}</details>
    </> : <>
      <header className="air-heading"><div><h2>Air Packs & Bottles</h2><p>Find an ID → view its record → check or maintain it.</p></div>{canSetup ? <button className="ops-primary" type="button" onClick={() => setEditing({ id: crypto.randomUUID(), scba_asset_kind: tab === "bottle" ? "bottle" : "pack" })}>Add pack or bottle</button> : null}</header>
      <nav className="air-tabs" aria-label="Air equipment views">{[["pack", "Air packs"], ["bottle", "Air bottles"], ["checks", "Weekly checks"]].map(([key, label]) => <button type="button" key={key} aria-pressed={tab === key} onClick={() => { setTab(key); setSearch(""); }}>{label}{key !== "checks" ? ` (${all.filter(item => item.scba_asset_kind === key && !item.retired_at).length})` : ""}</button>)}</nav>
      {tab === "checks" ? <div className="air-check-grid">{data.apparatus.filter(eligible).map(rig => {
        const id = val(rig, "id"), template = data.scbaTemplates.find(item => item.apparatus_id === id);
        const lines = airCheckLines(template, data.equipment, id);
        const schedules = data.inspectionSchedules.filter(item => item.apparatus_id === id && item.check_type === "air_pack" && item.active !== false);
        return <section className="air-record" key={id}><h3>{val(rig, "name")}</h3><p>{lines.filter(line => line.equipment_id).length} registered items · {lines.filter(line => !line.equipment_id).length} unlinked checklist positions</p>{schedules.length ? schedules.map(schedule => <p key={val(schedule, "id")}>{days[Number(schedule.day_of_week)]} · {val(schedule, "start_time").slice(0, 5)}–{val(schedule, "end_time").slice(0, 5)}{schedule.feeds_operations_board === false ? " · Operations Board feed is off" : " · Operations Board"}</p>) : <p className="air-warning">No weekly schedule. This location will not appear as due until an admin sets a day.</p>}
          {canCheck && lines.length ? <button className="ops-primary" type="button" onClick={() => onOpenCheck(id)}>Start / resume air check</button> : !lines.length ? <p>No air checklist is configured yet.</p> : <p>You have read-only access to checks.</p>}
          <details><summary>Preview next check · no results saved</summary>{lines.map((line, index) => <p key={`${line.slot}-${index}`}><strong>{line.label}</strong><br />{line.equipment_id ? line.location : "Existing position — no individual ID linked yet"}</p>)}</details>
          {canSetup ? <details><summary>Customize weekly checklist & schedule</summary>{renderTemplate(rig)}{(schedules.length ? schedules : [undefined]).map(schedule => <AirScheduleEditor key={val(schedule, "id") || "new"} apparatusId={id} schedule={schedule} busy={busy} onSave={onSave} />)}</details> : null}
        </section>;
      })}</div> : <>
        <div className="air-filters"><label>Find by ID, serial, SKU, name or location<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search air equipment" /></label><label>Apparatus<select value={rigFilter} onChange={event => setRigFilter(event.target.value)}><option value="">All locations</option>{data.apparatus.filter(eligible).map(rig => <option key={val(rig, "id")} value={val(rig, "id")}>{val(rig, "name")}</option>)}</select></label><label className="air-checkbox"><input type="checkbox" checked={showRetired} onChange={event => setShowRetired(event.target.checked)} />Show retired records</label></div>
        {filtered.length ? <div className="air-asset-grid">{filtered.map(item => <button type="button" className="air-asset-card" key={val(item, "id")} onClick={() => setSelectedId(val(item, "id"))}><strong>ID {val(item, "asset_number")}</strong><span>{val(item, "name")}</span><span>{val(data.apparatus.find(rig => rig.id === item.apparatus_id), "name")} · {val(item, "compartment_label")}</span><small>{val(item, "service_status").replaceAll("_", " ")}{due(item).length ? " · Recorded date needs attention" : ""}</small><span className="air-open-label">View record →</span></button>)}</div> : <div className="air-empty"><h3>{all.some(item => item.scba_asset_kind === tab) ? "No matching records" : `No individual ${tab === "pack" ? "air packs" : "air bottles"} registered yet`}</h3><p>{search || rigFilter || showRetired ? "Clear your search or filters to see more items." : "Existing SCBA checklist lines are preserved. Register each physical item by its own ID; do not enter a group quantity as one asset."}</p></div>}
      </>}
    </>}
  </div>;
}
