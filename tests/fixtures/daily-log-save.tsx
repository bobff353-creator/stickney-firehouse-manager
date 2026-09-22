import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import DailyLog from '../../app/daily-log';
import '../../app/globals.css';
import '../../app/mobile-usability.css';
import '../../app/portal-usability.css';
import '../../app/workflow-usability.css';

type Mode = 'success' | 'slow' | 'timeout' | 'failure';
let mode: Mode = 'success';
let posts = 0, version = 0;
let saved: { staffing: unknown[]; calls: unknown[]; shiftNotes: string } | null = null;
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.origin !== location.origin || url.pathname !== '/api/logbook') throw new Error('Unexpected API blocked in isolated fixture');
  if ((init?.method || 'GET') === 'GET') return Response.json({
    log: { logDate: url.searchParams.get('date'), saveVersion: version, locked: 0, adminUnlocked: 0, updatedAt: saved ? new Date().toISOString() : null, shiftNotes: saved?.shiftNotes || '', revisions: [] },
    staffing: saved?.staffing || [{ id: 'fixture-staff', employeeId: 'fixture-member', shiftKey: 'morning', timeIn: '06:00', timeOut: '12:00', actingOfficer: false }],
    calls: saved?.calls || [], schedulePrefilled: !saved, approvals: [], recentNotes: [], addresses: [], apparatusChecks: [], apparatusChecksAvailable: true,
    fleetVerificationAvailable: true, incompleteFleetChecks: [], canUnlock: false,
  });
  const body = JSON.parse(String(init?.body));
  if (body.action && body.action !== 'save') throw new Error('Operational approvals blocked in fixture');
  posts++; window.dispatchEvent(new Event('fixture-request'));
  if (mode === 'timeout') return new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
  if (mode === 'slow') await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 12_000);
    init?.signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });
  if (mode === 'failure') return Response.json({ error: 'Simulated server failure. Draft retained; retry when ready.' }, { status: 500 });
  if (body.expectedVersion !== version) return Response.json({ error: 'Fixture version changed. Reload and review.' }, { status: 409 });
  saved = body; version++;
  return Response.json({ ok: true, saveVersion: version });
};

function Preview() {
  const [selectedMode, setMode] = useState<Mode>('success');
  const [requestCount, setCount] = useState(0);
  React.useEffect(() => { const update = () => setCount(posts); window.addEventListener('fixture-request', update); return () => window.removeEventListener('fixture-request', update); }, []);
  return <main style={{ padding: 16, maxWidth: 1100, margin: 'auto' }}>
    <aside style={{ padding: 12, background: '#fff4c2', color: '#172c40', marginBottom: 16 }}>
      <strong>Fictional local preview — no real log or payroll writes</strong>
      <label style={{ display: 'block' }}>Simulated save behavior <select value={selectedMode} onChange={event => { mode = event.target.value as Mode; setMode(mode); }}>
        <option value="success">Success</option><option value="slow">Slow (12 seconds)</option><option value="timeout">No response (30 seconds)</option><option value="failure">Server failure</option>
      </select></label>
      <output>Save requests: {requestCount}</output>
    </aside>
    <DailyLog employees={[{ id: 'fixture-member', name: 'Example, Member', rank: 'Firefighter' }]} />
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
