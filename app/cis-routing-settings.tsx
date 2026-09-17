'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { CisSettings } from './cis-cad-routing';
import styles from './cis-routing.module.css';

export default function CisRoutingSettings({ saved, fleet, secretConfigured, onSaved }: { saved: CisSettings; fleet: Array<{ unitNumber: string; name: string }>; secretConfigured: boolean; onSaved: () => void }) {
  const [draft, setDraft] = useState(saved);
  const [agencies, setAgencies] = useState(saved.agencies.join(', '));
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function save() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/cad/cis', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: { ...draft, agencies: agencies.split(/[,\n]+/).map(value => value.trim()).filter(Boolean) }, confirmLive: confirmed }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Save could not be confirmed.');
      setDraft(result.settings); setConfirmed(false); setMessage('Routing settings saved.'); onSaved();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Settings were not saved.'); }
    finally { setBusy(false); }
  }
  return <section className={`content-card ${styles.settings}`}>
    <h2>1. Approve department and apparatus routing</h2>
    <p>Live Operations receives every approved department incident, including EMS and mutual aid outside town. Respond receives only calls assigned to this device’s mapped apparatus. Unknown unit names are never guessed.</p>
    <label>Approved CIS agency identifiers <input value={agencies} onChange={event => setAgencies(event.target.value)} placeholder="Exact identifiers supplied by dispatch, separated by commas" disabled={busy} /></label>
    <p>Use the department agency identifier from the vendor message—not the incident’s city. No agencies or unit mappings are pre-approved.</p>
    <div className={styles.mappings}>{draft.units.map((row, index) => <fieldset key={index} disabled={busy}><legend>Unit mapping {index + 1}</legend>
      <label>CIS agency <input value={row.agency} onChange={event => setDraft({ ...draft, units: draft.units.map((unit, i) => i === index ? { ...unit, agency: event.target.value } : unit) })} /></label>
      <label>Exact CIS unit name <input value={row.external} onChange={event => setDraft({ ...draft, units: draft.units.map((unit, i) => i === index ? { ...unit, external: event.target.value } : unit) })} /></label>
      <label>Fleet apparatus <select value={row.apparatus} onChange={event => setDraft({ ...draft, units: draft.units.map((unit, i) => i === index ? { ...unit, apparatus: event.target.value } : unit) })}><option value="">Select apparatus</option>{fleet.map(unit => <option key={unit.unitNumber} value={unit.unitNumber}>{unit.unitNumber} · {unit.name}</option>)}</select></label>
      <button type="button" className="quiet-button" onClick={() => setDraft({ ...draft, units: draft.units.filter((_, i) => i !== index) })}>Remove mapping {index + 1}</button>
    </fieldset>)}</div>
    <button className="quiet-button" disabled={busy || draft.units.length >= 100} onClick={() => setDraft({ ...draft, units: [...draft.units, { agency: '', external: '', apparatus: '' }] })}>+ Add approved unit mapping</button>
    <h2>2. Choose how CIS deliveries are handled</h2>
    <label>Delivery mode <select value={draft.mode} disabled={busy} onChange={event => { setDraft({ ...draft, mode: event.target.value as CisSettings['mode'] }); setConfirmed(false); }}>
      <option value="disabled">Disabled — keep the current CAD-email feed</option>
      <option value="shadow">Shadow test — receipts only, no live calls or notifications</option>
      <option value="live" disabled={!secretConfigured}>Live — update department calls and send notifications</option>
    </select></label>
    {draft.mode === 'shadow' && <p>Signed deliveries exercise the same parser, routing, duplicate and event-order checks in a separate test state. They do not touch dispatch records, Daily Log, board call alerts or the push outbox.</p>}
    {draft.mode === 'live' && <label className={styles.confirm}><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />I have confirmed the vendor contract, approved the agency/unit mappings, and tested new, partial update, unit clear, duplicate and incident close deliveries. Enable live operational writes.</label>}
    {!secretConfigured && <p>The hosted webhook secret is not configured. Live delivery cannot be enabled.</p>}
    <div><button className="primary-action" onClick={() => void save()} disabled={busy || (draft.mode === 'live' && !confirmed)}>{busy ? 'Saving…' : 'Save routing settings'}</button> <Link href="/?page=respond-device-modes&display=portal">Then assign this device to its apparatus →</Link></div>
    <p role="status">{message}</p>
    <p>Saving settings does not certify a live CIS connection. Vendor delivery and end-to-end verification must still be completed.</p>
  </section>;
}
