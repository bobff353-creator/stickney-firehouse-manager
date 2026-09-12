"use client";
import { useEffect, useState } from 'react';
import type { ConfirmationStatus } from './required-confirmation-policy';
import { permissionsChanged, refreshPermissions } from './use-permissions';
import './required-confirmation.css';
type Message = { version: string | null; title: string; message: string; enabled: boolean };

export function RequiredConfirmation({ status }: { status?: ConfirmationStatus | null }) {
  const [loadedMessage,setMessage]=useState<Message|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reload,setReload]=useState(0);
  const message=status?.required && loadedMessage?.version===status.version ? loadedMessage : null;
  useEffect(()=>{
    const controller=new AbortController();
    if (!status?.required) return ()=>controller.abort();
    void fetch('/api/required-confirmation',{cache:'no-store',signal:controller.signal}).then(async response=>{
      const data=await response.json();
      if (!response.ok) throw Error(data.error || 'Unable to load the message.');
      if (!data.enabled || data.version!==status.version) { void refreshPermissions(); throw Error('The message changed. Reload it before confirming.'); }
      if (!controller.signal.aborted) { setMessage(data);setError(''); }
    }).catch(error=>{if(!controller.signal.aborted)setError(error instanceof Error?error.message:'Unable to load the message.');});
    return ()=>controller.abort();
  },[status?.required,status?.version,reload]);
  async function confirm() {
    if (!message || busy) return;
    setBusy(true);setError('');
    try {
      const response=await fetch('/api/required-confirmation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:message.version,confirmed:true})});
      const result=await response.json();
      if (!response.ok) throw Error(result.error || 'Confirmation was not saved.');
      await permissionsChanged();
    } catch(error) {setError(error instanceof Error?error.message:'Your confirmation was not saved. Try again.');}
    finally {setBusy(false);}
  }
  return <section className="required-confirmation-card" aria-labelledby="required-confirmation-title">
    <span className="eyebrow">Before you continue</span><h1 id="required-confirmation-title">{message?.title || 'Department confirmation'}</h1>
    {message ? <><div className="required-confirmation-message">{message.message}</div><p>Confirm that you have read this message to open regular portal tools.</p><button className="primary-action" disabled={busy} onClick={()=>void confirm()}>{busy?'Saving confirmation…':'I confirm — continue'}</button></> : <p role="status">{status?.required?'Loading the required message…':'Your confirmation status could not be verified.'}</p>}
    {error && <p role="alert">{error}</p>}
    {(error || !message) && <button disabled={busy} onClick={()=>{setMessage(null);setError('');setReload(value=>value+1);void refreshPermissions();}}>Reload message</button>}
    <p className="muted">Emergency-call screens remain available. Confirmation is recorded for your account and this version of the message.</p>
  </section>;
}

export function RequiredConfirmationAdmin() {
  const [draft,setDraft]=useState<Message|null>(null),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[preview,setPreview]=useState(false),[reload,setReload]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    void fetch('/api/required-confirmation',{cache:'no-store',signal:controller.signal}).then(async response=>{
      const data=await response.json();if(!response.ok)throw Error(data.error);
      setDraft({version:data.version??null,title:data.title||'Department confirmation',message:data.message||'',enabled:Boolean(data.enabled)});
    }).catch(error=>{if(!controller.signal.aborted)setNotice(error instanceof Error?error.message:'Unable to load confirmation settings.');});
    return ()=>controller.abort();
  },[reload]);
  async function save() {
    if (!draft || busy) return;setBusy(true);setNotice('');
    try {
      const response=await fetch('/api/required-confirmation',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)});
      const data=await response.json();if(!response.ok)throw Error(data.error);
      setDraft({...draft,version:data.version});setNotice(draft.enabled?'Saved. Members must confirm this message before using regular tools.':'Saved. Required confirmation is off.');
      await permissionsChanged();
    }catch(error){setNotice(error instanceof Error?error.message:'Not saved. Your edits remain here.');}finally{setBusy(false);}
  }
  return <section className="required-confirmation-admin"><h3>Required member confirmation</h3>
    <p>Show one message after sign-in. A member confirms it once per saved version. Changing the message or turning it back on requires a new confirmation.</p>
    <p>Portal administrators remain able to edit settings. Respond, incoming calls and Live Operations keep their existing access and are not blocked.</p>
    {draft && <fieldset disabled={busy}><label className="required-confirmation-toggle"><input type="checkbox" checked={draft.enabled} onChange={event=>setDraft({...draft,enabled:event.target.checked})} />Require members to confirm before using regular tools</label>
      <label>Message title<input maxLength={120} value={draft.title} onChange={event=>setDraft({...draft,title:event.target.value})} /></label>
      <label>Message members must read<textarea rows={7} maxLength={4000} value={draft.message} onChange={event=>setDraft({...draft,message:event.target.value})} /></label>
      <div className="row-actions"><button disabled={!draft.title.trim() || (draft.enabled&&!draft.message.trim())} onClick={()=>void save()}>Save confirmation settings</button><button className="link" onClick={()=>setPreview(!preview)}>{preview?'Close member preview':'Preview as member'}</button></div>
    </fieldset>}
    {preview && draft && <section className="required-confirmation-card"><strong>Preview only — nothing is confirmed or sent</strong><h2>{draft.title}</h2><div className="required-confirmation-message">{draft.message||'Enter the message above.'}</div><button onClick={()=>setPreview(false)}>I confirm — close preview</button></section>}
    {notice && <p role="status">{notice}</p>}<button className="link" disabled={busy} onClick={()=>{if(!draft || window.confirm('Reload the saved message and discard any unsaved edits?')){setReload(value=>value+1);setNotice('');}}}>Reload saved settings</button>
  </section>;
}
