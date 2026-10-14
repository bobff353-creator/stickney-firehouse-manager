'use client';
import {useState} from 'react';
import type {TrainingData,TrainingSnapshot,SourceRosterRow} from './model';
import {sourceMatchLabel} from './source-review';
export default function SourceRoster({data,snapshot,onChange}:{data:TrainingData;snapshot:TrainingSnapshot;onChange:(patch:Partial<TrainingData>)=>void}){
  const [lines,setLines]=useState(''),[query,setQuery]=useState('');
  function update(id:string,patch:Partial<SourceRosterRow>){onChange({sourceRoster:data.sourceRoster.map(row=>row.id===id?{...row,...patch}:row),sourceReviewVerified:false});}
  const matched=data.sourceRoster.filter(row=>row.resolution==='matched'&&row.employeeId),unresolved=data.sourceRoster.filter(row=>row.resolution==='unresolved');
  return <section className="tr-panel tr-source-roster" aria-label="Paper roster reconciliation">
    <h3>Match the original roster for this session</h3><p>Preserve what is written. Choose a saved member only after verifying the person. Names and IDs are never matched automatically. A TargetSolutions ID and a Stickney member ID can use different numbering.</p>
    <label className="tr-field">Names from the source sheet, one row per line<textarea value={lines} onChange={e=>setLines(e.target.value)} placeholder="Transcribe each source row. Keep unclear or crossed-out rows."/></label>
    <button type="button" disabled={!lines.trim()||data.sourceRoster.length>=500} onClick={()=>{const rows=lines.split(/\r?\n/).map(name=>name.trim()).filter(Boolean).map(name=>({id:crypto.randomUUID(),name,writtenId:'',employeeId:'',resolution:'unresolved' as const,note:''}));onChange({sourceRoster:[...data.sourceRoster,...rows].slice(0,500),sourceReviewVerified:false});setLines('');}}>Add source rows without matching</button>
    <p role="status">{matched.length} confirmed matches · {unresolved.length} unresolved · {data.sourceRoster.filter(row=>row.resolution==='excluded').length} excluded rows. Unresolved rows prevent completion, but drafts remain available.</p>
    <label className="tr-field">Filter member choices<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, saved member ID or rank"/></label>
    <div className="tr-source-rows">{data.sourceRoster.map((row,index)=><article className="tr-source-row" key={row.id}>
      <h4>Source row {index+1} · {row.resolution}</h4>
      <label className="tr-field">Name or unreadable-row description<input value={row.name} onChange={e=>update(row.id,{name:e.target.value})}/></label>
      <label className="tr-field">ID written on sheet<input value={row.writtenId} onChange={e=>update(row.id,{writtenId:e.target.value})}/></label>
      <label className="tr-field">Row resolution<select aria-label={'Resolution for source row '+(index+1)} value={row.resolution} onChange={e=>update(row.id,{resolution:e.target.value as SourceRosterRow['resolution'],...(e.target.value!=='matched'?{employeeId:''}:{})})}><option value="unresolved">Unresolved — keep in draft</option><option value="matched">Confirmed member match</option><option value="excluded">Excluded from this session</option></select></label>
      {row.resolution==='matched'&&<label className="tr-field">Verified saved member<select aria-label={'Verified member for source row '+(index+1)} value={row.employeeId} onChange={e=>update(row.id,{employeeId:e.target.value})}><option value="">Choose after verifying the source</option>{snapshot.members.filter(member=>member.id===row.employeeId||`${member.name} ${member.id} ${member.rank}`.toLowerCase().includes(query.toLowerCase())).map(member=><option key={member.id} value={member.id}>{sourceMatchLabel(member)}</option>)}</select></label>}
      <label className="tr-field">Match evidence or exclusion reason<textarea value={row.note} onChange={e=>update(row.id,{note:e.target.value})} placeholder="Explain an ID mismatch, unreadable writing, crossed-out row, or attendance at another session."/></label>
      <button type="button" onClick={()=>onChange({sourceRoster:data.sourceRoster.filter(r=>r.id!==row.id),sourceReviewVerified:false})}>Remove transcribed row {index+1}</button>
    </article>)}</div>
    <button type="button" disabled={!matched.length} onClick={()=>{const ids=[...new Set(matched.map(row=>row.employeeId))];onChange({employeeIds:ids,attendance:Object.fromEntries(Object.entries(data.attendance).filter(([id])=>ids.includes(id))),paidHours:Object.fromEntries(Object.entries(data.paidHours).filter(([id])=>ids.includes(id))),sourceReviewVerified:false});}}>Use confirmed matches for this session</button>
    <p>Review individual hours below. Record other-session and crossed-out names as excluded with a reason. Confirm each paper report separately.</p>
  </section>;
}
