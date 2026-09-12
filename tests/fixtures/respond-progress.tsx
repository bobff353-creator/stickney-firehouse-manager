import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Respond from '../../app/respond';
import '../../app/globals.css';
import '../../app/mobile-usability.css';
import '../../app/portal-usability.css';

const params = new URLSearchParams(location.search);
const audit = { errors: [] as string[], requests: [] as string[], writes: 0, reportNumber: 'FIXTURE-100', departmentId: 'fixture-a', assigned: '1204, 1205', failed: false, noCall: false, hold: false, pending: null as null | (() => void) };
Object.assign(window, { progressAudit: audit });
window.addEventListener('error', event => audit.errors.push(event.message));
window.addEventListener('unhandledrejection', event => audit.errors.push(String(event.reason)));
const originalSet = Storage.prototype.setItem;
Object.assign(audit, { failStorage(fail: boolean) { Storage.prototype.setItem = fail ? function () { throw new Error('Simulated unavailable storage'); } : originalSet; } });
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.origin !== location.origin) throw new Error('External traffic blocked in fixture');
  audit.requests.push(url.pathname + url.search);
  if ((init?.method || 'GET') !== 'GET') { audit.writes++; throw new Error('No operational writes allowed in fixture'); }
  if (url.pathname === '/api/apparatus-locations') return Response.json({ error: 'Locations disconnected in this progress fixture' }, { status: 403 });
  if (url.pathname === '/api/maps-config') return Response.json({ configured: false });
  if (url.pathname !== '/api/respond') throw new Error(`Unexpected API ${url.pathname}`);
  if (audit.hold) await new Promise<void>(resolve => { audit.pending = resolve; });
  if (audit.failed) return Response.json({ error: 'Simulated interrupted call update' }, { status: 503 });
  return Response.json({
    departmentId: audit.departmentId, apparatusFilter: url.searchParams.get('apparatus'), generatedAt: new Date().toISOString(),
    activeCall: audit.noCall ? null : { reportNumber: audit.reportNumber, callType: 'FICTIONAL TEST CALL', category: 'Test', address: 'Preview only — not an incident', city: 'Stickney', narrative: '', respondingUnits: audit.assigned, longitude: null, latitude: null, dispatchedAt: new Date().toISOString(), timeOut: '1200', source: 'Fixture', receivedAt: new Date().toISOString() },
    preplan: null, match: null, cadUpdates: [], recentCalls: [], boxCard: null, nearestHydrants: [], operational: null,
    overview: { apparatus: null, preplans: [], hydrants: [], roadClosures: [] },
  });
};

function Fixture() {
  const [unit, setUnit] = useState(params.get('unit') || '');
  const [mounted, setMounted] = useState(true);
  return <main>
    <div style={{ background: '#fff7d6', color: '#442e00', padding: 12 }}>
      <strong>LOCAL VERIFICATION — fictional calls; no production records</strong>
      <label>Preview device <select aria-label="Preview device" value={unit} onChange={event => setUnit(event.target.value)}><option value="">Department view</option><option>1204</option><option>1205</option><option>1208</option></select></label>
      <button onClick={() => window.dispatchEvent(new Event('online'))}>Refresh fixture</button>
      <button onClick={() => setMounted(value => !value)}>Toggle Respond</button>
    </div>
    {mounted && <section className="workspace" style={{ margin: 0, padding: 12 }}><Respond apparatus={unit} /></section>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
