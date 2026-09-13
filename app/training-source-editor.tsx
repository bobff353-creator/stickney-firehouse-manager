'use client';
import { useEffect, useRef, useState } from 'react';
import { trainingSources, officialTrainingSource, type TrainingSourceId } from './lib/training-sources';
import type { TrainingProvider } from './lib/external-feeds';
import type { BoardLinksSignal } from './board-links';
import { TrainingClassCards } from './training-class-cards';
import styles from './board-links.module.css';
import trainingStyles from './training-source.module.css';
export default function TrainingSourceEditor({ initial, canEdit, onSaved, onClose, onEditLinks }: { initial: TrainingSourceId; canEdit: boolean; onSaved: (signal: BoardLinksSignal, id: TrainingSourceId) => void; onClose: () => void; onEditLinks: (id: TrainingSourceId) => void }) {
  const dialog = useRef<HTMLDialogElement>(null), controller = useRef<AbortController | null>(null);
  const [id, setId] = useState(initial), [url, setUrl] = useState<string>(trainingSources[initial].sourceUrl);
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [allowed, setAllowed] = useState(true);
  const [preview, setPreview] = useState<{ previewId: string; expiresAt: number; data: TrainingProvider } | null>(null);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
  useEffect(() => { dialog.current?.showModal(); return () => controller.current?.abort(); }, []);
  const editable = canEdit && allowed && !busy;
  function close() { if (!busy && (!preview || confirm('Close without publishing these previewed classes?'))) onClose(); }
  function changeSource(value: TrainingSourceId) {
    if (preview && !confirm('Discard this preview and switch providers?')) return;
    setId(value); setUrl(trainingSources[value].sourceUrl); setPreview(null); setError('');
  }
  async function act(action: 'preview' | 'publish') {
    if (!editable || (action === 'publish' && !preview)) return;
    setError('');
    try { officialTrainingSource(id, url); } catch (reason) { setError((reason as Error).message); return; }
    setBusy(action); controller.current = new AbortController();
    try {
      const response = await fetch('/api/training-import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, action, sourceUrl: url, previewId: preview?.previewId }), signal: AbortSignal.any([controller.current.signal, AbortSignal.timeout(55000)]) });
      const data = await response.json();
      if (response.status === 401 || response.status === 403) setAllowed(false);
      if (!response.ok) throw Error(data.error || 'The request could not be confirmed.');
      if (action === 'preview') { setPreview(data); setUrl(trainingSources[id].sourceUrl); }
      else {
        onSaved(data as BoardLinksSignal, id);
        window.dispatchEvent(new Event('firehouse:board-links-changed'));
        try { const channel = new BroadcastChannel('stickney-board-links'); channel.postMessage('changed'); channel.close(); } catch { /* Existing board refresh remains. */ }
        onClose();
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to confirm the request. Saved classes are unchanged.'); }
    finally { setBusy(''); }
  }
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="training-source-title" onCancel={event => { event.preventDefault(); close(); }}><form onSubmit={event => { event.preventDefault(); void act('publish'); }}>
    <header><div><small>LIVE OPERATIONS · ADMIN</small><h2 id="training-source-title">Manage upcoming classes</h2></div><button type="button" aria-label="Close class editor" onClick={close} disabled={!!busy}>×</button></header>
    <div className={styles.body}>
      <p>Choose the official source → test the class cards → save them to the board. Your existing website shortcuts are kept.</p>
      <fieldset className={`${styles.fields} ${trainingStyles.source}`} disabled={!editable}>
        <label>1 · Training provider<select value={id} onChange={event => changeSource(event.target.value as TrainingSourceId)}>{Object.values(trainingSources).map(source => <option key={source.id} value={source.id}>{source.name}</option>)}</select></label>
        <label>Official schedule link<input type="url" value={url} maxLength={2048} onChange={event => { setUrl(event.target.value); setPreview(null); }}/></label>
        <div className={styles.actions}><button type="button" onClick={() => { setUrl(trainingSources[id].sourceUrl); setPreview(null); }}>Use official site</button><a href={trainingSources[id].sourceUrl} target="_blank" rel="noopener noreferrer">Open official schedule ↗</a></div>
        <button type="button" onClick={() => void act('preview')}>2 · Test & preview classes</button>
      </fieldset>
      <p className={styles.notice}>Automatic updates are already enabled daily at 6:00 a.m. Central. Test checks the official site now; Save publishes the result. Repeated tests reuse a recent preview or wait 10 minutes.</p>
      {busy && <p role="status">{busy === 'preview' ? 'Reading official class dates…' : 'Saving confirmed classes…'}</p>}
      {(!canEdit || !allowed) && <p role="alert">Editing access is not confirmed. Reconnect or sign in before continuing.</p>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {preview && <section className={trainingStyles.preview}><h3>{preview.data.name}</h3><p>Unsaved preview · {preview.data.upcoming.filter(course => course.startDate > today).length} future listings · checked {new Date(preview.data.checkedAt).toLocaleString('en-US', { timeZone: 'America/Chicago' })} Central</p><TrainingClassCards courses={preview.data.upcoming} today={today} limit={8}/>{!preview.data.upcoming.some(course => course.startDate > today) && <p>The recognized schedule has no upcoming dates. Saving will clear the previous class list for this provider.</p>}<p>Showing up to eight cards; the board shows the next five. Only classes starting after today are shown. Verify availability with the provider.</p></section>}
      <div className={styles.actions}><button type="button" disabled={!!busy} onClick={() => { if (!preview || confirm('Discard this class preview and edit website shortcuts?')) onEditLinks(id); }}>Edit website shortcuts instead</button></div>
    </div>
    <footer><span>{preview ? 'Preview only — not yet on the board' : 'Test the source before saving'}</span><button type="button" disabled={!!busy} onClick={close}>Cancel</button><button className={styles.save} type="submit" disabled={!editable || !preview}>3 · Save classes to board</button></footer>
  </form></dialog>;
}
