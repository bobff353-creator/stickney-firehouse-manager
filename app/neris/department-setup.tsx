'use client';
import {useEffect,useState} from 'react';
import {officialLinks,newReport,type NerisRecord,type Snapshot} from './model';
import {emptySetup,validateSetup,setupTasks,taskStatuses,reportingMethods,dispatchChoices,type ReportingSetup} from './setup-model';

export function DepartmentChoice({value,onChange}:{value:string;onChange:(value:string)=>void}) {
  const [custom,setCustom]=useState(Boolean(value&&value!=='FD17031679'));
  return <div className="nr-department-choice"><label>Reporting department<select value={custom?'other':value} onChange={e=>{const other=e.target.value==='other';setCustom(other);onChange(other?'':e.target.value);}}><option value="">Choose department…</option><option value="FD17031679">Stickney Fire Department · FD17031679</option><option value="other">Enter another verified department ID</option></select></label>{custom&&<label>Department NERIS ID<input value={value} placeholder="FD followed by 8 digits" maxLength={10} pattern="FD[0-9]{8}" onChange={e=>onChange(e.target.value.toUpperCase())}/></label>}<small>Stickney’s ID is listed in the Illinois compliance report. Confirm it against the department’s official profile.</small></div>;
}

export function DepartmentSetup({snapshot,onSaved,onDirty}:{snapshot:Snapshot;onSaved:(record:NerisRecord)=>void;onDirty:(dirty:boolean)=>void}) {
  const existing=snapshot.records.find(r=>r.kind==='settings'&&!r.archived&&r.data.setup);
  const [record,setRecord]=useState<NerisRecord>(()=>existing||{...newReport(),id:`neris-setup-${snapshot.departmentId}`,kind:'settings',data:{...newReport().data,payload:{},setup:emptySetup()}});
  const [baseline,setBaseline]=useState(()=>JSON.stringify(record.data.setup)),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const setup=record.data.setup!,dirty=JSON.stringify(setup)!==baseline;
  useEffect(()=>{onDirty(dirty);return()=>onDirty(false);},[dirty,onDirty]);
  useEffect(()=>{if(!dirty)return;const guard=(e:BeforeUnloadEvent)=>e.preventDefault();window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);},[dirty]);
  function change(patch:Partial<ReportingSetup>){setRecord(r=>({...r,data:{...r.data,setup:{...r.data.setup!,...patch}}}));setNotice('');}
  function downloadCopy(){const url=URL.createObjectURL(new Blob([JSON.stringify(setup,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='department-reporting-setup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function reloadSaved(){
    if(dirty&&!window.confirm('Replace these setup changes with the saved version? Download a copy first if you want to keep them.'))return;
    setBusy(true);try{const response=await fetch('/api/neris',{cache:'no-store'}),j=await response.json();if(!response.ok)throw Error(j.error||'Saved setup could not load.');const saved=(j.records as NerisRecord[]).find(r=>r.kind==='settings'&&!r.archived&&r.data.setup);if(!saved)throw Error('No saved setup was found. Your current choices remain here.');setRecord(saved);setBaseline(JSON.stringify(saved.data.setup));onSaved(saved);setError('');setNotice('Loaded the current saved setup.');}catch(e){setError(e instanceof Error?e.message:'Saved setup could not load.');}finally{setBusy(false);}
  }
  async function save(){setBusy(true);setError('');try{validateSetup(setup);const response=await fetch('/api/neris',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...record,data:{...record.data,local:{...record.data.local,title:'Department reporting setup'}}})}),j=await response.json();if(!response.ok||!j.saved||!j.record)throw Error(j.error||'Setup save was not confirmed.');setRecord(j.record);setBaseline(JSON.stringify(j.record.data.setup));onSaved(j.record);setNotice('Department setup saved. New drafts can use the confirmed department ID.');}catch(e){setError(e instanceof Error?e.message:'Setup was not saved. Your changes remain here.');}finally{setBusy(false);}}
  const complete=setupTasks.filter(t=>setup.tasks[t.id]==='Confirmed').length;
  return <form className="nr-setup" onSubmit={e=>{e.preventDefault();void save();}}>
    <div className="nr-section-title"><div><p className="nr-eyebrow">SET UP ONCE · REUSE IN NEW DRAFTS</p><h2>Department setup</h2><p>Keep your reporting choices and preparation checklist together.</p></div><span className="nr-badge">{complete} of {setupTasks.length} confirmed by you</span></div>
    {error&&<div className="nr-alert" role="alert"><p>{error}</p><div className="nr-actions"><button type="button" onClick={downloadCopy}>Download my setup copy</button><button type="button" disabled={busy} onClick={()=>void reloadSaved()}>Load saved setup</button></div></div>}{notice&&<p className="nr-success" role="status">{notice}</p>}
    <fieldset className="nr-editable" disabled={busy}>
      <section className="nr-panel"><div className="nr-section-title"><span className="nr-section-number">01</span><div><h3>Department & reporting choices</h3><p>These are local settings; they do not enroll or connect an integration.</p></div></div>
        <div className="nr-fields"><DepartmentChoice value={setup.departmentId} onChange={departmentId=>change({departmentId,departmentConfirmed:false})}/><div><label className="nr-check"><input type="checkbox" disabled={!setup.departmentId} checked={setup.departmentConfirmed} onChange={e=>change({departmentConfirmed:e.target.checked})}/>I verified this ID in the department’s NERIS profile. Use it in new drafts.</label><small>Existing incident reports stay as recorded.</small></div>
        <label>Current reporting system<select value={setup.reportingMethod} onChange={e=>change({reportingMethod:e.target.value as ReportingSetup['reportingMethod']})}><option value="">Choose reporting system…</option>{reportingMethods.filter(Boolean).map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Dispatch data sharing plan<select value={setup.dispatchPlan} onChange={e=>change({dispatchPlan:e.target.value as ReportingSetup['dispatchPlan']})}><option value="">Choose a plan…</option>{dispatchChoices.filter(Boolean).map(v=><option key={v}>{v}</option>)}</select></label>
        {setup.reportingMethod==='Other reporting system'&&<label>Reporting system name<input value={setup.otherSystem} maxLength={200} onChange={e=>change({otherSystem:e.target.value})}/></label>}
        {(['leadId','backupId'] as const).map(key=><label key={key}>{key==='leadId'?'NERIS lead':'Backup administrator'}<select value={setup[key]} onChange={e=>change({[key]:e.target.value})}><option value="">Choose a member…</option>{snapshot.members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}{setup[key]&&!snapshot.members.some(m=>m.id===setup[key])&&<option value={setup[key]}>Previously selected member (not in current roster)</option>}</select></label>)}</div>
        <p className="nr-inline-note">Selecting a member records your plan. It does not grant permissions in this app or NERIS.</p>
      </section>
      <section className="nr-panel"><div className="nr-section-title"><span className="nr-section-number">02</span><div><h3>Illinois reporting checklist</h3><p>Mark your actual progress. These statuses are your record, not verified acceptance.</p></div></div>
        {setupTasks.map(task=><div className="nr-setup-task" key={task.id}><div><strong>{task.title}</strong><small>{task.hint}</small></div><label><span className="nr-sr-only">{task.title} status</span><select value={setup.tasks[task.id]} onChange={e=>change({tasks:{...setup.tasks,[task.id]:e.target.value as typeof taskStatuses[number]}})}>{taskStatuses.map(status=><option key={status}>{status}</option>)}</select></label></div>)}
        <label>Setup notes<textarea rows={3} maxLength={5000} value={setup.notes} onChange={e=>change({notes:e.target.value})} placeholder="Record follow-up items, responsible people or dates…"/></label>
        <details className="nr-reference"><summary>Official Illinois instructions</summary><p>Use the official services to confirm profiles, authorize an integration and review accepted reporting counts. Saving this checklist does not perform those actions.</p><div className="nr-actions"><a href={officialLinks.illinois} target="_blank" rel="noreferrer">Illinois OSFM guidance ↗</a><a href={officialLinks.enrollment} target="_blank" rel="noreferrer">Integration enrollment ↗</a><a href={officialLinks.compliance} target="_blank" rel="noreferrer">Compliance report ↗</a></div></details>
      </section>
    </fieldset>
    <footer className="nr-savebar"><span role="status" className={error?'nr-save-error':undefined}>{error?`Not saved. ${error}`:dirty?'Setup changes not saved':record.version?`Setup saved · version ${record.version}`:'Setup not saved yet'}</span><button type="submit" className="nr-primary" disabled={busy||(!dirty&&!!record.version)}>{busy?'Saving setup…':'Save department setup'}</button></footer>
  </form>;
}
