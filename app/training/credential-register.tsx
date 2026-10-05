'use client';
import { useMemo,useState } from 'react';
import { credentialRegister } from './phase-four';
import { todayChicago, type TrainingSnapshot } from './model';
export function CredentialRegister({snapshot,onOpen}:{snapshot:TrainingSnapshot;onOpen:(id:string)=>void}) {
  const [days,setDays]=useState(90),[query,setQuery]=useState(''),[attention,setAttention]=useState(true);
  const rows=useMemo(()=>credentialRegister(snapshot,todayChicago(),days,query),[snapshot,days,query]);
  const visible=rows.filter(row=>!attention||row.state!=='Later');
  return <section className="tr-panel" aria-label="Credential renewal review"><h2>Credential renewal review</h2><p>Review recorded dates and supporting files. A date flag does not determine certification or duty eligibility. No notices are sent from this private pilot.</p>
    <div className="tr-grid"><label className="tr-field">Find a credential<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Member, credential or issuer"/></label><label className="tr-field">Reminder window<select value={days} onChange={e=>setDays(Number(e.target.value))}>{[7,30,60,90].map(day=><option key={day} value={day}>{day} days</option>)}</select></label></div>
    <label className="tr-checkbox"><input type="checkbox" checked={attention} onChange={e=>setAttention(e.target.checked)}/>Show dates needing attention only</label>
    <div className="tr-list">{visible.map(({record,member,state,evidenceCount})=><button className="tr-record" key={record.id} onClick={()=>onOpen(record.id)}><span><strong>{member} · {record.data.title}</strong><small>{record.data.issuingAuthority||'Issuer not recorded'} · {record.data.dueDate||'Renewal date not recorded'} · {evidenceCount} supporting {evidenceCount===1?'file':'files'}</small></span><span className="tr-badge">{state} →</span></button>)}</div>
    {!visible.length&&<p role="status">No matching credential dates need attention in the loaded records.</p>}
  </section>;
}
