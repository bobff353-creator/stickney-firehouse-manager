'use client';
import { useEffect, useRef, useState } from 'react';
import { boardLinkSections, defaultBoardLinks, maxBoardLinks, safeBoardLinkUrl, validateBoardLinkSection, type BoardLinks, type BoardLinksSignal, type BoardLinkSection, type BoardLinkSectionId } from './board-links';
import styles from './board-links.module.css';

export function BoardSectionLinks({ section, confirmed }: { section: BoardLinkSection; confirmed: boolean }) {
  return <section className={styles.links} aria-label="Department links">
    <strong>Department links</strong>
    {!confirmed && <small role="status">Saved links not confirmed · reconnect to check for changes.</small>}
    {section.links.map(link => <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"><span>{link.label}{link.note && <small>{link.note}</small>}</span><b aria-hidden="true">↗</b></a>)}
    {!section.links.length && <small>No department links added to this section.</small>}
  </section>;
}

export default function BoardLinksEditor({ initialSection, canEdit, onSaved, onClose }: {
  initialSection: BoardLinkSectionId; canEdit: boolean; onSaved: (signal: BoardLinksSignal, section: BoardLinkSectionId) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef<AbortController | null>(null);
  const [saved, setSaved] = useState<BoardLinks | null>(null);
  const [sectionId, setSectionId] = useState(initialSection);
  const [draft, setDraft] = useState<BoardLinkSection>(defaultBoardLinks().sections[initialSection]);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState(''), [preview, setPreview] = useState(false);
  const [allowed, setAllowed] = useState(canEdit);
  const dirty = !!saved && JSON.stringify(draft) !== JSON.stringify(saved.sections[sectionId]);
  useEffect(() => { dialog.current?.showModal(); return () => request.current?.abort(); }, []);
  useEffect(() => {
    const controller = new AbortController(); request.current = controller;
    fetch('/api/board-links', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }).then(async response => {
      const result = await response.json() as BoardLinksSignal & { error?: string };
      if (!response.ok || !result.settings) throw new Error(result.error || 'Unable to load saved links.');
      if (controller.signal.aborted) return;
      setSaved(result.settings); setDraft(result.settings.sections[initialSection]); setAllowed(result.canEdit);
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Unable to load saved links.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [initialSection]);
  function close() { if (!saving && (!dirty || window.confirm('Discard your unsaved link changes?'))) onClose(); }
  function chooseSection(id: BoardLinkSectionId) {
    if (!saved || (dirty && !window.confirm('Discard your unsaved changes before switching sections?'))) return;
    setSectionId(id); setDraft(saved.sections[id]); setError(''); setPreview(false);
  }
  async function reload() {
    if (dirty && !window.confirm('Replace your draft with the latest saved links?')) return;
    setLoading(true); setError('');
    const controller = new AbortController(); request.current?.abort(); request.current = controller;
    try {
      const response = await fetch('/api/board-links', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      const result = await response.json() as BoardLinksSignal & { error?: string };
      if (!response.ok || !result.settings) throw new Error(result.error || 'Unable to reload saved links.');
      setSaved(result.settings); setDraft(result.settings.sections[sectionId]); setAllowed(result.canEdit);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to reload saved links.'); }
    finally { setLoading(false); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!saved || saving || !canEdit || !allowed) return;
    setError('');
    let section: BoardLinkSection;
    try { section = validateBoardLinkSection(draft); } catch (reason) { setError((reason as Error).message); return; }
    setSaving(true);
    const controller = new AbortController(); request.current = controller;
    try {
      const response = await fetch('/api/board-links', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: sectionId, revision: saved.revision, section }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      const result = await response.json() as BoardLinksSignal & { error?: string };
      if (response.status === 401 || response.status === 403) setAllowed(false);
      if (!response.ok || !result.settings) throw new Error(result.error || 'The save could not be confirmed. Reload saved links before retrying.');
      onSaved(result, sectionId);
      window.dispatchEvent(new Event('firehouse:board-links-changed'));
      try { const channel = new BroadcastChannel('stickney-board-links'); channel.postMessage('changed'); channel.close(); } catch { /* Board refresh is the fallback. */ }
      onClose();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to confirm the save. Your draft is still here.'); }
    finally { setSaving(false); }
  }
  const editable = canEdit && allowed && !loading && !saving;
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="board-links-title" onCancel={event => { event.preventDefault(); close(); }}>
    <form onSubmit={save}>
      <header><div><small>LIVE OPERATIONS · ADMIN</small><h2 id="board-links-title">Edit news & training links</h2></div><button type="button" onClick={close} disabled={saving} aria-label="Close link editor">×</button></header>
      <div className={styles.body}>
        <p>Add, change or remove the website links members see. Nothing changes until you select <b>Save links</b>.</p>
        <label>Section to edit<select value={sectionId} disabled={!editable || !saved} onChange={event => chooseSection(event.target.value as BoardLinkSectionId)}>{boardLinkSections.map(section => <option key={section.id} value={section.id}>{section.label}</option>)}</select></label>
        <p className={styles.notice}>Automatic reports and class listings keep their existing sources and refresh schedule. These are website shortcuts, not new automatic feeds.</p>
        {loading && <p role="status">Loading saved links…</p>}
        {(!canEdit || !allowed) && <p role="alert">Editing access is not confirmed. Your draft is preserved; restore access before saving.</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.actions}><button type="button" onClick={() => setPreview(value => !value)} disabled={loading}>{preview ? 'Back to editing' : 'Preview member view'}</button><button type="button" onClick={() => void reload()} disabled={loading || saving}>Reload saved links</button></div>
        {preview ? <section className={styles.preview}><small>UNSAVED PREVIEW · Department links only</small><h3>{draft.title}</h3><BoardSectionLinks section={{ ...draft, links: draft.links.filter(link => { try { safeBoardLinkUrl(link.url); return true; } catch { return false; } }) }} confirmed/><p>Automatic feed content is unchanged. Incomplete website addresses are omitted from this preview.</p></section> : <fieldset disabled={!editable} className={styles.fields}>
          <label>Section heading<input value={draft.title} maxLength={100} required onChange={event => setDraft({ ...draft, title: event.target.value })}/></label>
          {draft.links.map((link, index) => <fieldset key={link.id} className={styles.linkCard}><legend>Link {index + 1}</legend>
            <label>Link label<input value={link.label} maxLength={120} required placeholder="What members will open" onChange={event => setDraft({ ...draft, links: draft.links.map(item => item.id === link.id ? { ...item, label: event.target.value } : item) })}/></label>
            <label>Website address<input type="url" value={link.url} maxLength={2048} required placeholder="https://" onChange={event => setDraft({ ...draft, links: draft.links.map(item => item.id === link.id ? { ...item, url: event.target.value } : item) })}/></label>
            <label>Description (optional)<input value={link.note} maxLength={240} placeholder="Why this link is useful" onChange={event => setDraft({ ...draft, links: draft.links.map(item => item.id === link.id ? { ...item, note: event.target.value } : item) })}/></label>
            <button type="button" className={styles.remove} onClick={() => setDraft({ ...draft, links: draft.links.filter(item => item.id !== link.id) })}>Remove link {index + 1}</button>
          </fieldset>)}
          <div className={styles.actions}><button type="button" disabled={draft.links.length >= maxBoardLinks} onClick={() => setDraft({ ...draft, links: [...draft.links, { id: crypto.randomUUID(), label: '', url: '', note: '' }] })}>+ Add link</button><button type="button" onClick={() => { if (window.confirm('Restore the original heading and link in this draft? This takes effect only after Save links.')) setDraft(defaultBoardLinks().sections[sectionId]); }}>Restore default link</button></div>
          <small>{draft.links.length} of {maxBoardLinks} links · removals take effect only after Save links.</small>
        </fieldset>}
      </div>
      <footer><span>{dirty ? 'Unsaved changes' : 'No unsaved changes'}</span><button type="button" onClick={close} disabled={saving}>Cancel</button><button type="submit" className={styles.save} disabled={!editable || !saved || !dirty}>{saving ? 'Saving…' : 'Save links'}</button></footer>
    </form>
  </dialog>;
}
