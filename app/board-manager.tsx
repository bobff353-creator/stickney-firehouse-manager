'use client';
import { useEffect, useRef, useState } from 'react';
import { boardSlides, validateBoardConfiguration, type BoardConfiguration, type SavedBoardConfiguration } from './board-configuration';
import styles from './board-manager.module.css';

function localInput(value: string) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function isoInput(value: string) { return value ? new Date(value).toISOString() : ''; }
export default function BoardManager({ onClose, onPreview, previewing, onPublished, onContent }: {
  onClose: () => void; onPreview: (config: BoardConfiguration | null) => void; previewing: boolean;
  onPublished: (saved: SavedBoardConfiguration) => void; onContent: (kind: 'links' | 'classes' | 'notes') => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [saved, setSaved] = useState<SavedBoardConfiguration | null>(null);
  const [draft, setDraft] = useState<BoardConfiguration | null>(null);
  const [tab, setTab] = useState('layout');
  const [message, setMessage] = useState('Loading saved settings…');
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const dirty = Boolean(saved && draft && JSON.stringify(saved.configuration) !== JSON.stringify(draft));
  useEffect(() => { if (previewing) dialog.current?.close(); else dialog.current?.showModal(); }, [previewing]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/board-configuration', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Unable to load settings.');
      setSaved(result.saved); setDraft(result.saved.configuration); setMessage('Saved settings loaded. Nothing changes until you publish.');
    }).catch(error => { if (!controller.signal.aborted) setMessage(error.message); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);
  function change(value: BoardConfiguration) { setDraft(value); setReviewed(false); setMessage('Unsaved changes — preview, then publish to all Live Ops boards.'); }
  function close() { if (busy || (dirty && !window.confirm('Discard these unpublished board changes?'))) return; onPreview(null); onClose(); }
  async function reload() {
    if (dirty && !window.confirm('Replace your unpublished draft with the saved settings?')) return;
    setBusy(true);
    try {
      const response = await fetch('/api/board-configuration', { cache: 'no-store', signal: AbortSignal.timeout(15000) }); const result = await response.json();
      if (!response.ok) throw Error(result.error);
      setSaved(result.saved); setDraft(result.saved.configuration); setConflict(false); setReviewed(false); setMessage('Saved settings reloaded.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Reload failed. Your draft is kept.'); } finally { setBusy(false); }
  }
  function preview() {
    try { const valid = validateBoardConfiguration(draft); setReviewed(true); onPreview(valid); }
    catch (error) { setMessage((error as Error).message); }
  }
  async function publish() {
    if (!saved || !draft || busy || conflict || !reviewed) return;
    setBusy(true); setMessage('Publishing…');
    try {
      const configuration = validateBoardConfiguration(draft);
      const response = await fetch('/api/board-configuration', { method: 'PUT', signal: AbortSignal.timeout(15000), headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision: saved.revision, configuration }) });
      const result = await response.json();
      if (!response.ok) { setConflict(response.status === 409 || response.status === 403); throw Error(result.error); }
      setSaved(result.saved); setDraft(result.saved.configuration); onPublished(result.saved);
      window.dispatchEvent(new Event('firehouse:board-links-changed'));
      try { const channel = new BroadcastChannel('stickney-board-links'); channel.postMessage('changed'); channel.close(); } catch { /* Existing change feed and reconciliation remain available. */ }
      setMessage('Published. Connected boards receive the change; disconnected boards catch up when they reconnect.');
    } catch (error) { setMessage(error instanceof Error && !['TimeoutError', 'TypeError'].includes(error.name) ? error.message : 'Publishing could not be confirmed. Your draft is kept. Retry or reload saved settings.'); } finally { setBusy(false); }
  }
  function move(index: number, direction: number) {
    if (!draft) return;
    const slides = [...draft.slides]; [slides[index], slides[index + direction]] = [slides[index + direction], slides[index]]; change({ ...draft, slides });
  }
  return <>
    {previewing && <aside className={styles.previewBar}><strong>Unpublished preview · this screen only</strong><span>Scheduled announcements appear only during their display window.</span><button onClick={() => onPreview(null)}>Back to board setup</button></aside>}
    <dialog ref={dialog} className={styles.manager} aria-labelledby="board-manager-title" onCancel={event => { event.preventDefault(); close(); }}>
      <header><div><small>ADMINISTRATOR · LIVE OPERATIONS</small><h1 id="board-manager-title">Manage Live Ops Board</h1><p>One shared setup for your station TVs. No changes to Respond apparatus filters.</p></div><button aria-label="Close board setup" disabled={busy} onClick={close}>×</button></header>
      <nav aria-label="Board setup"><button aria-pressed={tab === 'layout'} onClick={() => setTab('layout')}>1. Layout & rotation</button><button aria-pressed={tab === 'announcement'} onClick={() => setTab('announcement')}>2. Announcement</button><button aria-pressed={tab === 'content'} onClick={() => setTab('content')}>Content & device setup</button></nav>
      <div className={styles.body}>
        <p className={styles.protected}>Always protected: active calls, staffing, officer in charge, apparatus status, road closures and delayed-data warnings. New calls still open Respond for 90 seconds.</p>
        {draft && <fieldset disabled={busy}>
          {tab === 'layout' && <section><h2>What plays on the information panel?</h2><p>Move sections up or down, choose their display time, or turn off optional rotations. All TVs use the same clock; changing slides does not download the data again.</p>
            <ol className={styles.slides}>{draft.slides.map((slide, index) => { const label = boardSlides.find(item => item.id === slide.id)!.label; return <li key={slide.id}>
              <label><input type="checkbox" checked={slide.enabled} onChange={event => change({ ...draft, slides: draft.slides.map(item => item.id === slide.id ? { ...item, enabled: event.target.checked } : item) })}/><strong>{label}</strong></label>
              <label>Seconds<input aria-label={`${label} seconds`} type="number" min={8} max={60} value={slide.seconds} onChange={event => change({ ...draft, slides: draft.slides.map(item => item.id === slide.id ? { ...item, seconds: Number(event.target.value) } : item) })}/></label>
              <div><button aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button aria-label={`Move ${label} down`} disabled={index === draft.slides.length - 1} onClick={() => move(index, 1)}>↓</button></div>
            </li>; })}</ol>
            <label>Close Calls per slide<select value={draft.closeCalls} onChange={event => change({ ...draft, closeCalls: event.target.value as BoardConfiguration['closeCalls'] })}><option value="auto">3, or 4 when the screen has room</option><option value="3">3 — more room for descriptions</option></select></label>
            <button disabled={!saved?.previous} onClick={() => { if (saved?.previous) change(saved.previous); }}>Load previous published setup as draft</button><p>Restoring still requires preview and publish. It does not remove notes, classes or operational records.</p>
          </section>}
          {tab === 'announcement' && <section><h2>A short notice for every Live Ops board</h2><p>For routine department information, not dispatch. This does not send push notifications, invitations, or mark anything acknowledged.</p>
            <label><input type="checkbox" checked={draft.announcement.enabled} onChange={event => change({ ...draft, announcement: { ...draft.announcement, enabled: event.target.checked } })}/> Show this announcement</label>
            <label>Headline<input maxLength={80} value={draft.announcement.title} onChange={event => change({ ...draft, announcement: { ...draft.announcement, title: event.target.value } })}/></label>
            <label>Brief message<textarea maxLength={240} rows={3} value={draft.announcement.body} onChange={event => change({ ...draft, announcement: { ...draft.announcement, body: event.target.value } })}/><small>{draft.announcement.body.length}/240 characters</small></label>
            <div className={styles.dates}><label>Start (blank = now)<input type="datetime-local" value={localInput(draft.announcement.startsAt)} onChange={event => change({ ...draft, announcement: { ...draft.announcement, startsAt: isoInput(event.target.value) } })}/></label><label>End (required when enabled)<input type="datetime-local" value={localInput(draft.announcement.endsAt)} onChange={event => change({ ...draft, announcement: { ...draft.announcement, endsAt: isoInput(event.target.value) } })}/></label></div>
            <p>Times use this device’s time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. The notice disappears automatically at its end time.</p>
            <article className={styles.noticePreview}><small>MESSAGE PREVIEW · NOT PUBLISHED</small><h3>{draft.announcement.title || 'Your headline'}</h3><p>{draft.announcement.body || 'Keep the notice brief and readable from across the room.'}</p></article>
          </section>}
          {tab === 'content' && <section><h2>Edit the source, once</h2><p>These open the existing editors. Each has its own save action; they are separate from the layout draft.</p><div className={styles.tools}>{(['notes','classes','links'] as const).map(kind => <button key={kind} onClick={() => { if (!dirty || window.confirm('Leave setup and discard unpublished layout changes?')) { onPreview(null); onContent(kind); } }}>{kind === 'notes' ? 'Officer notes & events' : kind === 'classes' ? 'Manage training classes' : 'News & training links'}</button>)}</div>
            <h2>Set up each TV or apparatus browser</h2><p>Open <strong>Respond Device Modes</strong> on that device. Choose its name and apparatus filter there. Then open Live Operations and select TV full screen. Call sound must be enabled on each TV.</p><a href="/?page=respond-device-modes&display=portal" onClick={event => { if (dirty && !window.confirm('Leave setup and discard unpublished layout changes?')) event.preventDefault(); }}>Set up this browser →</a><p>Remote device health and remote reload are not connected. This screen cannot confirm that a physical TV is powered on.</p>
          </section>}
        </fieldset>}
      </div>
      <footer><div role="status" aria-live="polite">{message}</div><div><button disabled={busy} onClick={() => void reload()}>Reload saved settings</button><button disabled={!draft || busy} onClick={preview}>Preview on this screen</button><button className={styles.primary} disabled={!dirty || !reviewed || busy || conflict} onClick={() => void publish()}>{busy ? 'Please wait…' : 'Publish to all boards'}</button></div></footer>
    </dialog>
  </>;
}
