'use client';
import {useState} from 'react';
import {alternativeReviewSource,alternativeReviewLines,reviewOccupancies,reviewStatuses,updateAlternativeReview,reviewDueLabel,type AlternativeReview,type ReviewTask} from './alternative-review';
import {todayChicago,type InspectionFile} from './model';

const steps=['Scope','Evidence','Decision','Follow-up'];
export function AlternativeReviewSummary({value,onEdit}:{value:AlternativeReview;onEdit?:()=>void}){
 if(!value.enabled)return null;
 return <section className="fi-panel fi-alternative"><div className="fi-heading"><div><h3>Alternative Safety Review</h3><span className="fi-badge">{value.status}</span></div>{onEdit&&<button onClick={onEdit}>Edit alternative review</button>}</div><p>Authority decisions are recorded here. Inspection findings keep their own results.</p><details><summary>Scope, evidence & decision</summary>{alternativeReviewLines(value).slice(2,-1).map((line,i)=><p className="fi-prewrap" key={i}>{line}</p>)}</details><p><a href={alternativeReviewSource} target="_blank" rel="noreferrer">Open official NFPA 101A 2025 reference ↗</a></p></section>;
}

export default function AlternativeReviewEditor({value:r,onChange,files,onUpload}:{value:AlternativeReview;onChange:(v:AlternativeReview)=>void;files:InspectionFile[];onUpload:(file:File,caption:string)=>Promise<void>}){
 const [step,setStep]=useState(0),[fileType,setFileType]=useState('Worksheet'),[caption,setCaption]=useState(''),[fileNotice,setFileNotice]=useState('');
 const set=<K extends keyof AlternativeReview>(key:K,value:AlternativeReview[K])=>onChange(updateAlternativeReview(r,key,value));
 const field=(key:keyof AlternativeReview,label:string,multiline=false,type='text',hint='')=><label className="fi-field">{label}{multiline?<textarea value={String(r[key])} onChange={e=>set(key,e.target.value as never)}/>:<input type={type} value={String(r[key])} onChange={e=>set(key,e.target.value as never)}/>} {hint&&<small>{hint}</small>}</label>;
 const task=(id:string,patch:Partial<ReviewTask>)=>set('tasks',r.tasks.map(t=>t.id===id?{...t,...patch}:t));
 const go=(index:number)=>{setStep(index);document.getElementById('fi-alternative-title')?.scrollIntoView({block:'start'});};
 return <details className="fi-panel fi-alternative" open={r.enabled||undefined}>
  <summary id="fi-alternative-title">Advanced review · Alternative Safety Review {r.enabled&&<span className="fi-badge">{r.status}</span>}</summary>
  {!r.enabled?<><p>Use only when a property needs a documented alternative approach to life safety. Record the proposal, evidence, authority decision, and continuing checks.</p><button type="button" onClick={()=>set('enabled',true)}>Start alternative review</button></>:<>
   <p className="fi-muted">Optional review using NFPA 101A. Save a draft at any step with the inspection’s Save button.</p>
   <nav className="fi-review-steps" aria-label="Alternative review steps">{steps.map((s,i)=><button type="button" key={s} aria-current={i===step?'step':undefined} onClick={()=>go(i)}>{i+1}. {s}</button>)}</nav>
   {step===0&&<>
    <h3>1. What needs an alternative?</h3><p>The guide covers specific occupancies. Confirm the applicable method and editions with the approving authority.</p>
    <div className="fi-grid"><label className="fi-field">Review occupancy<select value={r.occupancy} onChange={e=>set('occupancy',e.target.value)}><option value="">Select occupancy…</option>{reviewOccupancies.map(v=><option key={v}>{v}</option>)}</select></label>{field('scope','Building areas / zones covered')}{field('guideEdition','NFPA 101A guide edition',false,'text','Four-digit year; no edition is adopted automatically.')}{field('codeEdition','NFPA 101 evaluation edition')}{field('authority','Approving authority / office')}{field('preparedBy','Review prepared by')}</div>
    <button type="button" onClick={()=>{const v=updateAlternativeReview(r,'guideEdition','2025');onChange(updateAlternativeReview(v,'codeEdition','2024'));}}>Use reviewed pair: 101A 2025 / 101 2024</button>
    <p><a href={alternativeReviewSource} target="_blank" rel="noreferrer">Official guide and worksheets ↗</a> · The 2025 guide is based on NFPA 101 2024. Verify local applicability separately.</p>
    {field('issue','Issue / requirement being addressed',true)}{field('proposal','Proposed alternative and how it addresses the issue',true)}
    <label className="fi-check"><input type="checkbox" checked={r.basisConfirmed} onChange={e=>set('basisConfirmed',e.target.checked)}/>I verified the edition pairing and the authority’s acceptance of this review method for this property.</label>
    <p className="fi-muted">Changing the property, proposal, or evidence summary returns a submitted review to Draft. Earlier saved versions remain in history.</p>
   </>}
   {step===1&&<>
    <h3>2. Attach the supporting evidence</h3><p>Use the applicable official worksheets. Add plans, zone evaluations, photos, or a qualified professional’s report. The app does not calculate an FSES score.</p>
    {field('evidenceNotes','Evidence summary and document references',true)}
    <div className="fi-grid"><label className="fi-field">Document type<select value={fileType} onChange={e=>setFileType(e.target.value)}>{['Worksheet','Plan','Photo','Professional report','Authority decision','Other'].map(v=><option key={v}>{v}</option>)}</select></label><label className="fi-field">Document description<input value={caption} onChange={e=>setCaption(e.target.value)} placeholder="Area covered, author, date, or reference"/></label></div>
    <label className="fi-field">Upload review evidence<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;setFileNotice('');if(f.size>4194304){setFileNotice('Choose a file up to 4 MB.');return;}try{await onUpload(f,`${fileType}${caption?` · ${caption}`:''}`);setFileNotice('Evidence saved privately. Review is Draft; record the authority decision after the evidence is complete.');setCaption('');}catch{setFileNotice('Upload was not confirmed. See the save message below; retry after resolving it.');}}}/><small>PDF, JPG, PNG, WebP · 4 MB maximum. Upload saves this inspection first and returns the review to Draft.</small></label>
    {fileNotice&&<p role="status" className="fi-note">{fileNotice}</p>}
    <h4>Files attached to this inspection</h4>{!files.length&&<p>No evidence files attached yet.</p>}{files.map(f=><p key={f.id}><a href={`/api/fire-inspections/files/${encodeURIComponent(f.id)}`} target="_blank" rel="noreferrer">{f.filename}</a><br/><small>{f.caption||'General inspection attachment'} · attached at version {f.recordVersion??'Not recorded'}</small></p>)}
   </>}
   {step===2&&<>
    <h3>3. Record the authority’s decision</h3><p>Saving does not submit a request or grant approval. Enter only a submission or decision that actually occurred.</p>
    <label className="fi-field">Review status<select value={r.status} onChange={e=>set('status',e.target.value as AlternativeReview['status'])}>{reviewStatuses.map(s=><option key={s}>{s}</option>)}</select></label>
    {r.status==='Draft'?<p className="fi-note">Still preparing? Save this draft and return when the proposal and evidence are ready.</p>:r.status==='Not pursued'?field('decisionNotes','Why this review is not being pursued',true):<>
     {field('submittedDate','Actual submission date',false,'date')}
     {['Approved','Revisions needed'].includes(r.status)&&<><div className="fi-grid">{field('decisionDate','Authority decision date',false,'date')}{field('decisionBy','Decision received from')}{field('decisionReference','Decision document / reference')}</div>{field('decisionNotes','Authority decision notes',true)}{field('conditions','Conditions of approval / required revisions',true)}<label className="fi-check"><input type="checkbox" checked={r.decisionConfirmed} onChange={e=>set('decisionConfirmed',e.target.checked)}/>I am recording an actual decision received from the approving authority.</label></>}
    </>}
    <p className="fi-muted">Approval here does not change any checkpoint result, correct a deficiency, or complete the inspection.</p>
   </>}
   {step===3&&<>
    <h3>4. Keep the arrangement maintained</h3><p>Record the checks and intervals required by the approved arrangement. Open checks appear in the inspection work queue. This is in-app tracking; email and push reminders are not sent.</p>
    {field('nextReviewDate','Next overall review date',false,'date')}
    {r.tasks.map((t,i)=><section className="fi-panel" key={t.id}><div className="fi-heading"><h4>Follow-up check {i+1}</h4><span className="fi-badge">{t.status==='Open'?reviewDueLabel(t.dueDate,todayChicago()):t.status}</span></div><div className="fi-grid"><label className="fi-field">Check name<input value={t.title} onChange={e=>task(t.id,{title:e.target.value})}/></label><label className="fi-field">Responsible person / company<input value={t.responsible} onChange={e=>task(t.id,{responsible:e.target.value})}/></label><label className="fi-field">Check due date<input type="date" value={t.dueDate} onChange={e=>task(t.id,{dueDate:e.target.value})}/></label><label className="fi-field">Check status<select value={t.status} onChange={e=>task(t.id,{status:e.target.value as ReviewTask['status'],completedDate:e.target.value==='Done'?t.completedDate:''})}>{['Open','Done','Not needed'].map(s=><option key={s}>{s}</option>)}</select></label>{t.status==='Done'&&<label className="fi-field">Actual completion date<input type="date" value={t.completedDate} onChange={e=>task(t.id,{completedDate:e.target.value})}/></label>}</div><label className="fi-field">Check notes / evidence<textarea value={t.notes} onChange={e=>task(t.id,{notes:e.target.value})}/></label><button type="button" onClick={()=>{if(window.confirm('Remove this follow-up check? Any previously saved version stays in history.'))set('tasks',r.tasks.filter(x=>x.id!==t.id));}}>Remove this check</button></section>)}
    <button type="button" disabled={r.tasks.length>=50} onClick={()=>set('tasks',[...r.tasks,{id:crypto.randomUUID(),title:'',responsible:'',dueDate:'',status:'Open',completedDate:'',notes:''}])}>+ Add follow-up check</button>
   </>}
   <div className="fi-actions fi-review-footer">{step>0&&<button type="button" onClick={()=>go(step-1)}>← {steps[step-1]}</button>}{step<3&&<button type="button" onClick={()=>go(step+1)}>Next: {steps[step+1]} →</button>}<small>Use Save draft / Save progress below to keep your changes.</small></div>
  </>}
 </details>;
}
