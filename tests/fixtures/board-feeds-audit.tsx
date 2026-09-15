import React from 'react';
import { createRoot } from 'react-dom/client';
import OperationsBoard from '../../app/operations-board';
import SmartAlerts from '../../app/smart-alerts';
import '../../app/globals.css';
import '../../app/mobile-usability.css';
import '../../app/portal-usability.css';
type Audit = { requests: string[]; errors: string[]; unchanged: number; incoming: boolean; alerts: number; holdFeeds: boolean };
declare global { interface Window { boardFeedAudit: Audit } }
const parameters = new URLSearchParams(location.search);
const count = parameters.get('count') === '2' ? 2 : 1;
const tv = parameters.has('tv');
const audit: Audit = { requests: [], errors: [], unchanged: 0, incoming: false, alerts: 0, holdFeeds: parameters.has('slow') };
window.boardFeedAudit = audit;
window.addEventListener('error', event => audit.errors.push(event.message));
window.addEventListener('unhandledrejection', event => audit.errors.push(String(event.reason)));
if (!parameters.has('reuse')) for (const group of ['weather','bulletins']) localStorage.removeItem(`stickney-public-board-feeds-v1:${group}`);
const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.origin !== location.origin) throw new Error('External browser request blocked in local test');
  audit.requests.push(url.pathname + url.search);
  if(parameters.has('links') && url.pathname.startsWith('/__links-')) return nativeFetch(input, init);
  if(parameters.has('training') && (url.pathname === '/api/training-import' || url.pathname.startsWith('/__training-'))) return nativeFetch(input, { ...init, headers: { ...init?.headers, 'x-fixture-role': parameters.has('member') ? 'member' : 'admin' } });
  if(parameters.has('links') && url.pathname === '/api/board-links') return nativeFetch(input, { ...init, headers: { ...init?.headers, 'x-fixture-role': parameters.has('member') ? 'member' : 'admin' } });
  if(parameters.has('links') && url.pathname === '/api/chief-board') {
    const response = await nativeFetch('/__links-state');
    const boardLinks = await response.json();
    if(parameters.has('member')) boardLinks.canEdit = false;
    if(url.searchParams.get('links-revision') === boardLinks.settings.revision) delete boardLinks.settings;
    return Response.json({ items: [], officers: [], canEdit: false, boardLinks });
  }
  if (url.pathname === '/api/board-feeds') {
    if (audit.holdFeeds) await new Promise((resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
    if (parameters.has('dense')) {
      // Long-content layout cases only; never modify the real feed or cache.
      const response = await nativeFetch(input, init), result = await response.json();
      if (result.feeds.usfa) result.feeds.usfa.data = {year:2026,total:6,items:Array.from({length:6},(_,i)=>({id:i,name:`Fictional memorial ${i+1} — layout test`,department:'Fictional department — local preview only',location:'Not an actual fatality report',deathDate:'2026-09-01',url:'https://example.invalid/'}))};
      for (const id of ['romeoville','ifsi','nipsta']) {
        const saved = result.feeds[`training_${id}`]?.data;
        if (saved?.upcoming?.[0]) saved.upcoming = Array.from({length:5},(_,i)=>({...saved.upcoming[0],title:`Fictional training ${i+1} — longer class title for layout checks`,detail:'Local test description. This verifies that the existing saved class information fits on a larger television without using additional feed requests.'}));
      }
      return Response.json(result);
    }
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
  if (url.pathname === '/api/live-operations') {
    const result = Object.fromEntries([['dashboard','/api/dashboard'],['duties','/api/daily-duties'],['fleet','/api/suite-context']].map(([key,path]) => [key,{ok:true,status:200,payload:payloads[path]}]));
    // The actual route's hash/delta behavior is covered by live-economy tests.
    const revision = audit.incoming ? 'fixture-incoming' : 'fixture-idle';
    if (new Headers(init?.headers).get('x-content-revision') === revision) { audit.unchanged++; return new Response(null,{status:204,headers:{'x-content-revision':revision}}); }
    return Response.json(result,{headers:{'x-content-revision':revision}});
  }
  if (!(url.pathname in payloads)) throw new Error('Unexpected fixture API '+url.pathname);
  return Response.json(payloads[url.pathname]);
};
function PreviewBoard() {
  const [tvMode, setTvMode] = React.useState(tv);
  return <><button style={{position:'fixed',bottom:2,right:2,zIndex:2147483647}} onClick={() => setTvMode(value => !value)}>Toggle local TV layout</button><main className={tvMode ? 'tv-shell' : ''}><section className="workspace">{parameters.has('alerts') && !tvMode && <SmartAlerts icon={<span>Notifications</span>} onNavigate={() => {}}/>}<OperationsBoard tvMode={tvMode} onTvModeChange={setTvMode} onNewActiveCall={() => { audit.alerts++; }} /></section></main></>;
}
function AuditControls() {
  const [stats,setStats]=React.useState('');
  return <aside style={{position:'fixed',bottom:2,left:2,zIndex:2147483647,background:'#fff7d6',color:'#442e00',padding:4,fontSize:12}}>
    <button onClick={() => { audit.incoming=true; window.dispatchEvent(new Event('online')); }}>Simulate incoming call</button>
    <button onClick={() => setStats(JSON.stringify({reads:audit.requests.reduce<Record<string,number>>((counts,url)=>{counts[url]=(counts[url]||0)+1;return counts;},{}),unchanged:audit.unchanged,alerts:audit.alerts,errors:audit.errors}))}>Show test traffic</button>
    {stats && <output aria-label="Local test traffic">{stats}</output>}
  </aside>;
}
createRoot(document.getElementById('root')!).render(<>
  <p style={{ margin: 0, background: '#fff7d6', color: '#442e00', padding: 4 }}>LOCAL TEST — fictional source data; no operational records.</p>
  <AuditControls/>
  {Array.from({ length: count }, (_, index) => <PreviewBoard key={index}/>)}
</>);
