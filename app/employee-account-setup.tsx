'use client';
import { useCallback, useEffect, useState } from 'react';
import { accountStatus, type AccountSetup } from './employee-account-status';
import { employmentStatus } from './employment-status';
export function useEmployeeAccounts(enabled: boolean) {
  const [setup,setSetup]=useState<AccountSetup|null>(null),[error,setError]=useState('');
  const refresh=useCallback(async(signal?:AbortSignal)=>{
    try { const r=await fetch('/api/employee-accounts',{cache:'no-store',signal}); const p=await r.json(); if(!r.ok)throw new Error(p.error);if(!signal?.aborted){setSetup(p);setError('');} }
    catch { if(!signal?.aborted){setSetup(null);setError('Account setup status could not be checked. Retry before assuming someone can sign in.');} }
  },[]);
  useEffect(()=>{if(!enabled)return;const controller=new AbortController();const timer=setTimeout(()=>void refresh(controller.signal),0);return()=>{clearTimeout(timer);controller.abort();};},[enabled,refresh]);
  return {setup,error,refresh};
}
export function EmployeeAccountBadge({ employee, setup }: { employee:{id:string;email?:string|null};setup:AccountSetup|null }) {
  const status=accountStatus(employee,setup);
  return <span className="account-setup-status" title={status.detail}><strong>{status.label}</strong><small>{status.detail}</small></span>;
}
export function EmployeeAccountSetup({ employees, setup, error, refresh, canLink }: {
  employees:Array<{id:string;name:string;active?:number|boolean;startDate?:string|null;endDate?:string|null}>;
  setup:AccountSetup|null;error:string;refresh:()=>Promise<void>;canLink:boolean;
}) {
  const [userId,setUserId]=useState(''),[employeeId,setEmployeeId]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const unlinked=setup?.accounts.filter(a=>a.verified&&!a.employeeId)??[];
  async function link() {
    setBusy(true);setMessage('');
    try {const r=await fetch('/api/employee-accounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId,employeeId})});const p=await r.json();if(!r.ok)throw new Error(p.error);setMessage('Account linked. Personal screens use this employee on their next refresh.');setUserId('');setEmployeeId('');await refresh();}
    catch(e){setMessage(e instanceof Error?e.message:'Account could not be linked.');}finally{setBusy(false);}
  }
  return <section className="content-card account-setup-panel" aria-label="Employee account setup"><div className="section-header"><div><h2>Account setup</h2><p>Invited → Activated → Linked</p><small>Invite records the request. Activation requires verified sign-in and a private PIN. Linked connects that login to the employee’s schedule and timesheet.</small></div><button type="button" className="quiet-button" onClick={()=>void refresh()}>Refresh account status</button></div>
    {error&&<p role="alert">{error}</p>}
    {setup&&<p>{setup.accounts.filter(a=>a.activated&&a.employeeId).length} activated and linked account(s) · {unlinked.length} verified account(s) need an employee link. See each employee’s status below.</p>}
    {!!unlinked.length&&canLink&&<fieldset disabled={busy}><legend>Link an existing verified account</legend><p>Choose the same person in both fields. Work and personal contact emails stay unchanged.</p><div className="employee-fields"><label>Verified account<select value={userId} onChange={e=>setUserId(e.target.value)}><option value="">Select account</option>{unlinked.map(a=><option key={a.id} value={a.id}>{a.email}</option>)}</select></label><label>Employee<select value={employeeId} onChange={e=>setEmployeeId(e.target.value)}><option value="">Select employee</option>{employees.filter(e=>employmentStatus(e)==='Active').map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label></div><button type="button" className="primary-action" disabled={!userId||!employeeId} onClick={()=>void link()}>{busy?'Linking…':'Link account to employee'}</button></fieldset>}
    {message&&<p role="status">{message}</p>}
  </section>;
}
