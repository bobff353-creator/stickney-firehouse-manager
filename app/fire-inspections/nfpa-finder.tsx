'use client';
import { useState } from 'react';
import { emptyInspection, type InspectionData } from './model';
import { addNfpaCheckpoints, nfpaDirectory, nfpaDirectoryCheckedOn, nfpaDirectoryUrl, nfpaSource, referenceGroups, searchNfpa, type NfpaChoice, type NfpaReference } from './nfpa-references';

type Props={data?:InspectionData;onChange?:(data:InspectionData)=>void;onStart?:(data:InspectionData)=>void};
const quickTopics=['Extinguishers','Exits','Sprinkler','Alarm','Hood','Fire door','Electrical','Battery'];
function ReferenceCard({reference,year,onYear,selected,onSelect,added,canSelect}:{reference:NfpaReference;year:string;onYear:(year:string)=>void;selected:boolean;onSelect:()=>void;added:boolean;canSelect:boolean}){
 const edition=reference.editions?.find(e=>e.year===year);
 return <article className="fi-nfpa-card">
  <div><span className="fi-eyebrow">{reference.number}</span><h3>{reference.guide?.topic||reference.title}</h3>{reference.guide&&<p className="fi-muted">{reference.title}</p>}</div>
  {reference.guide&&<><p>{reference.guide.prompt}</p><small>{reference.guide.group}</small></>}
  {reference.editions&&<label className="fi-field">Research edition · {reference.number}<select value={year} onChange={e=>onYear(e.target.value)}>{reference.editions.map(e=><option key={e.year} value={e.year}>{e.year}{e.year===reference.listedEdition?' · publisher-listed edition':''}</option>)}</select></label>}
  <div className="fi-actions">{edition&&<a className="fi-button" href={edition.url} target="_blank" rel="noreferrer">Free view · {year} ↗</a>}<a href={reference.url} target="_blank" rel="noreferrer">{edition?'Other editions & official page ↗':'Official page & free-view options ↗'}</a></div>
  {reference.guide&&canSelect&&<label className="fi-check"><input type="checkbox" checked={selected||added} disabled={added} onChange={onSelect}/>{added?'Already in this inspection':`Select ${reference.number} research checkpoint`}</label>}
  {reference.guide?.reading&&<small>{reference.guide.reading}</small>}
 </article>;
}
export default function NfpaFinder({data,onChange,onStart}:Props){
 const [query,setQuery]=useState(''),[group,setGroup]=useState(''),[all,setAll]=useState(false),[limit,setLimit]=useState(12);
 const [years,setYears]=useState<Record<string,string>>({}),[selected,setSelected]=useState<Record<string,string>>({}),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const matches=searchNfpa(query,group,all);
 const choices:NfpaChoice[]=Object.entries(selected).map(([number,year])=>({number,year}));
 function search(value:string){setQuery(value);setLimit(12);}
 function add(){
  setError('');
  try{
   const base=data||emptyInspection(),next=addNfpaCheckpoints(base,choices,()=>crypto.randomUUID());
   const added=next.checks.length-base.checks.length;
   if(data&&onChange)onChange(next);else if(onStart)onStart(next);
   setSelected({});setNotice(`${added} research checkpoint${added===1?'':'s'} added. All start as Not checked. Save your inspection to keep them.`);
  }catch(e){setError(e instanceof Error?e.message:'The selected checkpoints could not be added.');}
 }
 return <section className="fi-nfpa" aria-label="NFPA reference finder">
  <h2>NFPA finder</h2><p>Find a topic → choose a research edition → open NFPA’s free view.</p>
  <div className="fi-note"><strong>Use the edition that applies to this property.</strong><p>Publisher-listed editions are not verified as adopted by Stickney. Confirm the occupancy, adopted code, referenced edition, and local amendments before issuing a citation.</p></div>
  <label className="fi-field">Search NFPA number or inspection topic<input type="search" value={query} onChange={e=>search(e.target.value)} placeholder="Try 10, hood, sprinkler, exit, or battery…"/></label>
  <div className="fi-actions fi-nfpa-topics" aria-label="Common NFPA topics">{quickTopics.map(topic=><button type="button" key={topic} aria-pressed={query.toLowerCase()===topic.toLowerCase()} onClick={()=>{search(topic);setGroup('');}}>{topic}</button>)}</div>
  <div className="fi-grid"><label className="fi-field">Narrow by inspection use<select value={group} onChange={e=>{setGroup(e.target.value);setLimit(12);}}><option value="">All inspection uses</option>{referenceGroups.map(g=><option key={g}>{g}</option>)}</select></label><label className="fi-check"><input type="checkbox" checked={all} onChange={e=>{setAll(e.target.checked);setLimit(12);}}/>Browse all {nfpaDirectory.length} directory entries</label></div>
  <p className="fi-muted">Search covers directory titles and inspection topics, not the full text of the books. A search includes all {nfpaDirectory.length} entries within your chosen filter. NFPA may require a free account and acceptance of its viewing terms.</p>
  {choices.length>0&&<div className="fi-note fi-nfpa-selection"><strong>{choices.length} selected for this inspection</strong><div className="fi-actions"><button type="button" className="fi-primary" onClick={add}>{data?`Add ${choices.length} checkpoint${choices.length===1?'':'s'} to inspection`:'Start inspection with selected checkpoints'}</button><button type="button" onClick={()=>setSelected({})}>Clear selection</button></div><p>Selections remain selected when you search another topic. They add observation prompts, not findings or verified citations.</p><ul>{choices.map(c=><li key={c.number}>{c.number} · {c.year} <button className="fi-link" type="button" onClick={()=>setSelected(current=>{const next={...current};delete next[c.number];return next;})}>Remove {c.number}</button></li>)}</ul></div>}
  {notice&&<p role="status" className="fi-success">{notice}</p>}{error&&<p role="alert" className="fi-error">{error}</p>}
  <p role="status">{matches.length} reference{matches.length===1?'':'s'} found{!query&&!all?' · inspection references first':''}.</p>
  {!matches.length&&<div className="fi-panel"><p>No matches. Try a code number or a shorter topic.</p><button type="button" onClick={()=>{search('');setGroup('');setAll(true);}}>Clear filters and browse directory</button></div>}
  <div className="fi-nfpa-grid">{matches.slice(0,limit).map(reference=>{
   const year=years[reference.number]||reference.editions?.[0]?.year||'';
   const added=Boolean(data&&reference.guide&&year&&data.checks.some(c=>c.source===nfpaSource(reference,year)));
   return <ReferenceCard key={reference.number} reference={reference} year={year} added={added} selected={Object.hasOwn(selected,reference.number)} canSelect={Boolean(onChange||onStart)} onYear={value=>{setYears(current=>({...current,[reference.number]:value}));setSelected(current=>Object.hasOwn(current,reference.number)?{...current,[reference.number]:value}:current);}} onSelect={()=>setSelected(current=>{const next={...current};if(Object.hasOwn(next,reference.number))delete next[reference.number];else next[reference.number]=year;return next;})}/>;
  })}</div>
  {matches.length>limit&&<button type="button" onClick={()=>setLimit(value=>value+24)}>Show more references ({matches.length-limit} remaining)</button>}
  <details className="fi-panel"><summary>How to use a reference in an inspection</summary><ol><li>Choose the property’s applicable code and edition. Use “Other editions” if the needed year is not listed here.</li><li>Open NFPA’s page and free view to read the requirement, scope, exceptions, and current notices.</li><li>Select an optional research checkpoint to document what you observe. It starts as Not checked.</li><li>For a finding, add the verified section and edition in Findings. Administrators can save reusable wording and source links in Code library.</li></ol><p>The full directory includes specialized and historical documents. Inclusion here does not confirm a document is current, adopted, or applicable. This is an independent department reference finder.</p><small>Directory titles and links checked {nfpaDirectoryCheckedOn} across all nine directory pages. Only the listed free-view links were verified; this is not a review of every book. No NFPA book text is stored here.</small><p><a href={nfpaDirectoryUrl} target="_blank" rel="noreferrer">Open NFPA’s full directory and current information ↗</a></p></details>
 </section>;
}
