'use client';
import {useArrivalAccess} from '../access';
import {useEffect,useRef,useState} from 'react';
import {z} from 'zod';
import {request} from '../lib/client';
import {chicagoDate,formatDate} from '../lib/preplan';
import {activityKinds,activityLabels,hydrantActivitySchema,type HydrantRecord,type HydrantActivity} from '../lib/hydrant-activity';
import {Field} from './ui';
const draftSchema=z.object({id:z.string().uuid(),kind:z.enum(activityKinds),performedOn:z.string().max(10),notes:z.string().max(3000),status:z.enum(['','In service','Out of service','Unknown']),flowText:z.string().max(25)});
type Draft=z.infer<typeof draftSchema>;
type Result={hydrant:HydrantRecord;activities:HydrantActivity[];limited:boolean};
export default function HydrantActions({hydrant,ownerId,onUpdate}:{hydrant:HydrantRecord;ownerId:string;onUpdate:(h:HydrantRecord)=>void}){
 const access=useArrivalAccess();
 const key='arrival-hydrant-activity-'+ownerId+'-'+hydrant.recordId;
 const [draft,setDraft]=useState<Draft|null>(()=>{if(typeof window==='undefined'||!ownerId)return null;try{const parsed=draftSchema.safeParse(JSON.parse(localStorage.getItem(key)||'null'));return parsed.success?parsed.data:null;}catch{return null;}});
 const latestRevision=useRef(hydrant.revision),readSequence=useRef(0);
 const [revision,setRevision]=useState(hydrant.revision),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[history,setHistory]=useState<HydrantActivity[]>([]),[showHistory,setShowHistory]=useState(false),[loading,setLoading]=useState(false),[limited,setLimited]=useState(false),[deviceError,setDeviceError]=useState('');
 useEffect(()=>{if(!ownerId)return;try{if(draft)localStorage.setItem(key,JSON.stringify(draft));else localStorage.removeItem(key);}catch{setDeviceError('Device draft unavailable. Keep this screen open until your entry is saved.');}},[draft,key,ownerId]);
 useEffect(()=>{if(!busy)return;const protect=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect);},[busy]);
 function accept(r:Result){latestRevision.current=r.hydrant.revision;setHistory(r.activities);setLimited(r.limited);setRevision(r.hydrant.revision);onUpdate(r.hydrant);}
 async function load(){const sequence=++readSequence.current;setLoading(true);setError('');try{const r=await request<Result>('/api/arrival/hydrants/'+hydrant.recordId+'/activity');if(sequence===readSequence.current)accept(r);}catch(e){if(sequence===readSequence.current)setError((e as Error).message);}finally{if(sequence===readSequence.current)setLoading(false);}}
 function start(kind:Draft['kind']){if(!access.has('field_preplans.edit')){setError('Your account has read-only hydrant access.');return;}setMessage('');setError('');setDraft(d=>d?{...d,kind}:{id:crypto.randomUUID(),kind,performedOn:chicagoDate(),notes:'',status:'',flowText:''});void load();}
 async function save(e:React.FormEvent){e.preventDefault();if(!draft||busy)return;setError('');const parsed=hydrantActivitySchema.safeParse({id:draft.id,revision,kind:draft.kind,performedOn:draft.performedOn,notes:draft.notes,status:draft.status,flowGpm:draft.kind==='flow'&&draft.flowText.trim()?Number(draft.flowText):null});if(!parsed.success){setError(parsed.error.issues[0].message);return;}
  ++readSequence.current;setLoading(false);setBusy(true);try{const r=await request<Result>('/api/arrival/hydrants/'+hydrant.recordId+'/activity',{method:'POST',body:JSON.stringify(parsed.data)});try{localStorage.removeItem(key);}catch{}setDraft(null);accept(r);setShowHistory(true);setMessage(activityLabels[draft.kind]+' saved.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 const edit=(v:Partial<Draft>)=>setDraft(d=>d?{...d,...v}:d);
 return <section className="hydrant-actions" aria-label="Hydrant service">
  <div className="hydrant-action-buttons">{activityKinds.map(kind=><button key={kind} className={'btn small '+(draft?.kind===kind?'selected-service':'')} disabled={busy} onClick={()=>start(kind)}>{activityLabels[kind]}</button>)}</div>
  {draft&&<form onSubmit={save} className="hydrant-service-form"><h3>{activityLabels[draft.kind]}</h3><fieldset disabled={busy}>
   <Field label="Work date"><input type="date" required max={chicagoDate()} value={draft.performedOn} onChange={e=>edit({performedOn:e.target.value})}/></Field>
   {draft.kind==='flow'&&<Field label="Recorded flow (GPM)"><input type="number" inputMode="decimal" min="0.01" max="100000" step="any" required value={draft.flowText} placeholder="e.g. 1250" onChange={e=>edit({flowText:e.target.value})}/></Field>}
   <Field label={draft.kind==='maintenance'?'Work performed':'Notes (optional)'}><textarea rows={3} maxLength={3000} required={draft.kind==='maintenance'} value={draft.notes} placeholder={draft.kind==='maintenance'?'What was repaired or checked?':draft.kind==='flushing'?'Condition, drainage or follow-up':'Test details or follow-up'} onChange={e=>edit({notes:e.target.value})}/></Field>
   <Field label="Service status"><select value={draft.status} onChange={e=>edit({status:e.target.value as Draft['status']})}><option value="">Keep current ({hydrant.status})</option><option>In service</option><option>Out of service</option><option>Unknown</option></select></Field>
   <div className="action-group"><button className="btn primary small" type="submit" disabled={loading}>{busy?'Saving…':draft.kind==='flushing'?'Save flushing':'Save '+(draft.kind==='flow'?'flow update':'maintenance')}</button><button className="btn small" type="button" onClick={()=>{setDraft(null);setError('');}}>Cancel</button></div>
  </fieldset><small className="field-help">{deviceError||'Draft kept on this device until saved.'}</small></form>}
  {error&&<div className="form-error" role="alert">{error}<button className="text-button" disabled={busy||loading} onClick={()=>void load()}>Reload latest details</button></div>}
  {message&&<p className="service-saved" role="status">{message}</p>}
  <button className="text-button" disabled={busy} onClick={()=>{setShowHistory(!showHistory);if(!showHistory)void load();}}>{showHistory?'Hide service history':'Service history'}</button>
  {showHistory&&<div className="hydrant-history">{loading?<p role="status">Loading history…</p>:!history.length?<p>No service entries yet.</p>:history.map(a=><article key={a.id}><div><b>{activityLabels[a.kind]}</b><time dateTime={a.performedOn}>{formatDate(a.performedOn)}</time></div>{a.flowGpm!==null&&<strong>{a.flowGpm.toLocaleString()} GPM</strong>}{a.status&&<p>{a.status}</p>}{a.notes&&<p>{a.notes}</p>}</article>)}{limited&&<p className="field-help">Latest 100 service entries shown.</p>}</div>}
 </section>;
}
