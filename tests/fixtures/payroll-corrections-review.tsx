import React from 'react';
import {createRoot} from 'react-dom/client';
import PayrollCorrections from '../../app/payroll-corrections';
import '../../app/globals.css';
import '../../app/suite-theme.css';
let saved=false;
window.fetch=async(input,init)=>{
 if(String(input)!=='/api/payroll-corrections'&&!String(input).startsWith('/api/payroll-corrections?'))throw Error('Only fictional correction requests are allowed');
 if(init?.method==='POST'){
  if((document.getElementById('fail-save') as HTMLInputElement).checked)return Response.json({error:'Fictional save failed. Your draft is retained.'},{status:503});
  saved=true;
  return Response.json({ok:true});
 }
 if((document.getElementById('fail-read') as HTMLInputElement)?.checked)return Response.json({error:'Fictional list unavailable.'},{status:503});
 return Response.json({requests:saved?[{id:'fictional',summary:'Fictional member · saved correction request',resolution:null}]:[],canManage:false,canRequest:true});
};
createRoot(document.getElementById('root')!).render(<main style={{maxWidth:800,margin:'20px auto',padding:16}}><h1>Fictional payroll verification</h1><p>No production connection or payroll changes.</p><label><input id="fail-save" type="checkbox"/>Fail save</label><label><input id="fail-read" type="checkbox"/>Fail refresh</label><PayrollCorrections period="2026-11-11" end="2026-11-25" mode="member"/></main>);
