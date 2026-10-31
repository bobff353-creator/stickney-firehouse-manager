"use client";
import { useEffect, useId, useState } from 'react';
import { meterChoices, meterErrors, meterIssues, meterResponse, meterTemplate, type MeterResponse } from './inventory-meter-model';
import type { InventoryRow } from './inventory-index';
import { useUnsavedWork } from './use-unsaved-work';
import './inventory/meter-check.css';

type Save = (response: MeterResponse, version: number, complete: boolean, photo: File | null) => Promise<InventoryRow>;
export default function MeterCheckEditor({ item, apparatus, employees, busy, preview, canCheck, onDirty, onSave }: {
  item: InventoryRow; apparatus: string; employees: { id: string; name: string }[]; busy: boolean; preview: boolean; canCheck: boolean;
  onDirty: (id: string, dirty: boolean) => void; onSave: Save;
}) {
  const template = meterTemplate(item.meter_template)!;
  const [base,setBase] = useState(item);
  const [draft,setDraft] = useState(() => meterResponse(item.meter_response));
  const [photo,setPhoto] = useState<File | null>(null);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  const [receipt,setReceipt] = useState('');
  const id = String(item.id); const prefix = useId();
  const dirty = JSON.stringify(draft) !== JSON.stringify(meterResponse(base.meter_response)) || Boolean(photo);
  const conflict = Number(item.meter_response_version || 0) !== Number(base.meter_response_version || 0);
  useEffect(() => { onDirty(id, !preview && dirty); },[id,dirty,preview,onDirty]);
  if (item !== base && !dirty && !saving) { setBase(item); setDraft(meterResponse(item.meter_response)); }
  const update = <K extends keyof MeterResponse>(key: K, next: MeterResponse[K]) => { setDraft(current => ({...current,[key]:next})); setReceipt(''); };
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const issues = meterIssues(draft);
  const disabled = preview || !canCheck || busy || saving;
  async function save(complete: boolean) {
    if (disabled) return;
    const errors = complete ? meterErrors(draft,today) : [];
    if (complete && issues.length && !photo && !base.meter_photo_id) errors.push('Attach a photo of the issue.');
    if (errors.length) { setError(errors.join(' ')); return; }
    setSaving(true); setError('');
    try {
      const saved = await onSave(draft,Number(base.meter_response_version || 0),complete,photo);
      setBase(saved); setDraft(meterResponse(saved.meter_response));
      setPhoto(null);
      setReceipt(complete ? 'Meter inspection saved. Review it with the rest of the weekly check before submitting.' : 'Draft saved. This item stays pending until you save the completed meter inspection.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Save was not confirmed. Refresh and review before retrying.'); }
    finally { setSaving(false); }
  }
  const select = (key: 'batteryCharge'|'endOfLife'|'sensitOperational'|'sensitLowBattery',label: string) => <label>{label}<select value={draft[key]} onChange={event => update(key,event.target.value)}><option value="">Choose a result</option>{meterChoices[key].map(([value,text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
  const multiple = (key: 'stationLights'|'actions',label: string) => <fieldset className="meter-options"><legend>{label}</legend>{meterChoices[key].map(([value,text]) => <label key={value}><input type="checkbox" checked={draft[key].includes(value)} onChange={event => update(key,event.target.checked ? [...draft[key],value] : draft[key].filter(v => v !== value))}/><span>{text}</span></label>)}</fieldset>;
  return <article className="meter-check" aria-label={`${template.title} for ${apparatus}`}>
    <header><div><span>WEEKLY · {apparatus}</span><h3>{template.title}</h3><p>{template.instructions}</p></div><strong className="meter-state">{preview ? 'Read-only preview' : String(base.result) === 'pending' ? 'Pending' : base.result === 'pass' ? 'Saved · passed' : 'Saved · needs attention'}</strong></header>
    <p className="meter-source">{template.source} · Answer every question using the actual observations. All results start unanswered.</p>
    {conflict && <p role="alert">Another crew member changed this entry. Your edits are still here. Compare the latest saved entry before saving again. <button type="button" disabled={saving} onClick={() => { if (!dirty || window.confirm('Replace your unsaved meter entries with the latest saved entry?')) {setBase(item);setDraft(meterResponse(item.meter_response));setPhoto(null);setError('');} }}>Load latest saved entry</button></p>}
    <fieldset disabled={disabled} className="meter-fields"><legend>Inspection details</legend><div className="meter-grid">
      <label>Vehicle<input value={apparatus} readOnly/></label><div className="meter-date-entry"><label>Inspection date<input type="date" max={today} value={draft.inspectionDate} onChange={e => update('inspectionDate',e.target.value)}/></label><button type="button" aria-label="Use today's inspection date" onClick={() => update('inspectionDate',today)}>Use today</button></div>
    </div></fieldset>
    <fieldset disabled={disabled} className="meter-fields"><legend>MSA Altair 5 gas meter</legend><div className="meter-grid">
      <label>Identification on the back<select value={draft.meterId} onChange={e => update('meterId',e.target.value)}><option value="">Choose M1 or M2</option><option>M1</option><option>M2</option></select></label>
      {select('batteryCharge','Battery charge')}
      {multiple('stationLights','Bump and calibration station — gas indicator LED rings')}
      {multiple('actions','Meter bump or calibration — select what occurred')}
      {select('endOfLife','End-of-life blinking heart')}
    </div></fieldset>
    <fieldset disabled={disabled} className="meter-fields"><legend>Sensit</legend><div className="meter-grid">{select('sensitOperational','Power and operation')}{select('sensitLowBattery','Low battery indication')}</div></fieldset>
    <fieldset disabled={disabled} className="meter-fields"><legend>Member and comments</legend><div className="meter-grid">
      <label>Member performing check<input list={`${prefix}-members`} maxLength={160} value={draft.memberName} onChange={e => update('memberName',e.target.value)} placeholder="Choose or enter the member’s name"/><datalist id={`${prefix}-members`}>{employees.map(employee => <option key={employee.id} value={employee.name}/>)}</datalist></label>
      <label className="meter-wide">Comments (required for an issue)<textarea rows={3} maxLength={4000} value={draft.notes} onChange={e => update('notes',e.target.value)} placeholder="Record observed issues or comments"/></label>
      {!!issues.length && <div className="meter-attention meter-wide"><strong>Needs attention</strong><ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul><p>Describe the issue and attach a photo before saving the completed result. Follow the department’s existing process for missing supplies.</p><label>Issue photo<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" onChange={e => setPhoto(e.target.files?.[0] || null)}/></label>{photo && <small>{photo.name}</small>}</div>}
    </div></fieldset>
    {!preview && <footer><p role={error ? 'alert' : 'status'}>{error || receipt || (dirty ? 'Unsaved changes' : base.meter_response ? 'Saved entry loaded. You can edit it while this weekly check is in progress.' : 'Enter the actual observations, then save.')}</p><div><button type="button" disabled={disabled || conflict} onClick={() => void save(false)}>Save draft</button><button className="ops-primary" type="button" disabled={disabled || conflict} onClick={() => void save(true)}>{saving ? 'Saving…' : 'Save completed meter inspection'}</button></div><small>Saving this form does not submit the entire apparatus check.</small></footer>}
  </article>;
}

export function MeterTemplateEditor({ item, apparatus, onSave }: { item: InventoryRow; apparatus: string; onSave: (item: InventoryRow,title: string,instructions: string) => Promise<InventoryRow> }) {
  const [base,setBase] = useState(item);
  const template = meterTemplate(base.meter_template)!;
  const [title,setTitle] = useState(template.title); const [instructions,setInstructions] = useState(template.instructions);
  const [saving,setSaving] = useState(false); const [message,setMessage] = useState(''); const [error,setError] = useState(false);
  const dirty = title !== template.title || instructions !== template.instructions;
  const conflict = Number(item.meter_template_version || 0) !== Number(base.meter_template_version || 0);
  if (item !== base && !dirty && !saving) {setBase(item);const latest=meterTemplate(item.meter_template)!;setTitle(latest.title);setInstructions(latest.instructions);}
  useUnsavedWork(dirty,saving);
  return <form className="meter-check" onSubmit={event => {event.preventDefault(); if(saving || conflict)return;setSaving(true);setMessage('');void onSave(base,title,instructions).then(saved => {setBase(saved);setError(false);setMessage('Template saved for future weekly checks.');}).catch(error => {setError(true);setMessage(error instanceof Error ? error.message : 'Template save failed.');}).finally(() => setSaving(false));}}>
    <header><div><span>{apparatus} · WEEKLY METER TEMPLATE</span><h3>Meter inspection instructions</h3><p>Based on Aladtec form 458. Edit the heading and department instructions. The source questions and saved check snapshots are preserved.</p></div></header>
    <fieldset disabled={saving} className="meter-fields"><legend>Editable heading and instructions</legend><label>Check heading<input required maxLength={100} value={title} onChange={e => setTitle(e.target.value)}/></label><label>Instructions<textarea rows={3} maxLength={2000} value={instructions} onChange={e => setInstructions(e.target.value)}/></label></fieldset>
    {conflict && <p role="alert">The saved template changed. Your edits are still here. <button type="button" disabled={saving} onClick={() => {if(!dirty || window.confirm('Replace your unsaved instructions with the latest saved template?')){setBase(item);const latest=meterTemplate(item.meter_template)!;setTitle(latest.title);setInstructions(latest.instructions);}}}>Load latest saved template</button></p>}
    <footer><p role={error ? 'alert' : 'status'}>{message || (dirty ? 'Unsaved template changes' : template.source)}</p><button className="ops-primary" disabled={saving || !dirty || conflict}>Save meter template</button></footer>
  </form>;
}
