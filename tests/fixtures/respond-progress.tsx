import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Respond from '../../app/respond';
import { respondingUnitsIncludeUnit } from '../../app/respond-device';
import '../../app/globals.css';
import '../../app/mobile-usability.css';
import '../../app/portal-usability.css';

const params = new URLSearchParams(location.search);
const compactPreview = params.has('compact');
const multiCallPreview = params.has('calls');
let clearedPreviewCall = false, addedPreviewCall = false;
const previewNotes = Array.from({ length: 12 }, (_, index) => `Preview dispatch note ${index + 1}: Fictional layout verification only. This longer line checks that all notes remain readable without being clipped.`).join('\n\n') + '\n\nEND OF PREVIEW DISPATCH NOTES';
const previewPhoto = params.get('photo');
const previewWidth = previewPhoto === 'portrait' ? 600 : 1200;
const previewHeight = previewPhoto === 'portrait' ? 1200 : 600;
const previewImage = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${previewWidth}" height="${previewHeight}" viewBox="0 0 ${previewWidth} ${previewHeight}"><rect x="4" y="4" width="${previewWidth-8}" height="${previewHeight-8}" fill="#eaf2f5" stroke="#176d83" stroke-width="8"/><text x="20" y="45" font-size="24">PREVIEW ONLY — TOP EDGE</text><text x="20" y="${previewHeight-25}" font-size="24">BOTTOM EDGE — MUST REMAIN VISIBLE</text></svg>`);
const previewPreplan = previewPhoto ? { id: 'fixture-plan', businessName: 'Fictional preview building', address: 'Preview only — not a property', latitude: 0, longitude: 0, footprint: [], footprintSquareFeet: 0, floorCount: 1, constructionType: '', suggestedFireFlowGpm: 0, suggestedFireFlowDuration: 0, contactInfo: '', construction: '', accessInfo: '', alarmSystem: '', knoxBox: '', riser: '', fdc: '', sprinklerSystem: '', status: 'published', updatedAt: new Date().toISOString(), features: [], photos: [{ id: 'fixture-photo', side: 'A', caption: 'Fictional image sizing check', url: previewImage, illustrations: [] }] } : null;
const audit = { errors: [] as string[], requests: [] as string[], writes: 0, navigations: [] as string[], reportNumber: 'FIXTURE-100', departmentId: 'fixture-a', assigned: '1204, 1205', failed: false, noCall: false, hold: false, pending: null as null | (() => void), hydrants: params.has('hydrants') ? [
  { id: 'fixture-h1', hydrantNumber: '106', address: '  Preview only — Oak Avenue at West Sample Street, northeast corner  ', distanceFeet: 126, serviceStatus: 'in_service' },
  { id: 'fixture-h2', hydrantNumber: '107', address: '  ', distanceFeet: 256, serviceStatus: 'out_of_service' },
  { id: 'fixture-h3', hydrantNumber: '', address: 'Preview only — south entrance', distanceFeet: 352, serviceStatus: 'unknown' },
] : [] };
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
  if (multiCallPreview) {
    const eligible = [
      ...(addedPreviewCall ? [{reportNumber:'PREVIEW-400',callType:'NEW FICTIONAL CALL',address:'4 Preview Avenue',respondingUnits:'1204'}] : []),
      {reportNumber:'PREVIEW-300',callType:'FICTIONAL LIFT ASSIST',address:'3 Preview Avenue',respondingUnits:'1204'},
      ...(!clearedPreviewCall ? [{reportNumber:'PREVIEW-200',callType:'FICTIONAL FIRE ALARM AT A LONG BUILDING NAME',address:'2 Preview Avenue',respondingUnits:'1205'}] : []),
      {reportNumber:'PREVIEW-100',callType:'FICTIONAL WATER CALL',address:'1 Preview Avenue',respondingUnits:'1204'},
    ].filter(call=>respondingUnitsIncludeUnit(call.respondingUnits,url.searchParams.get('apparatus')||''));
    const requested=url.searchParams.get('report')||'';
    const chosen=eligible.find(call=>call.reportNumber===requested);
    const active=chosen||eligible[0];
    return Response.json({
      departmentId:audit.departmentId,apparatusFilter:url.searchParams.get('apparatus'),generatedAt:new Date().toISOString(),
      activeCalls:eligible,selectionUnavailable:Boolean(requested&&!chosen),
      activeCall:active?{...active,city:'Preview only',narrative:`Notes for ${active.reportNumber}`,source:'Fictional fixture',timeOut:'1200',dispatchedAt:new Date().toISOString(),latitude:null,longitude:null}:null,
      preplan:active&&previewPreplan?{...previewPreplan,id:'plan-'+active.reportNumber,businessName:'Building for '+active.reportNumber,address:active.address}:null,
      cadUpdates:active?[{eventType:'Preview dispatch',status:'test',narrative:`Notes for ${active.reportNumber}`,receivedAt:new Date().toISOString(),respondingUnits:active.respondingUnits}]:[],
      recentCalls:[],boxCard:active?{id:'box-'+active.reportNumber,title:'Box for '+active.reportNumber,boxNumber:active.reportNumber,address:'Preview only'}:null,
      nearestHydrants:active?[{id:'hydrant-'+active.reportNumber,address:'Hydrant for '+active.reportNumber,distanceFeet:100,serviceStatus:'in_service'}]:[],
      operational:null,overview:{apparatus:null,preplans:[],hydrants:[],roadClosures:[]},
    });
  }
  return Response.json({
    departmentId: audit.departmentId, apparatusFilter: url.searchParams.get('apparatus'), generatedAt: new Date().toISOString(),
    activeCall: audit.noCall ? null : { reportNumber: audit.reportNumber, callType: 'FICTIONAL TEST CALL', category: 'Test', address: 'Preview only — not an incident', city: 'Stickney', narrative: compactPreview ? previewNotes : '', respondingUnits: audit.assigned, longitude: null, latitude: null, dispatchedAt: new Date().toISOString(), timeOut: '1200', source: 'Fixture', receivedAt: new Date().toISOString() },
    preplan: previewPreplan, match: null, cadUpdates: compactPreview ? [{ eventType: 'Preview dispatch', status: 'test', receivedAt: new Date().toISOString(), narrative: previewNotes, respondingUnits: audit.assigned }] : [], recentCalls: [], boxCard: compactPreview ? { id: 'fixture-box', title: 'Preview structure fire — East of Sample Avenue', boxNumber: 'PREVIEW-E', address: 'Preview only', accessNotes: 'Full preview instructions stay on the box card. '.repeat(12) } : null, nearestHydrants: audit.hydrants, operational: null,
    overview: { apparatus: null, preplans: [], hydrants: [], roadClosures: [] },
  });
};

function Fixture() {
  const [unit, setUnit] = useState(params.get('unit') || '');
  const [mounted, setMounted] = useState(true);
  const [destination, setDestination] = useState('');
  return <main>
    <div style={{ background: '#fff7d6', color: '#442e00', padding: 12 }}>
      <strong>LOCAL VERIFICATION — fictional calls; no production records</strong>
      <label>Preview device <select aria-label="Preview device" value={unit} onChange={event => setUnit(event.target.value)}><option value="">Department view</option><option>1204</option><option>1205</option><option>1208</option></select></label>
      <button onClick={() => window.dispatchEvent(new Event('online'))}>Refresh fixture</button>
      <button onClick={() => setMounted(value => !value)}>Toggle Respond</button>
      {compactPreview && <button onClick={() => { audit.failed = !audit.failed; window.dispatchEvent(new Event('online')); }}>Toggle interrupted updates</button>}
      {multiCallPreview && <>
        <button onClick={()=>{clearedPreviewCall=true;window.dispatchEvent(new Event('online'));}}>Clear preview call 200</button>
        <button onClick={()=>{addedPreviewCall=true;window.dispatchEvent(new Event('online'));}}>Add preview call 400</button>
      </>}
      {destination && <output>Preview navigation: {destination}</output>}
    </div>
    {mounted && <section className="workspace" style={{ margin: 0, padding: 12 }}><Respond apparatus={unit} onNavigate={page => { audit.navigations.push(page); setDestination(page); }} /></section>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
