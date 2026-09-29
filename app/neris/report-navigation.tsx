'use client';
import {useState} from 'react';
import {sections,officialLinks} from './model';
import {guidePages,sectionHelp} from './guide';
import type {Issue} from './validation';

export const shortTitle=(title:string)=>title.replace(/^\d+ · /,'');
const groups=[{label:'Incident',ids:['core','location']},{label:'Response',ids:['dispatch','units','actions']},{label:'Findings',ids:['details','emerging','exposures','risk','rescues']},{label:'Finish',ids:['narrative','files','review']}];
export function ReportNavigation({step,onMove,issues,disabled}:{step:string;onMove:(id:string)=>void;issues:Issue[]|null;disabled:boolean}) {
  const [query,setQuery]=useState('');
  const active=sections.findIndex(s=>s.id===step),needle=query.trim().toLowerCase();
  return <aside className="nr-navigation">
    <label className="nr-mobile-jump">Go to section<select value={step} disabled={disabled} onChange={e=>onMove(e.target.value)}>{sections.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
    <nav className="nr-step-nav" aria-label="Report sections"><div className="nr-nav-heading"><p className="nr-eyebrow">YOUR REPORT</p><strong>Section {active+1} of {sections.length}</strong><small>Move between sections at any time.</small></div>
      <label className="nr-nav-search"><span className="nr-sr-only">Find a report section</span><input type="search" placeholder="Find a section…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      {groups.map(group=>{const rows=sections.filter(s=>group.ids.includes(s.id)&&`${s.title} ${s.hint} ${s.paths.join(' ')}`.toLowerCase().includes(needle));return rows.length>0&&<div className="nr-nav-group" key={group.label}><p>{group.label}</p>{rows.map(s=><button key={s.id} type="button" disabled={disabled} aria-current={step===s.id?'step':undefined} onClick={()=>onMove(s.id)}><span className="nr-step-number">{sections.indexOf(s)+1}</span><span>{shortTitle(s.title)}</span>{issues?.some(i=>i.section===s.id)&&<span className="nr-issue-dot" aria-label="Needs attention">!</span>}</button>)}</div>;})}
      {needle&&!sections.some(s=>`${s.title} ${s.hint} ${s.paths.join(' ')}`.toLowerCase().includes(needle))&&<p>No matching sections.</p>}
    </nav>
  </aside>;
}
export function SectionGuide({step}:{step:string}) {
  const section=sections.find(s=>s.id===step)!;
  return <details className="nr-section-guide"><summary>What belongs in this section?</summary><p>{sectionHelp[step]||section.hint}</p><p>Choose known facts using the fields below. Leave unconfirmed information unanswered and use Review to identify missing items.</p>{guidePages[step]&&<a href={`${officialLinks.userGuide}#page=${guidePages[step]}`} target="_blank" rel="noreferrer">Official guide · page {guidePages[step]} ↗</a>}</details>;
}
