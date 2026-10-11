'use client';
import {useEffect,useState} from 'react';
import {emptyTeam,ownerIdentityId,type InspectionIdentity,type InspectionTeam} from './team-workflow';
import type {InspectionRecord} from './model';
function useInspectionIdentities(){
 const [identities,setIdentities]=useState<InspectionIdentity[]>([]),[error,setError]=useState('');
 useEffect(()=>{const c=new AbortController();void fetch('/api/fire-inspections/team',{cache:'no-store',signal:c.signal}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error);if(!c.signal.aborted)setIdentities(j.identities);}).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[]);
 return {identities,error};
}
export function TeamEditor({value,onChange}:{value:InspectionTeam;onChange:(value:InspectionTeam)=>void}){
 const {identities,error}=useInspectionIdentities();
 const change=(patch:Partial<InspectionTeam>)=>onChange({...value,...patch,state:'Draft',actedBy:'',actedAt:''});
 return <section className="fi-panel"><h3>Inspection team & review</h3><p>Assign existing identities as lead, assisting inspector, or reviewer. Assignments do not grant access. Other employees cannot open this private pilot; only the authorized owner can act here.</p>{error&&<p role="alert">{error} Your saved assignments remain unchanged.</p>}
 <div className="fi-grid"><label className="fi-field">Lead inspector identity<select value={value.assignees.find(a=>a.role==='Lead')?.id||''} disabled={!identities.length} onChange={e=>change({assignees:[...value.assignees.filter(a=>a.role!=='Lead'&&a.id!==e.target.value),...(e.target.value?[{id:e.target.value,role:'Lead' as const}]:[])]})}><option value="">Not assigned</option>{identities.map(p=><option key={p.id} value={p.id}>{p.name}{p.id!==ownerIdentityId?' · assignment only':''}</option>)}</select></label>
 <label className="fi-field">Reviewer identity<select value={value.reviewerId} disabled={!identities.length} onChange={e=>change({reviewerId:e.target.value})}><option value="">Not assigned</option>{identities.map(p=><option key={p.id} value={p.id}>{p.name}{p.id!==ownerIdentityId?' · access rollout disabled':''}</option>)}</select></label></div>
 <details><summary>Assisting inspectors</summary>{identities.filter(p=>p.id!==value.assignees.find(a=>a.role==='Lead')?.id).map(p=><label className="fi-check" key={p.id}><input type="checkbox" checked={value.assignees.some(a=>a.id===p.id)} onChange={e=>change({assignees:e.target.checked?[...value.assignees,{id:p.id,role:'Assisting'}]:value.assignees.filter(a=>a.id!==p.id)})}/>{p.name}</label>)}</details>
 <label className="fi-check"><input type="checkbox" checked={value.required} onChange={e=>change({required:e.target.checked})}/>Require recorded review before finishing</label><p>Review: {value.state}. Save the current inspection, then submit the saved version from its record. Owner review is not independent second-person approval.</p></section>;
}
export function TeamReview({record,busy,onSave}:{record:InspectionRecord;busy:boolean;onSave:(r:InspectionRecord)=>Promise<void>}){
 const team=record.data.team||emptyTeam(),[notes,setNotes]=useState(team.notes);
 const {identities}=useInspectionIdentities(),name=(id:string)=>identities.find(p=>p.id===id)?.name||(id===ownerIdentityId?'Pilot owner':'Assigned employee');
 const act=(state:InspectionTeam['state'])=>void onSave({...record,data:{...record.data,team:{...team,state,notes}}});
 return <section className="fi-panel"><h3>Assignment & review</h3><p>{team.assignees.length} assigned inspector(s) · {team.state}{team.required?' · required before completion':''}</p>{!!team.assignees.length&&<ul>{team.assignees.map(a=><li key={a.id}>{name(a.id)} · {a.role}</li>)}</ul>}{team.reviewerId&&<p>Reviewer: {name(team.reviewerId)}</p>}{team.actedAt&&<p>Recorded by {team.actedBy} at {new Date(team.actedAt).toLocaleString()} · saved version {record.version}</p>}<p>{team.notes}</p><p>Other employee access is disabled. Assigning people never grants record access.</p>
 {!record.archived&&record.data.status!=='Completed'&&<><label className="fi-field">Review notes<textarea disabled={busy||team.state==='Approved'} value={notes} onChange={e=>setNotes(e.target.value)} maxLength={4000}/></label><div className="fi-actions">{['Draft','Changes requested','Not requested'].includes(team.state)&&<button disabled={busy||!team.reviewerId||!team.assignees.some(a=>a.role==='Lead')} onClick={()=>act('Submitted')}>Submit saved version for review</button>}{team.state==='Submitted'&&(team.reviewerId===ownerIdentityId?<><button disabled={busy} onClick={()=>act('Approved')}>Approve reviewed version</button><button disabled={busy||!notes.trim()} onClick={()=>act('Changes requested')}>Request changes</button></>:<p>Assigned reviewer access has not been enabled. Change the reviewer to the pilot owner to review within current access.</p>)}</div></>}
 </section>;
}
