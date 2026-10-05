import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ScheduleSafetyPanel } from '../../app/schedule-safety-panel';
import { PayrollTimekeepingPanel } from '../../app/payroll-timekeeping-panel';
import { timekeepingReview } from '../../app/payroll-timekeeping-review';
import type { SavedScheduleSafety } from '../../app/schedule-safety-store';
import '../../app/globals.css';
const members=[{id:'preview-a',name:'Fictional Member A',roles:'["FF/Attendant"]'}];
const slots=[{id:'preview-1',employeeId:'preview-a',entryDate:'2026-10-05',startTime:'18:00',endTime:'06:00',role:'FF/Attendant',status:'filled'}, {id:'preview-2',employeeId:'preview-a',entryDate:'2026-10-06',startTime:'05:00',endTime:'12:00',role:'Engine Driver',status:'filled'}];
const entries=[{employeeId:'preview-a',workDate:'2026-10-05',category:'shift',hours:5}];
const staffing=[{employeeId:'preview-a',logDate:'2026-10-05',shiftKey:'morning',timeIn:'06:00',timeOut:'12:00'}];
function Preview() {
  const [dark,setDark]=useState(true);
  const [saved,setSaved]=useState<SavedScheduleSafety>({revision:'initial-fixture',updatedAt:'',rules:{minimumRestHours:null,maximumContinuousHours:null}});
  const [fail,setFail]=useState(false);
  const [status,setStatus]=useState('No local saves.');
  const [busy,setBusy]=useState(false);
  async function save(body:Record<string,unknown>) {
    setBusy(true);
    await new Promise(resolve=>setTimeout(resolve,150));
    setBusy(false);
    if(fail) {setFail(false);setStatus('Simulated save failure. Inputs should remain available.');return null;}
    if(body.revision!==saved.revision) {setStatus('Simulated stale revision. Draft kept.');return null;}
    setSaved({revision:crypto.randomUUID(),updatedAt:new Date().toISOString(),rules:body.rules as SavedScheduleSafety['rules']});
    setStatus('Saved to local preview state only.');return {ok:true};
  }
  return <main className={dark?'app-shell sidebar-collapsed':''} style={{display:'block',maxWidth:1000,margin:'auto',padding:16}}>
    <p style={{background:'#fff2b0',color:'#111',padding:12}}>LOCAL PREVIEW ONLY · fictional data. Nothing is sent to production.</p>
    <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:16}}><button onClick={()=>setDark(value=>!value)}>{dark?'Use light preview':'Use dark preview'}</button><button onClick={()=>setFail(true)}>Fail next rule save</button><button onClick={()=>setSaved(value=>({...value,revision:crypto.randomUUID()}))}>Simulate another administrator</button></div>
    <p role="status">{status}</p>
    <ScheduleSafetyPanel slots={slots} members={members} saved={saved} today="2026-10-05" canEdit busy={busy} onSave={save} onDay={date=>setStatus(`Opened ${date} in local preview.`)} />
    <div style={{marginTop:24}}><PayrollTimekeepingPanel flags={timekeepingReview(members,entries,staffing,'2026-10-01','2026-10-10')} from="2026-10-01" through="2026-10-10" onMember={id=>setStatus(`Opened ${id} timesheet in local preview.`)} /></div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
