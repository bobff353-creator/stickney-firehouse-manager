'use client';
import {endpointChoices} from './staffing-time';
export default function TimeOccurrenceSelect({date,timeIn,timeOut,endpoint,operational=false,value='',onChange,disabled=false,label}:{date:string;timeIn:string;timeOut:string;endpoint:'in'|'out';operational?:boolean;value?:string;onChange:(value:string)=>void;disabled?:boolean;label:string}) {
  const choices=endpointChoices(date,timeIn,timeOut,endpoint,operational);
  if(choices.length<2&&!value)return null;
  return <label className="time-occurrence-control" style={{display:'flex',flexDirection:'column',gap:4,maxWidth:'100%',gridColumn:'1 / -1'}}><span>{label} — clock-change occurrence</span><select aria-label={`${label} occurrence`} disabled={disabled} value={value} onChange={event=>onChange(event.target.value)} style={{width:'100%',maxWidth:'100%',minHeight:44}}><option value="">Choose the recorded occurrence…</option>{choices.map(choice=><option key={choice.value} value={choice.value}>{choice.label}</option>)}</select><small>This clock time occurs twice. Choose the recorded occurrence and date; adjacent handoffs are allowed.</small></label>;
}
