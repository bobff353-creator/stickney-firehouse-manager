'use client';
import { useState } from 'react';
import { synchronizedSlide } from './board-sync-clock';
import { formatMilitaryTime } from './military-time';
import styles from './board-active-calls.module.css';
type Call = { reportNumber: string; callType: string; address: string; respondingUnits: string; timeOut: string; narrative?: string; source?: string };
export default function BoardActiveCalls({ calls, tvMode, now, confirmed = true }: { calls: Call[]; tvMode: boolean; now: number; confirmed?: boolean }) {
  const [selected, setSelected] = useState('');
  const index = tvMode ? synchronizedSlide(now, 12_000, calls.length) : Math.max(0, calls.findIndex(call => call.reportNumber === selected));
  const call = calls[index];
  if (!confirmed) return <article className={`active-call-summary ${styles.summary} warning`}><span>Active calls</span><strong>Not confirmed</strong><small>Waiting for a successful call update</small></article>;
  return <article className={`active-call-summary ${styles.summary} ${call ? 'active' : 'clear'}`}>
    <span>{calls.length ? `Active call ${index + 1} of ${calls.length}${tvMode && calls.length > 1 ? ' · rotating' : ''}` : 'Active call'}</span>
    {!tvMode && calls.length > 1 && <label className={styles.selector}>Select department call<select value={call.reportNumber} onChange={event => setSelected(event.target.value)}>{calls.map(item => <option key={item.reportNumber} value={item.reportNumber}>{item.reportNumber} · {item.callType} · {item.address}</option>)}</select></label>}
    {call ? <><strong>{call.callType}</strong><b>{call.address || 'Address not entered'}</b>{!tvMode && call.narrative && <em>{call.narrative}</em>}<small>{call.respondingUnits || 'Units pending / not mapped'} · {call.timeOut ? formatMilitaryTime(call.timeOut) : 'Time pending'}</small>{!tvMode && <a href={`/?page=respond&display=portal&report=${encodeURIComponent(call.reportNumber)}`}>Open this call in Respond →</a>}</> : <><strong>None</strong><small>No open calls</small></>}
  </article>;
}
