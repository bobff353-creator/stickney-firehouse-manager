import { stockExpiryDays } from './inventory-check-flow.ts';
import { serviceDates, serviceToday } from './inventory-service-schedule.ts';

type Asset = Record<string, unknown>;
export type AssetAttention = { kind: 'status' | 'defect' | 'expiration' | 'hydro' | 'service'; severity: 'critical' | 'warning' | 'unknown'; label: string };
/** Saved dates only. Missing dates are unknown, never a certification of readiness. */
export function assetAttention(item: Asset, now = Date.now(), hasOpenIssue = false): AssetAttention[] {
  if (item.retired_at) return [];
  const result: AssetAttention[] = [];
  if (hasOpenIssue) result.push({ kind: 'defect', severity: 'critical', label: 'Open repair or reported defect' });
  if (['out_of_service', 'in_repair'].includes(String(item.service_status))) result.push({ kind: 'status', severity: 'critical', label: item.service_status === 'out_of_service' ? 'Out of service' : 'In repair' });
  for (const [kind, field, label] of [['expiration', 'expiration_date', 'Expiration'], ['hydro', 'hydro_due_date', 'Hydro test']] as const) {
    const date = item[field];
    const tracked = Boolean(date) || (kind === 'hydro' && item.scba_asset_kind === 'bottle');
    if (!tracked) continue;
    const days = stockExpiryDays(date, now);
    if (days === null) result.push({ kind, severity: 'unknown', label: `${label} date not recorded or invalid` });
    else if (days <= 30) result.push({ kind, severity: days < 0 ? 'critical' : 'warning', label: days < 0 ? `${label} overdue` : `${label} due ${days === 0 ? 'today' : `in ${days} days`}` });
  }
  try {
    const reminder = serviceDates(item, serviceToday(new Date(now)));
    if (reminder && reminder.status !== 'upcoming') result.push({ kind: 'service', severity: reminder.status === 'overdue' ? 'critical' : 'warning', label: reminder.status === 'overdue' ? 'Service overdue' : 'Service reminder active' });
  } catch {
    if (item.service_interval_months || item.last_serviced_date) result.push({ kind: 'service', severity: 'unknown', label: 'Service schedule needs review' });
  }
  return result;
}
