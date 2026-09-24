import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import PayrollPayBreakdown from '../../app/payroll-pay-breakdown';
import { summarizePayroll, type PayrollEntry } from '../../app/payroll-calculation';
import '../../app/globals.css';
import '../../app/portal-usability.css';

window.fetch = async () => { throw new Error('Application requests are blocked in this fictional preview'); };
function Preview() {
  const [scenario, setScenario] = useState('regular');
  const entries: PayrollEntry[] = scenario === 'regular' ? [{category:'shift',hours:36},{category:'workDetail',hours:7},{category:'actingOfficer',hours:6}] : scenario === 'dpw' ? [{category:'shift',hours:120},{category:'holiday',hours:8},{category:'actingOfficer',hours:4}] : [{category:'shift',hours:110},{category:'holiday',hours:8},{category:'dpw',hours:8},{category:'actingOfficer',hours:6}];
  const result=summarizePayroll({rank:'Firefighter',regularRate:23,isDpw:scenario==='dpw'},entries,{overtimeThreshold:106,actingOfficerPremium:1,dpwMultiplier:1.5});
  return <main style={{padding:16,maxWidth:1000,margin:'auto'}}>
    <aside style={{padding:12,background:'#fff4c2',color:'#17324d'}}><strong>Fictional preview · no saved employee or payroll changes</strong><label style={{display:'block'}}>Example<select value={scenario} onChange={event=>setScenario(event.target.value)}><option value="regular">43 worked hours + 6 AO</option><option value="dpw">DPW with holiday and over 106 hours</option><option value="mixed">Regular, OT, holiday, DPW and AO</option></select></label></aside>
    <PayrollPayBreakdown lines={result.lines} gross={result.gross} baseRate={23} overtimeThreshold={106} isDpw={scenario==='dpw'} />
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
