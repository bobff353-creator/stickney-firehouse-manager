import React from 'react';
import { createRoot } from 'react-dom/client';
import RespondOverviewMap from '../../app/respond-overview-map';
import '../../app/globals.css';

const errors: string[] = [];
Object.assign(window, {recentCallAudit:{errors}});
window.addEventListener('error', event => errors.push(event.message));
window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
const response = await fetch('/__recent-calls');
if (!response.ok) throw new Error('Local history query failed');
const calls = await response.json();
const monitor = new URLSearchParams(location.search).has('monitor');
createRoot(document.getElementById('root')!).render(<main>
  <p style={{margin:0,padding:8,background:'#fff7d6',color:'#442e00'}}>LOCAL PREVIEW — fictional calls; no production records. Basemap intentionally disconnected.</p>
  <section className={`respond-page respond-overview-page${monitor?' monitor-view':''}`} style={monitor?undefined:{padding:12}}>
    <RespondOverviewMap overview={{apparatus:null,preplans:[],hydrants:[],roadClosures:[]}} recentCalls={calls} onNavigate={() => {}} />
  </section>
</main>);
