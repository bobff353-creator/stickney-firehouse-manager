import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import DisciplinaryWorkspace from '../../app/disciplinary/workspace';
import type {DisciplinaryReport,DisciplinaryVersion,DisciplinaryFile} from '../../app/disciplinary/model';
import '../../app/globals.css';
import '../../app/suite-theme.css';

const people=[{id:'fixture-ff',name:'Fixture Employee',rank:'Firefighter',active:true},{id:'fixture-lt',name:'Fixture Lieutenant',rank:'Lieutenant',active:true}];
const reports=new Map<string,DisciplinaryReport>();const histories=new Map<string,DisciplinaryVersion[]>();const files:DisciplinaryFile[]=[];
let fail=false,conflict=false,denied=false;
const json=(body:unknown,status=200)=>Promise.resolve(Response.json(body,{status}));
// The fixture never delegates any request to a network service.
window.fetch=async(input,init)=>{
 const url=new URL(String(input),location.href);
 if(url.origin!==location.origin)return json({error:'External requests are disabled in this isolated fixture.'},403);
 if(url.pathname==='/api/permissions')return json({viewerPermissions:denied?[]:['disciplinary.manage','permissions.manage','payroll.view_own'],revision:'fixture',identity:'fixture-lt'});
 if(denied)return json({error:'Fixture access revoked.'},403);
 if(fail)return json({error:'Fixture connection interrupted. Your entries remain here.'},503);
 if(url.pathname==='/api/disciplinary/files'&&init?.body instanceof FormData){const file=init.body.get('file') as File;const row={id:crypto.randomUUID(),report_id:String(init.body.get('reportId')),original_filename:file.name,mime_type:file.type,byte_size:file.size,uploaded_at:new Date().toISOString(),uploaded_by_name:'Fixture Lieutenant',sha256:'a'.repeat(64)};files.push(row);return json({file:row},201);}
 if(url.pathname!=='/api/disciplinary')return json({error:'No external destination exists in this fixture.'},404);
 if(init?.method==='POST'){
  const body=JSON.parse(String(init.body));const previous=reports.get(body.id);
  if(conflict||(previous&&previous.version!==body.version))return json({error:'Another editor saved this report. Your edits remain here.'},409);
  const now=new Date().toISOString();const content=structuredClone(body.content);content.employeeName=people.find(p=>p.id===content.employeeId)?.name||'';content.supervisorName=people.find(p=>p.id===content.supervisorId)?.name||'';
  const report={id:body.id,department_id:'fixture',content,status:body.status,version:(previous?.version||0)+1,change_reason:body.reason,created_at:previous?.created_at||now,updated_at:now,submitted_at:body.status==='submitted'?now:previous?.submitted_at||null,created_by_name:'Fixture Lieutenant',updated_by_name:'Fixture Lieutenant',last_operation_id:body.operation};
  reports.set(report.id,report);histories.set(report.id,[{report_id:report.id,version:report.version,content:structuredClone(content),status:report.status,change_reason:report.change_reason,actor_name:'Fixture Lieutenant',saved_at:now},...(histories.get(report.id)||[])]);return json({report});
 }
 const id=url.searchParams.get('id');if(id){const report=reports.get(id);if(!report)return json({error:'Fixture report not found'},404);const versions=histories.get(id)||[];return json({report,versions,files:files.filter(f=>f.report_id===id),snapshot:url.searchParams.get('version')?versions.find(v=>v.version===Number(url.searchParams.get('version'))):null});}
 const employee=url.searchParams.get('employee'),status=url.searchParams.get('status');const selected=[...reports.values()].filter(r=>(!employee||r.content.employeeId===employee)&&(!status||status==='submitted'?(!status||!!r.submitted_at):r.status===status));return json({reports:selected.map(r=>({...r,...r.content})),total:selected.length,people,canManageAccess:true});
};
function Preview(){const[theme,setTheme]=useState(false);return <main style={{maxWidth:1100,margin:'0 auto',padding:16,background:theme?'#101a2c':'#f7f4ee',color:theme?'#f1f5f9':'#142c45','--card':theme?'#15263a':'#fff','--background':theme?'#101a2c':'#fff','--foreground':theme?'#f1f5f9':'#142c45'} as React.CSSProperties}><h2>Isolated usability preview</h2><p>Fictional entries only. No department records or external requests.</p><nav style={{display:'flex',gap:16,flexWrap:'wrap',marginBottom:24}}><label><input type="checkbox" onChange={e=>setTheme(e.target.checked)}/>Dark preview</label><label><input type="checkbox" onChange={e=>{fail=e.target.checked;}}/>Simulate network failure</label><label><input type="checkbox" onChange={e=>{conflict=e.target.checked;}}/>Simulate competing edit</label><label><input type="checkbox" onChange={e=>{denied=e.target.checked;window.dispatchEvent(new Event('firehouse:permissions-changed'));}}/>Revoke preview access</label></nav><DisciplinaryWorkspace/></main>;}
createRoot(document.getElementById('root')!).render(<Preview/>);
