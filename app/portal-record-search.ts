import type { PortalPage, PortalRecord } from './portal-navigation';

export type OperationalSearchItem = {
  id: string;
  type: 'Hydrant' | 'Equipment' | 'Inspection' | 'Training' | 'Incident';
  title: string;
  detail: string;
  page: PortalPage;
  record: PortalRecord;
};
export function searchPattern(query: string) {
  return `%${query.replace(/[\\%_*]/g, '\\$&')}%`;
}
export function privateSearchItem(kind: 'inspection' | 'training' | 'neris', row: { id: string; kind?: string; payload: string }): OperationalSearchItem | null {
  let data: Record<string, unknown>;
  try { data = JSON.parse(row.payload); } catch { return null; }
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.test === true) return null;
  if (kind === 'neris') {
    const local = data.local as Record<string, unknown> | undefined;
    if (!local || local.test === true) return null;
    return { id: `incident-${row.id}`, type: 'Incident', title: String(local.title || 'Untitled incident'), detail: String(local.status || 'Draft')+' · Local report', page: 'NERIS Reporting', record: { nerisRecord: row.id } };
  }
  if (kind === 'inspection') return { id: `inspection-${row.id}`, type: 'Inspection', title: String(data.title || data.propertyName || 'Inspection'), detail: String(data.status || 'Draft'), page: 'Fire Inspections', record: { inspectionRecord: row.id, inspectionTab: 'Work queue' } };
  return { id: `training-${row.id}`, type: 'Training', title: String(data.title || 'Training record'), detail: [row.kind, data.status, data.date, data.category, data.description].filter(Boolean).join(' · '), page: 'Training', record: { trainingRecord: row.id, trainingTab: 'History & reports' } };
}
