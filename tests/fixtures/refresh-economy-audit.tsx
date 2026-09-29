import React from 'react';
import { createRoot } from 'react-dom/client';
import RoleDashboard from '../../app/role-dashboard';
import '../../app/globals.css';
import '../../app/portal-usability.css';
import '../../app/workflow-usability.css';
if (!['127.0.0.1', 'localhost'].includes(location.hostname)) throw Error('Local fictional fixture only');
const reads = new Map<string, number>();
window.fetch = async (input, init) => {
  const url = String(input);
  if (init?.method && init.method !== 'GET') throw Error('Writes blocked by fixture');
  if (!['/api/dashboard', '/api/department-schedule', '/api/resources?type=policy&summary=1', '/api/resources?type=boxCard&summary=1'].includes(url)) throw Error('External or unknown request blocked');
  reads.set(url, (reads.get(url) || 0) + 1);
  const output = document.getElementById('request-counts');
  if (output) output.textContent = JSON.stringify(Object.fromEntries(reads), null, 2);
  if (url === '/api/department-schedule') return Response.json({ items: [], asOf: new Date().toISOString() });
  if (url.startsWith('/api/resources')) return Response.json({ count: url.includes('policy') ? 2 : 3 });
  return Response.json({
    asOf: new Date().toISOString(), currentShift:'morning', priorShift:'overnight', onDuty:[], newMembers:[], officerInCharge:null,
    staffing:{filled:0,required:4,complete:false},equipmentIssues:[],approvals:{logs:0,payroll:0},activeCalls:[],checksDue:0,
    previousShift:{officer:null,note:'Fictional test handoff',calls:[]},
  });
};
const data = { viewer:{isAdmin:true,displayName:'Fictional member',employeeId:null},employees:[],entries:[],period:{startDate:'2026-09-11',endDate:'2026-09-25',status:'draft'},grossPayroll:0,reviewCount:0,employeeGross:0 };
createRoot(document.getElementById('root')!).render(<><aside style={{background:'#fff4be',color:'#172b3b',padding:16}}><b>FICTIONAL LOCAL TEST ONLY · no production requests</b><pre id="request-counts" aria-label="Observed requests">No requests</pre></aside><main style={{padding:24}}><RoleDashboard data={data} onNavigate={()=>{}} allowedPages={['Daily Log','Inventory','Scheduling','Respond','Field Preplans','Payroll']}/></main></>);
