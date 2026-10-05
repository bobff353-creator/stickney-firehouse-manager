import { assetAttention } from './inventory-asset-attention.ts';
import { stockAttention, stockGroups, openRepair } from './inventory-workspace-filters.ts';

type Row = Record<string, unknown>;
export type OperationsReadiness = {
  asOf: string; assets: number; assetAttention: number; assetUnknown: number;
  openRepairs: number; highPriorityRepairs: number; inProgressChecks: number;
  lowStock: number; expiredStock: number; unknownStock: number;
};
export function operationsReadiness(data: { equipment: Row[]; workOrders: Row[]; checks: Row[]; stock: Row[]; exceptions?: Row[] }, now = Date.now()): OperationsReadiness {
  const assets = data.equipment.filter(row => !row.retired_at && row.service_status !== 'retired');
  const repairs = data.workOrders.filter(openRepair);
  const issueEquipment = new Set([...repairs, ...(data.exceptions || []).filter(row => !['resolved', 'cancelled'].includes(String(row.status)))].map(row => String(row.equipment_id || '')).filter(Boolean));
  const attention = assets.map(row => assetAttention(row, now, issueEquipment.has(String(row.id))));
  const stock = stockGroups(data.stock).map(item => stockAttention(item, now));
  return {
    asOf: new Date(now).toISOString(), assets: assets.length,
    assetAttention: attention.filter(items => items.some(item => item.severity !== 'unknown')).length,
    assetUnknown: attention.filter(items => items.some(item => item.severity === 'unknown')).length,
    openRepairs: repairs.length, highPriorityRepairs: repairs.filter(row => ['critical', 'high'].includes(String(row.priority))).length,
    inProgressChecks: data.checks.filter(row => row.status === 'in_progress').length,
    lowStock: stock.filter(item => item.low).length, expiredStock: stock.filter(item => item.expired.length).length,
    unknownStock: stock.filter(item => item.unknown.length).length,
  };
}
