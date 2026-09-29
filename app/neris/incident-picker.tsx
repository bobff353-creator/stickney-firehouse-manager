'use client';
import {useId,useState} from 'react';
import {schemas,humanLabel,officialLinks,type Json,type Values} from './model';
import {incidentCategories,incidentTypeGuides,sectionHelp} from './guide';

const options=(schemas.TypeIncidentValue.enum||[]).map(String);
export function IncidentPicker({value,onChange}:{value:Json|undefined;onChange:(value:Json)=>void}) {
  const [category,setCategory]=useState(''),[query,setQuery]=useState(''),id=useId();
  const selected=Array.isArray(value)?value as Values[]:[];
  const shown=options.filter(code=>(!category||code.split('||')[0]===category)&&humanLabel(code).toLowerCase().includes(query.trim().toLowerCase().replaceAll('_',' ')));
  function toggle(code:string,checked:boolean){
    if(checked){if(selected.length<3&&!selected.some(v=>v.type===code))onChange([...selected,{type:code}]);}
    else onChange(selected.filter(v=>v.type!==code));
  }
  return <section className="nr-type-picker" aria-label="Incident types">
    <div className="nr-section-title"><div><p className="nr-eyebrow">CLASSIFY THE INCIDENT</p><h3>What did responders find?</h3></div><span className="nr-badge">{selected.length} / 3 selected</span></div>
    <p>{sectionHelp.core}</p>
    {selected.length>0&&<div className="nr-selected-types" aria-label="Selected incident types">{selected.map((item,index)=><div className="nr-selected-type" key={index}>
      <span><small>{incidentCategories[String(item.type).split('||')[0]]||'Recorded type'}</small><strong>{incidentCategories[String(item.type)]||humanLabel(String(item.type||'Unanswered incident type').split('||').slice(1).join(' · ')||String(item.type))}</strong></span>
      <label className="nr-check"><input type="checkbox" checked={item.primary===true} onChange={e=>onChange(selected.map((v,i)=>({...v,primary:i===index?e.target.checked:false})))}/>Primary<span className="nr-sr-only"> for {humanLabel(String(item.type))}</span></label>
      <button type="button" className="nr-text-button" aria-label={`Remove ${humanLabel(String(item.type||'unanswered type'))}`} onClick={()=>onChange(selected.filter((_,i)=>i!==index))}>Remove</button>
    </div>)}</div>}
    <div className="nr-category-grid" aria-label="Filter incident categories"><button type="button" aria-pressed={!category} onClick={()=>{setCategory('');setQuery('');}}>All types<small>{options.length} choices</small></button>{Object.entries(incidentCategories).map(([key,label])=><button key={key} type="button" aria-pressed={category===key} onClick={()=>{setCategory(key);setQuery('');}}>{label}<small>{options.filter(v=>v.split('||')[0]===key).length} {options.filter(v=>v.split('||')[0]===key).length===1?'choice':'choices'}</small></button>)}</div>
    <label htmlFor={id}>Search official incident types<input id={id} type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search, for example: cooking, fall, smoke…"/></label>
    <div className="nr-result-heading"><small role="status">{shown.length} {category?incidentCategories[category].toLowerCase():''} {shown.length===1?'choice':'choices'}{selected.length===3?' · Remove a selection to choose another':''}</small>{query&&<button className="nr-text-button" type="button" onClick={()=>setQuery('')}>Clear search</button>}</div>
    <div className="nr-type-results">{shown.map(code=>{const checked=selected.some(v=>v.type===code),parts=code.split('||');return <label className={`nr-type-option ${checked?'is-selected':''}`} key={code}><input type="checkbox" checked={checked} disabled={!checked&&selected.length>=3} onChange={e=>toggle(code,e.target.checked)}/><span><strong>{incidentCategories[code]||humanLabel(parts.at(-1)!)}</strong><small>{parts.slice(0,-1).map(p=>incidentCategories[p]||humanLabel(p)).join(' / ')}</small></span></label>;})}{!shown.length&&<p className="nr-empty">No matching types. Clear your search or choose another category.</p>}</div>
    <details className="nr-reference"><summary>Selection help & official references</summary><p>Choose the final situation found on scene, which may differ from dispatch. Search or browse the categories above, check up to three types, and mark at most one primary. No type is chosen automatically.</p><p>Choices come directly from the report’s official NERIS schema. A category narrows the list; it does not classify the report.</p><a href={`${officialLinks.userGuide}#page=53`} target="_blank" rel="noreferrer">Official incident field guide ↗</a>{category&&incidentTypeGuides[category]&&<p><a href={incidentTypeGuides[category]} target="_blank" rel="noreferrer">{incidentCategories[category]} diagram ↗</a></p>}</details>
  </section>;
}
