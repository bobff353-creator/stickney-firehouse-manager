"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { confirmLeavingWork, useUnsavedWork } from "./use-unsaved-work";
type RequestRow = { id: string; summary: string; resolution: string | null };
type CorrectionData = { requests: RequestRow[]; canManage: boolean; canRequest: boolean };
export default function PayrollCorrections({ period, end, mode }: { period: string; end: string; mode: "member" | "manager" }) {
  const [data, setData] = useState<CorrectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [listStale, setListStale] = useState(false);
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [date, setDate] = useState(""), [note, setNote] = useState("");
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const token = useRef(""); const inFlight = useRef(false);
  useUnsavedWork(Boolean(date || note || Object.values(resolutions).some(value => value.trim())), busy);
  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`/api/payroll-corrections?period=${encodeURIComponent(period)}`, { cache: "no-store", signal });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || "Unable to load requests.");
    if (!signal?.aborted) { setData(result); setListStale(false); }
  }, [period]);
  useEffect(() => {
    const controller = new AbortController();
    async function initialLoad() {
      try { await load(controller.signal); }
      catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Unable to load requests."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void initialLoad();
    return () => controller.abort();
  }, [load]);
  async function retry() {
    setLoading(true); setMessage("");
    try { await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load requests."); }
    finally { setLoading(false); }
  }
  async function send(body: Record<string, unknown>) {
    if (inFlight.current) return false;
    inFlight.current = true; setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/payroll-corrections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json(); if (!response.ok) throw Error(result.error || "Save could not be confirmed. Retry with the same details.");
      const savedMessage = body.action === "submit" ? "Correction request saved for payroll review. Your hours have not changed." : "Resolution saved. This action does not change payroll hours.";
      try { await load(); setMessage(savedMessage); }
      catch { setListStale(true); setMessage(`${savedMessage} The list could not refresh. Retry loading requests to see the saved result.`); }
      return true;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to confirm save. Please retry."); return false; }
    finally { setBusy(false); inFlight.current = false; }
  }
  return <section className="content-card correction-requests"><h2>{mode === "manager" ? "Timesheet correction requests" : "Need a timesheet correction?"}</h2>
    <p>Requests are saved for payroll administrators to review in Payroll. No hours change automatically.</p>
    {message && <p role="status">{message}</p>}
    {loading && <p role="status">Loading correction requests…</p>}
    {!loading && <button type="button" disabled={busy} onClick={() => void retry()}>{data ? "Refresh correction requests" : "Retry loading requests"}</button>}
    {mode === "member" && data?.canRequest && <button type="button" disabled={busy} onClick={() => { if (open && (date || note) && !confirmLeavingWork()) return; setOpen(!open); if (open) { setDate(""); setNote(""); token.current = ""; } }} aria-expanded={open}>{open ? "Cancel correction request" : "Request correction"}</button>}
    {open && <form onSubmit={event => { event.preventDefault(); token.current ||= crypto.randomUUID(); void send({ action: "submit", period, date, note, token: token.current }).then(saved => { if (saved) { token.current = ""; setDate(""); setNote(""); setOpen(false); } }); }}>
      <label>Work date<input type="date" name="date" min={period} max={end} value={date} onChange={event => setDate(event.target.value)} required disabled={busy} /></label>
      <label>What needs correcting?<textarea name="note" value={note} onChange={event => setNote(event.target.value)} required maxLength={1500} rows={3} disabled={busy} placeholder="Which hours or category are incorrect, and what should they be?" /></label>
      <button disabled={busy}>{busy ? "Saving…" : "Send correction request"}</button>
    </form>}
    {listStale && <p role="status">The list below was received before your saved change. Refresh correction requests to verify its current contents.</p>}
    {data && !listStale && data.requests.length === 0 && <p>No correction requests for this period.</p>}
    {data?.requests.map(item => <article key={item.id}><strong>{item.resolution ? "Resolved" : "Awaiting payroll review"}</strong><p style={{ whiteSpace: "pre-wrap" }}>{item.summary}</p>{item.resolution && <p>Resolution: {item.resolution}</p>}
      {mode === "manager" && data.canManage && !listStale && !item.resolution && <form onSubmit={event => { event.preventDefault(); void send({ action: "resolve", id: item.id, note: resolutions[item.id] || "" }).then(saved => { if (saved) setResolutions(current => { const next = { ...current }; delete next[item.id]; return next; }); }); }}><label>Resolution note<textarea name="note" value={resolutions[item.id] || ""} onChange={event => setResolutions(current => ({ ...current, [item.id]: event.target.value }))} required disabled={busy} maxLength={1500} rows={2} placeholder="Document the verified correction, or explain why no change was needed." /></label><button disabled={busy}>Record resolution</button></form>}
    </article>)}
  </section>;
}
