"use client";
import { useCallback, useEffect, useRef, useState } from "react";
type RequestRow = {id:string;summary:string;resolution:string|null};
export default function PayrollCorrections({period,end,mode}:{period:string;end:string;mode:"member"|"manager"}) {
  const [data,setData] = useState<{requests:RequestRow[];canManage:boolean;canRequest:boolean}|null>(null);
  const [open,setOpen] = useState(false), [busy,setBusy] = useState(false), [message,setMessage] = useState("");
  const token = useRef(""); const inFlight = useRef(false);
  const load = useCallback(async()=>{
    const response = await fetch(`/api/payroll-corrections?period=${encodeURIComponent(period)}`,{cache:"no-store"});
    const result = await response.json(); if (!response.ok) throw Error(result.error || "Unable to load requests."); setData(result);
  },[period]);
  useEffect(()=>{void load().catch(error=>setMessage(error.message));},[load]);
  async function send(body: Record<string,unknown>) {
    if (inFlight.current) return false;
    inFlight.current=true; setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/payroll-corrections",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
      const result = await response.json(); if (!response.ok) throw Error(result.error);
      await load(); setMessage(body.action === "submit" ? "Correction request saved for payroll review. Your hours have not changed." : "Resolution saved. This action does not change payroll hours."); return true;
    } catch(error) {setMessage(error instanceof Error?error.message:"Unable to confirm save. Please retry.");return false;}
    finally {setBusy(false);inFlight.current=false;}
  }
  return <section className="content-card correction-requests"><h2>{mode === "manager" ? "Timesheet correction requests" : "Need a timesheet correction?"}</h2>
    <p>Requests are saved for payroll administrators to review in Payroll. No hours change automatically.</p>
    {message && <p role="status">{message}</p>}
    {!data && <button type="button" onClick={()=>void load().catch(error=>setMessage(error.message))}>Retry loading requests</button>}
    {mode === "member" && data?.canRequest && <button type="button" disabled={busy} onClick={()=>setOpen(!open)} aria-expanded={open}>Request correction</button>}
    {open && <form onSubmit={event=>{event.preventDefault();const form=event.currentTarget;const fields=new FormData(form);token.current ||= crypto.randomUUID();void send({action:"submit",period,date:fields.get("date"),note:fields.get("note"),token:token.current}).then(saved=>{if(saved){token.current="";form.reset();setOpen(false);}});}}>
      <label>Work date<input type="date" name="date" min={period} max={end} required disabled={busy}/></label>
      <label>What needs correcting?<textarea name="note" required maxLength={1500} rows={3} disabled={busy} placeholder="Which hours or category are incorrect, and what should they be?"/></label>
      <button disabled={busy}>{busy?"Saving…":"Send correction request"}</button>
    </form>}
    {data && data.requests.length===0 && <p>No correction requests for this period.</p>}
    {data?.requests.map(item=><article key={item.id}><strong>{item.resolution?"Resolved":"Awaiting payroll review"}</strong><p style={{whiteSpace:"pre-wrap"}}>{item.summary}</p>{item.resolution && <p>Resolution: {item.resolution}</p>}
      {mode === "manager" && data.canManage && !item.resolution && <form onSubmit={event=>{event.preventDefault();void send({action:"resolve",id:item.id,note:new FormData(event.currentTarget).get("note")});}}><label>Resolution note<textarea name="note" required maxLength={1500} rows={2} placeholder="Document the verified correction, or explain why no change was needed."/></label><button disabled={busy}>Record resolution</button></form>}
    </article>)}
  </section>;
}
