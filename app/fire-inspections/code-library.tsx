'use client';
import {useState} from 'react';
import {codeLabel, codeTypes, emptyCode, localAmendmentQuery, normalizeCode, searchCodes, selectCode, type CodeData, type CodeEntry, type CodeSelection} from './codes';
import type {InspectionFile} from './model';
import {useUnsavedWork} from '../use-unsaved-work';

const initialFilters = {query:'',type:'',edition:'',jurisdiction:'',category:'',frequent:false};
type Filters = typeof initialFilters;
function useCodeSearch(entries:CodeEntry[]) {
 const [filters,setFilters]=useState(initialFilters),[limit,setLimit]=useState(30);
 function change(next:Partial<Filters>){setFilters(f=>({...f,...next}));setLimit(30);}
 return {filters,change,limit,more:()=>setLimit(n=>n+30),matches:searchCodes(entries,filters.query,filters.type,filters.edition,filters.jurisdiction,filters.category,filters.frequent)};
}
function CodeFilters({entries,value,onChange}:{entries:CodeEntry[];value:Filters;onChange:(f:Partial<Filters>)=>void}) {
 const choices=(key:keyof CodeData)=>[...new Set(entries.map(c=>c.data[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 return <div className="fi-code-filters"><div className="fi-grid">
  <label className="fi-field">Search codes<input value={value.query} onChange={e=>onChange({query:e.target.value})} placeholder="Exit, extinguisher, FDC, section number…"/></label>
  {([{key:'edition',label:'Edition / year',values:choices('edition')},{key:'category',label:'Topic',values:choices('category')},{key:'type',label:'Code type',values:codeTypes},{key:'jurisdiction',label:'Jurisdiction',values:choices('jurisdiction')} ] as const).map(f=><label className="fi-field" key={f.key}>{f.label}<select value={value[f.key]} onChange={e=>onChange({[f.key]:e.target.value})}><option value="">{f.key==='edition'?'All editions / years':f.key==='category'?'All topics':f.key==='type'?'All code types':'All jurisdictions'}</option>{f.values.map(v=><option key={v} value={v}>{v}</option>)}</select></label>)}
 </div><div className="fi-actions"><label className="fi-check"><input type="checkbox" checked={value.frequent} onChange={e=>onChange({frequent:e.target.checked})}/>Frequent only</label><button type="button" onClick={()=>onChange(initialFilters)}>Clear filters</button></div></div>;
}
function CodeSource({data}:{data:CodeData}) {
 return <details className="fi-code-source"><summary>Read reference and source</summary><p className="fi-prewrap">{data.text||'No text stored. Open the source document.'}</p><p className="fi-muted">{data.applicability}</p>{data.sourceUrl&&<a href={data.sourceUrl} target="_blank" rel="noreferrer">Open source ↗</a>}</details>;
}
function ResultCount({count,limit,more}:{count:number;limit:number;more:()=>void}) {
 return <div className="fi-actions"><span role="status">Showing {Math.min(limit,count)} of {count} references</span>{count>limit&&<button type="button" onClick={more}>Show {Math.min(30,count-limit)} more</button>}</div>;
}
function CodeTags({data}:{data:CodeData}) {
 return <p className="fi-code-tags"><span>{data.type}</span><span>{data.edition}</span>{data.category&&<span>{data.category}</span>}{data.frequent==='yes'&&<span>★ Frequent</span>}</p>;
}
function LocalAmendment({data,onShow}:{data:CodeData;onShow:()=>void}) {
 return data.applicability.includes('STICKNEY AMENDMENT:')?<button type="button" className="fi-link" onClick={onShow}>Read Stickney changes for § {data.section}</button>:null;
}

export function CodePicker({entries,selected,onChange,label='Select verified code references'}:{entries:CodeEntry[];selected:CodeSelection[];onChange:(value:CodeSelection[])=>void;label?:string}) {
 const search=useCodeSearch(entries);
 return <details className="fi-panel"><summary>{label} · {selected.length} selected</summary>
  <p>Search → choose the applicable year → select a reference. Read local changes before citing. Each selection keeps its saved wording and version.</p>
  <div className="fi-code-selected">{selected.map(c=><div key={c.id+':'+c.version}><strong>{codeLabel(c)}</strong><small>Library version {c.version}</small><button type="button" onClick={()=>onChange(selected.filter(s=>s.id!==c.id||s.version!==c.version))}>Remove {c.title}</button></div>)}</div>
  <CodeFilters entries={entries.filter(c=>!c.archived)} value={search.filters} onChange={search.change}/>
  <div className="fi-code-results">{search.matches.slice(0,search.limit).map(c=>{const chosen=selected.some(s=>s.id===c.id&&s.version===c.version);return <article className="fi-panel fi-code-card" key={c.id}><h4>{c.data.section&&`§ ${c.data.section} · `}{c.data.title}</h4><CodeTags data={c.data}/><CodeSource data={c.data}/><LocalAmendment data={c.data} onShow={()=>search.change({query:localAmendmentQuery(entries,c.data),type:'Local ordinance',category:'',frequent:false})}/><button type="button" disabled={chosen||selected.length>=30} onClick={()=>onChange([...selected,selectCode(c)])}>{chosen?'Selected':'+ Select reference'}</button></article>;})}</div>
  {!search.matches.length&&<p>No matches. Clear filters or add a verified reference in Code library. Save your inspection draft before leaving this screen.</p>}
  {selected.length>=30&&<p>30 references selected. Remove a reference before adding another here.</p>}
  <ResultCount count={search.matches.length} limit={search.limit} more={search.more}/>
 </details>;
}

export default function CodeLibrary({entries,files,onSaved,onUpload,onEditingChange}:{entries:CodeEntry[];files:InspectionFile[];onSaved:(c:CodeEntry)=>void;onEditingChange:(editing:boolean)=>void;onUpload:(file:File,target:{codeId:string})=>Promise<void>}) {
 const [archived,setArchived]=useState(false),[editing,setEditing]=useState<CodeEntry|null>(null),[data,setData]=useState(emptyCode),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState('');
 const visible=entries.filter(c=>c.archived===archived),search=useCodeSearch(visible.map(c=>({...c,archived:false})));
 const dirty=!!editing&&JSON.stringify(data)!==JSON.stringify({...emptyCode(),...editing.data});useUnsavedWork(dirty,busy);
 function edit(c:CodeEntry){onEditingChange(true);setEditing(c);setData({...emptyCode(),...c.data});setError('');setSaved('');}
 async function save(c:CodeEntry){setBusy(true);setError('');setSaved('');try{const r=await fetch('/api/fire-inspections/codes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...c,data:normalizeCode(c.data)})}),j=await r.json();if(!r.ok)throw Error(j.error||'Code was not saved.');onSaved(j.entry);setEditing(null);onEditingChange(false);setSaved(`Saved: ${j.entry.data.title}. Past inspection citations keep their original version.`);}catch(e){setError(e instanceof Error?e.message:'Save not confirmed. Keep your draft and retry.');}finally{setBusy(false);}}
 const fields: [keyof CodeData,string][]=[['edition','Edition / year *'],['jurisdiction','Jurisdiction / adopting authority'],['section','Section / ordinance number'],['title','Reference title *'],['category','Topic'],['effectiveDate','Effective date, if verified'],['sourceUrl','Source link']];
 return <section className="fi-code-library"><div className="fi-heading"><div><h2>Code library</h2><p>Find a reference → read its source → use it in an inspection.</p></div>{!editing&&<button className="fi-primary" onClick={()=>edit({id:crypto.randomUUID(),version:0,archived:false,updatedAt:'',updatedBy:'',data:emptyCode()})}>+ Add code / ordinance</button>}</div>
 <details className="fi-note"><summary>Stickney’s published adoption: IBC 2009 + local changes</summary><p><a href="https://library.municode.com/il/stickney/codes/code_of_ordinances?nodeId=MUCO_CH18BUBURE_ARTIIIBUCO_S18-101ADBUCO" target="_blank" rel="noreferrer">Municode § 18-101</a> lists IBC 2009. <a href="https://library.municode.com/il/stickney/codes/code_of_ordinances?nodeId=MUCO_CH18BUBURE_ARTIIIBUCO_S18-102ADINDECH" target="_blank" rel="noreferrer">§ 18-102</a> contains local changes. Verified against the May 26, 2026 municipal version.</p><p>The starter has 150 curated IBC references plus local provisions. These are inspection prompts, not a measured ranking of violations or the complete code text. Mark your frequently used entries below. You can add another verified edition at any time.</p><p>Confirm the edition, project scope, state requirements and local approvals for each property. An older building does not automatically qualify for an older code.</p></details>
 {error&&<p role="alert" className="fi-error">{error}</p>}{saved&&<p role="status" className="fi-note">{saved}</p>}
 {editing?<form className="fi-panel" onSubmit={e=>{e.preventDefault();void save({...editing,data});}}><h3>{editing.version?'Edit reference':'Add reference'}</h3><fieldset disabled={busy} className="fi-form-body"><div className="fi-grid"><label className="fi-field">Code type *<select value={data.type} onChange={e=>setData({...data,type:e.target.value})}>{codeTypes.map(t=><option key={t}>{t}</option>)}</select></label>{fields.map(([k,label])=><label className="fi-field" key={k}>{label}<input required={k==='edition'||k==='title'} type={k==='effectiveDate'?'date':k==='sourceUrl'?'url':'text'} value={data[k]} onChange={e=>setData({...data,[k]:e.target.value})}/></label>)}</div><label className="fi-check"><input type="checkbox" checked={data.frequent==='yes'} onChange={e=>setData({...data,frequent:e.target.checked?'yes':''})}/>Frequently used by our department</label><label className="fi-field">Inspection prompt / permitted reference text<textarea rows={6} value={data.text} onChange={e=>setData({...data,text:e.target.value})}/></label><label className="fi-field">Applicability / verified adoption notes<textarea rows={4} value={data.applicability} onChange={e=>setData({...data,applicability:e.target.value})} placeholder="Adoption ordinance, occupancy, scope, exceptions, approval reference…"/></label><p>Save first to attach a permitted PDF or photo. Search uses the text above; it does not search inside attachments.</p><div className="fi-actions"><button type="button" onClick={()=>{if(!dirty||window.confirm('Discard unsaved code changes?')){setEditing(null);onEditingChange(false);}}}>← Back to code library</button><button className="fi-primary" type="submit">{busy?'Saving…':'Save reference'}</button></div></fieldset></form>:<>
 <CodeFilters entries={visible} value={search.filters} onChange={search.change}/><label className="fi-check"><input type="checkbox" checked={archived} onChange={e=>{setArchived(e.target.checked);search.change({});}}/>Show archived references</label>
 <p>{search.matches.length} matching references · {visible.length} {archived?'archived':'available'}</p>
 <div className="fi-library-results">{search.matches.slice(0,search.limit).map(c=><article className="fi-panel fi-code-card" key={c.id}><h3>{c.data.section&&`§ ${c.data.section} · `}{c.data.title}</h3><CodeTags data={c.data}/><CodeSource data={c.data}/><LocalAmendment data={c.data} onShow={()=>search.change({query:localAmendmentQuery(entries,c.data),type:'Local ordinance',category:'',frequent:false})}/><div className="fi-actions"><button disabled={busy} onClick={()=>edit({...c,archived})}>Edit reference</button><button disabled={busy} aria-pressed={c.data.frequent==='yes'} onClick={()=>void save({...c,archived,data:{...c.data,frequent:c.data.frequent==='yes'?'':'yes'}})}>{c.data.frequent==='yes'?'★ Remove from frequent':'☆ Mark frequent'}</button></div><details><summary>Documents and archive · version {c.version}</summary>{files.filter(f=>f.codeId===c.id).map(f=><p key={f.id}><a href={`/api/fire-inspections/files/${encodeURIComponent(f.id)}`}>{f.filename}</a></p>)}{!archived&&<label className="fi-field">Attach reference (PDF / photo, up to 4 MB)<input type="file" disabled={busy} accept="application/pdf,image/jpeg,image/png,image/webp" onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;setBusy(true);setError('');try{await onUpload(file,{codeId:c.id});setSaved(`Attachment saved for ${c.data.title}.`);}catch(err){setError(err instanceof Error?err.message:'Upload failed.');}finally{setBusy(false);}}}/></label>}<button disabled={busy} onClick={()=>{if(window.confirm(`${archived?'Restore':'Archive'} this reference? Past reports keep their saved selection.`))void save({...c,archived:!archived});}}>{archived?'Restore reference':'Archive reference'}</button></details></article>)}</div>
 {!search.matches.length&&<div className="fi-panel"><h3>No matching references</h3><p>{search.filters.frequent?'No entries match Frequent only. Clear the filter and choose Mark frequent on the references you use most.':'Clear filters to see more references, or add a verified code / ordinance.'}</p></div>}
 <ResultCount count={search.matches.length} limit={search.limit} more={search.more}/>
 </>}
 </section>;
}
