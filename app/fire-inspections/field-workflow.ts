import { findings, normalizeInspection, type InspectionRecord } from './model';

export const observationFields = { accessInfo: 'Access / hazards', knoxBox: 'Knox box', fdc: 'FDC', alarmSystem: 'Alarm panel', sprinklerSystem: 'Sprinkler system' } as const;
export type FieldObservations = Partial<Record<keyof typeof observationFields, string>>;
export function normalizeObservations(value: unknown): FieldObservations {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw Error('Preplan observations must be fields.');
  const result: FieldObservations = {};
  for (const key of Object.keys(observationFields) as (keyof FieldObservations)[]) {
    const text = (value as FieldObservations)[key];
    if (text !== undefined) {
      if (typeof text !== 'string' || text.length > 2000) throw Error('Each preplan observation needs text of up to 2,000 characters.');
      // Empty fields are omitted: this workflow cannot erase existing operational information.
      if (text.trim()) result[key] = text.trim();
    }
  }
  return result;
}
export function propertyVisits(records: InspectionRecord[], propertyId: string, includeTests = false) {
  return records.filter(r => r.kind === 'inspection' && r.data.propertyId === propertyId && (includeTests || !r.data.test))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function openFindings(record: InspectionRecord) { return findings(record.data).filter(c => c.result === 'Needs attention'); }
export type PendingInspection = { record: InspectionRecord; queuedAt: string; state: 'pending' | 'conflict' | 'failed'; error: string };
export const fieldQueueKey = (department: string) => `firehouse:inspection-field-queue:${department}`;
export function readFieldQueue(raw: string | null, now = Date.now()): PendingInspection[] {
  if (!raw) return [];
  try {
    const rows: PendingInspection[] = JSON.parse(raw);
    if (!Array.isArray(rows) || rows.length > 50) return [];
    return rows.filter(row => row.record?.kind === 'inspection' && /^[a-zA-Z0-9_-]{8,120}$/.test(row.record.id) &&
      Number.isInteger(row.record.version) && row.record.version >= 0 && Number.isFinite(Date.parse(row.queuedAt)) &&
      now - Date.parse(row.queuedAt) >= -60000)
      .map(row => ({ ...row, record: { ...row.record, data: normalizeInspection(row.record.data) },
        state: now-Date.parse(row.queuedAt)>=86400000?'conflict':['pending', 'failed', 'conflict'].includes(row.state) ? row.state : 'pending', error: now-Date.parse(row.queuedAt)>=86400000?'Stored more than 24 hours ago. Review this local entry and the latest server record before queuing again.':String(row.error || '').slice(0,500) }));
  } catch { return []; }
}
export function queueInspection(rows: PendingInspection[], record: InspectionRecord, now = new Date().toISOString()) {
  if (record.kind !== 'inspection') throw Error('Offline queuing is for property inspections.');
  if (rows.some(r => r.record.id === record.id && r.record.version !== record.version)) throw Error('Review the queued version before replacing it.');
  if (rows.length >= 50 && !rows.some(r => r.record.id === record.id)) throw Error('Sync or remove a pending entry before adding more than 50 inspections.');
  return [...rows.filter(r => r.record.id !== record.id), { record, queuedAt: now, state: 'pending' as const, error: '' }];
}
// Only an authenticated, positive server receipt removes a queued entry. No background retries of rejected data.
export async function replayInspections(rows: PendingInspection[], send: (record: InspectionRecord) => Promise<{ status: number; saved?: InspectionRecord; error?: string }>, onSaved: (record: InspectionRecord) => void) {
  const remaining: PendingInspection[] = [];
  for (const row of rows) {
    if (row.state === 'conflict') { remaining.push(row); continue; }
    try {
      const reply = await send(row.record);
      if (reply.status >= 200 && reply.status < 300 && reply.saved?.id === row.record.id && reply.saved.version === row.record.version + 1) onSaved(reply.saved);
      else {
        remaining.push({ ...row, state: reply.status === 409 ? 'conflict' : 'failed', error: reply.error || 'Save was not confirmed.' });
        if ([401,403].includes(reply.status)) { remaining.push(...rows.slice(rows.indexOf(row)+1)); break; }
      }
    } catch { remaining.push({ ...row, state: 'failed', error: 'Connection lost. This entry remains on this tab.' }); remaining.push(...rows.slice(rows.indexOf(row)+1)); break; }
  }
  return remaining;
}
export function nearbyHydrants<T extends { latitude: number; longitude: number }>(property: { latitude?: number; longitude?: number }, rows: T[]) {
  const valid = (lat: unknown, lng: unknown) => typeof lat === 'number' && typeof lng === 'number' && Math.abs(lat)<=90 && Math.abs(lng)<=180 && !(lat===0&&lng===0);
  if (!valid(property.latitude, property.longitude)) return [];
  const radians = (n: number) => n*Math.PI/180;
  return rows.filter(h => valid(h.latitude,h.longitude)).map(h => {
    const a=Math.sin(radians(h.latitude-property.latitude!)/2)**2+Math.cos(radians(property.latitude!))*Math.cos(radians(h.latitude))*Math.sin(radians(h.longitude-property.longitude!)/2)**2;
    return { ...h, distanceFeet: Math.round(6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)))*3.28084) };
  }).sort((a,b)=>a.distanceFeet-b.distanceFeet).slice(0,3);
}
