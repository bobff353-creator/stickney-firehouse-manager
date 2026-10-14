'use client';
import { useEffect, useRef, useState } from 'react';
import PropertyReviewControls from './property-review-controls';
import type { PropertyHistoryEntry } from './property-history-model';
type Packet={property?:{updatedAt:string};summary?:{inspectionRecords:number;findings:number;proposedObservations:number;publishedState:string;revision:number;dueDate:string};entries:PropertyHistoryEntry[];nextCursor:string|null};
export default function ConnectedPropertyHistory({propertyId}:{propertyId:string}){
  const [summary,setSummary]=useState<Packet['summary']>(),[updatedAt,setUpdatedAt]=useState('');
  const [open,setOpen]=useState(false),[entries,setEntries]=useState<PropertyHistoryEntry[]>([]),[cursor,setCursor]=useState<string|null>(null),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const active=useRef<AbortController|null>(null);
  const retryCursor=useRef<string|null>(null);
  useEffect(()=>()=>active.current?.abort(),[]);
  async function load(next:string|null=null){
    active.current?.abort();const controller=new AbortController();active.current=controller;retryCursor.current=next;setBusy(true);setError('');
    try{const params=new URLSearchParams({property:propertyId});if(next)params.set('cursor',next);
      const response=await fetch('/api/fire-inspections/property-history?'+params,{cache:'no-store',signal:controller.signal}),packet=await response.json() as Packet&{error?:string};
      if(!response.ok)throw Error(packet.error||'Connected history could not load.');
      if(!controller.signal.aborted){setEntries(prior=>next?[...new Map([...prior,...packet.entries].map(entry=>[entry.key,entry])).values()]:packet.entries);setCursor(packet.nextCursor);setSummary(packet.summary);setUpdatedAt(packet.property?.updatedAt||'');setLoaded(true);}
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Connected history could not load.');}finally{if(!controller.signal.aborted)setBusy(false);}
  }
  return <section className="connected-work" aria-label="Connected property history"><details open={open} onToggle={e=>{const expanded=e.currentTarget.open;setOpen(expanded);if(expanded&&!loaded&&!busy&&!error)void load();}}><summary>Connected property history</summary>
    <p>Saved inspection versions and preplan revisions linked to this property ID. Test inspections are excluded. Incident links are recorded deliberately below.</p>
    {summary&&<div className="cw-list"><article><h3>Recorded inspection findings</h3><p>{summary.findings} findings marked Needs attention across {summary.inspectionRecords} active non-test inspection records. These counts are saved observations, not verified current building facts.</p></article><article><h3>Proposed preplan observations</h3><p>{summary.proposedObservations} inspection records contain proposed updates. Review each before applying it.</p></article><article><h3>Published facts and review status</h3><p>Current lifecycle: {summary.publishedState} · Recorded revision {summary.revision} · Next review {summary.dueDate||'Date needed'}. Open the published revision to verify response facts.</p></article></div>}
    {loaded&&<PropertyReviewControls propertyId={propertyId} updatedAt={updatedAt} onSaved={()=>void load()}/>}
    <button type="button" disabled={busy} onClick={()=>void load()}>{busy?'Loading history…':'Refresh history'}</button>
    {error&&<p className="cw-notice" role="alert">{error} <button type="button" disabled={busy} onClick={()=>void load(retryCursor.current)}>Retry</button></p>}
    <div className="cw-list">{entries.map(entry=><article key={entry.key}><div className="cw-row-heading"><span>{entry.source} · version {entry.version}</span><span>{new Date(entry.at).toLocaleString('en-US',{timeZone:'America/Chicago'})}</span></div><h3>{entry.title}</h3><p>{entry.status}{Number(entry.archived)?' · Archived at this version':''} · Saved by {entry.actor||'Not recorded'}</p><a className="cw-link" href={entry.source==='Inspection'?'/?'+new URLSearchParams({display:'portal',page:'fire-inspections',inspectionRecord:entry.recordId}):'/?'+new URLSearchParams({display:'portal',page:'field-preplans',preplan:propertyId})}>Open current {entry.source==='Inspection'?'inspection':'preplan'} →</a></article>)}</div>
    {loaded&&!entries.length&&!error&&<p className="cw-empty">No linked inspection versions or preplan revisions have been recorded.</p>}
    {cursor&&<button type="button" disabled={busy} onClick={()=>void load(cursor)}>Load older history</button>}
  </details></section>;
}
