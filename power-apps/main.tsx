import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import AuthGateway from '../app/auth-gateway';
import type { PortalDepartment } from '../app/department-portal';
import DailyLogReview from './workspace';
import { installPowerAppsTransport } from './transport';
import './portal-styles';
import './review-status.css';

const backend = import.meta.env.VITE_POWER_APPS_BACKEND_URL;
if (backend) installPowerAppsTransport(backend);

function ConnectedApp() {
  const [department, setDepartment] = useState<PortalDepartment | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/health', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }).then(async response => {
      const data = await response.json();
      if (!response.ok || data.supabaseProjectRef !== 'qizfnynrspsydiuwkkex' || data.department?.id !== '14a76771-4c24-481b-8def-e6cce005c17b') throw new Error('The independent department backend could not be verified.');
      if (!controller.signal.aborted) setDepartment(data.department);
    }).catch(caught => { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'The backend is unavailable.'); });
    return () => controller.abort();
  }, [reload]);
  if (department) return <AuthGateway department={department} />;
  return <main className="review-status content-card"><h1>Stickney Firehouse Manager</h1>
    <p role="status">{error || 'Connecting to the department backend…'}</p>
    {error && <button onClick={() => { setError(''); setReload(value => value + 1); }}>Retry connection</button>}
  </main>;
}

function App() {
  if (backend) return <ConnectedApp />;
  if (location.hostname === '127.0.0.1' && location.pathname.startsWith('/power-apps/')) return <DailyLogReview />;
  return <main className="review-status content-card"><h1>Daily Log is still being connected</h1>
    <p role="status">The independent backend connection has not been configured. Daily Log cannot load or save.</p>
  </main>;
}

const root = document.getElementById('root');
if (!root) throw new Error('Firehouse Manager root element is missing.');
createRoot(root).render(<App />);
