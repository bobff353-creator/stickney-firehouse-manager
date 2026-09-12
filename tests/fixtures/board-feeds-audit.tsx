import React from 'react';
import { createRoot } from 'react-dom/client';
import OperationsBoard from '../../app/operations-board';
import SmartAlerts from '../../app/smart-alerts';
import '../../app/globals.css';
import '../../app/mobile-usability.css';
import '../../app/portal-usability.css';
type Audit = { requests: string[]; errors: string[]; incoming: boolean; alerts: number; holdFeeds: boolean };
declare global { interface Window { boardFeedAudit: Audit } }
const parameters = new URLSearchParams(location.search);
const count = parameters.get('count') === '2' ? 2 : 1;
const tv = parameters.has('tv');
const audit: Audit = { requests: [], errors: [], incoming: false, alerts: 0, holdFeeds: parameters.has('slow') };
window.boardFeedAudit = audit;
window.addEventListener('error', event => audit.errors.push(event.message));
window.addEventListener('unhandledrejection', event => audit.errors.push(String(event.reason)));
if (!parameters.has('reuse')) for (const group of ['weather','bulletins']) localStorage.removeItem(`stickney-public-board-feeds-v1:${group}`);
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.origin !== location.origin) throw new Error('External browser request blocked in local test');
  audit.requests.push(url.pathname + url.search);
  if (url.pathname === '/api/board-feeds') {
    if (audit.holdFeeds) await new Promise((resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
    return nativeFetch(input, init);
  }
  const now = new Date().toISOString();
  const payloads: Record<string, unknown> = {
    '/api/dashboard': { asOf: now, currentShift: 'morning', onDuty: [], newMembers: [], officerInCharge: null, staffing: { filled: 0, required: 0, complete: true }, equipmentIssues: [], activeCalls: audit.incoming ? [{ reportNumber: 'FICTIONAL-CALL', timeOut: '1200', respondingUnits: 'FIXTURE', address: 'LOCAL TEST ONLY', callType: 'SIMULATED CALL' }] : [], apparatus: [], roadClosures: [] },
    '/api/daily-duties': { currentDuty: null, dailyFleetChecks: [] },
    '/api/suite-context': { apparatus: [{ id: 'fixture', unitNumber: 'FIXTURE', name: 'Preview unit', status: 'In Service' }] },
    '/api/chief-board': { items: [], officers: [], canEdit: false },
    '/api/river-gauge': { gaugeId: 'fixture', name: 'Preview gauge', level: 10, unit: 'ft', category: 'normal', validTime: now, retrievedAt: now, inService: true, majorStage: 20, sourceUrl: '#', hydrographUrl: '#' },
    '/api/department-schedule': { items: [], upcomingShifts: [] },
    '/api/alerts': { alerts: [{id:'fixture-alert',severity:'info',category:'LOCAL TEST',title:'Fixture attention item',detail:'Not an operational alert',page:'Daily Log'}] },
    '/api/push/subscriptions': {configured:false,publicKey:''},
  };
  if (!(url.pathname in payloads)) throw new Error('Unexpected fixture API '+url.pathname);
  return Response.json(payloads[url.pathname]);
};
createRoot(document.getElementById('root')!).render(<>
  <p style={{ margin: 0, background: '#fff7d6', color: '#442e00', padding: 4 }}>LOCAL TEST — fictional source data; no operational records.</p>
  {Array.from({ length: count }, (_, index) => <main key={index} className={tv ? 'tv-shell' : ''}><section className="workspace">{parameters.has('alerts') && !tv && <SmartAlerts icon={<span>Notifications</span>} onNavigate={() => {}}/>}<OperationsBoard tvMode={tv} onNewActiveCall={() => { audit.alerts++; }} /></section></main>)}
</>);
