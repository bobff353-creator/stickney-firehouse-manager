import { operationsReadiness } from './operations-readiness';
import './operations-overview.css';
type Destination = 'equipment' | 'service' | 'stock';
export function OperationsOverview({ data, onNavigate, delayed = false }: { data: Parameters<typeof operationsReadiness>[0]; onNavigate: (view: Destination) => void; delayed?: boolean }) {
  const summary = operationsReadiness(data);
  return <section className="ops-overview" aria-label="Operations overview">
    <header><div><span>OPERATIONS</span><h2>Checks, assets &amp; repairs</h2></div><p>{delayed ? 'Update delayed · last loaded records' : 'Saved department records'} · required checks below</p></header>
    <div className="ops-overview-grid">
      <article><strong>{summary.inProgressChecks}</strong><h3>Checks underway</h3><p>Resume saved work in the due list below.</p></article>
      <button type="button" onClick={() => onNavigate('equipment')}><strong>{summary.assetAttention}</strong><h3>Assets need attention</h3><p>{summary.assets} active assets · {summary.assetUnknown} with dates to verify</p><span>Find equipment →</span></button>
      <button type="button" onClick={() => onNavigate('service')}><strong>{summary.openRepairs}</strong><h3>Open work orders</h3><p>{summary.highPriorityRepairs} high or critical priority</p><span>Follow repairs →</span></button>
      <button type="button" onClick={() => onNavigate('stock')}><strong>{summary.lowStock}</strong><h3>Supplies at reorder level</h3><p>{summary.expiredStock} with expired lots · {summary.unknownStock} with dates to verify</p><span>Review stock →</span></button>
    </div><p className="ops-overview-note">Counts identify saved issues and dates. Verify apparatus checks and service status before use.</p>
  </section>;
}
