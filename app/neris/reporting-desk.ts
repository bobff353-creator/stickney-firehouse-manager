import type { NerisRecord } from './model';
import type { CadCall } from './cad-location';
export type DeskRow = CadCall & { reports: Array<{ id: string; title: string; version: number; status: 'Draft' | 'Reviewed' }>; state: 'No local report' | 'Draft' | 'Locally reviewed' | 'Multiple local reports'; archivedCount: number; testCount: number };
export function reportingDesk(calls: CadCall[], records: NerisRecord[]): DeskRow[] {
  return calls.map(call => {
    const linked = records.filter(record => record.kind === 'incident' && record.data.local.cadSourceId === call.id);
    const active = linked.filter(record => !record.archived && !record.data.local.test);
    return { ...call, reports: active.map(record => ({ id: record.id, title: record.data.local.title || 'Untitled report', version: record.version, status: record.data.local.status })), state: active.length > 1 ? 'Multiple local reports' : active.length === 0 ? 'No local report' : active[0].data.local.status === 'Reviewed' ? 'Locally reviewed' : 'Draft', archivedCount: linked.filter(record => record.archived && !record.data.local.test).length, testCount: linked.filter(record => record.data.local.test).length };
  });
}
