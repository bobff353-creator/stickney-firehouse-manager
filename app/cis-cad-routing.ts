import type { CisCadIncident } from './cis-cad';

export type CisSettings = {
  revision: string;
  mode: 'disabled' | 'shadow' | 'live';
  agencies: string[];
  units: Array<{ agency: string; external: string; apparatus: string }>;
};
export const defaultCisSettings = (): CisSettings => ({ revision: '', mode: 'disabled', agencies: [], units: [] });
export const cisToken = (value: unknown) => String(value ?? '').trim().toUpperCase();
export const cisUnits = (value: string) => [...new Set(value.split(/[\s,;/]+/).map(cisToken).filter(Boolean))];

export function validateCisSettings(value: unknown, fleet: string[]): CisSettings {
  const raw = value as CisSettings;
  if (!raw || !['disabled', 'shadow', 'live'].includes(raw.mode) || !Array.isArray(raw.agencies) || !Array.isArray(raw.units)) throw new Error('Choose a delivery mode, approved agencies and unit mappings.');
  const agencies = [...new Set(raw.agencies.map(cisToken).filter(Boolean))];
  const validToken = (text: string) => /^[A-Z0-9_-]{1,40}$/.test(text);
  if (agencies.length > 30 || agencies.some(id => !validToken(id)) || raw.units.length > 100) throw new Error('Use exact agency and unit identifiers (letters, numbers, underscores or hyphens).');
  const seen = new Set<string>();
  const units = raw.units.map(row => {
    const agency = cisToken(row.agency), external = cisToken(row.external), apparatus = cisToken(row.apparatus);
    const id = `${agency}:${external}`;
    if (!agencies.includes(agency) || !validToken(external) || !fleet.map(cisToken).includes(apparatus) || seen.has(id)) throw new Error('Each CIS unit needs one unique mapping from an approved agency to an existing Fleet apparatus.');
    seen.add(id);
    return { agency, external, apparatus };
  });
  if (raw.mode !== 'disabled' && !agencies.length) throw new Error('Approve at least one department agency identifier first.');
  return { revision: String(raw.revision || ''), mode: raw.mode, agencies, units };
}

export type CisState = CisCadIncident & { rawUnits: string[]; mappedUnits: string[]; involvedUnits: string[]; unmappedUnits: string[]; closed: boolean };
type Decision = { status: 'applied'; state: CisState } | { status: 'ignored' | 'rejected'; reason: string };
const supplied = (event: CisCadIncident, aliases: string[]) => aliases.some(alias => event.present.includes(alias));

// A pure reducer used by both the sample preview and the transactional receiver.
// No prefix guessing, geography/incident-type exclusions, or unit clear => incident clear.
export function reduceCisEvent(previous: CisState | null, event: CisCadIncident, settings: CisSettings): Decision {
  const agency = cisToken(event.agency || previous?.agency);
  if (!agency || !settings.agencies.includes(agency)) return { status: 'rejected', reason: 'Agency is missing or not approved for Stickney.' };
  if (previous && agency !== previous.agency) return { status: 'rejected', reason: 'Incident agency changed; review the vendor incident identifier.' };
  if (previous?.closed) return { status: 'ignored', reason: 'Incident is already closed. A late event cannot reopen it.' };
  if (previous?.sequence != null) {
    if (event.sequence == null) return { status: 'rejected', reason: 'This incident requires the vendor sequence number on every update.' };
    if (event.sequence <= previous.sequence) return { status: 'ignored', reason: 'Duplicate or older event sequence.' };
  } else if (previous) {
    if (!event.eventAt) return { status: 'rejected', reason: 'Updates require a vendor event timestamp with timezone or a consistent sequence.' };
    if (event.eventAt <= (previous.eventAt || previous.dispatchedAt)) return { status: 'ignored', reason: 'Duplicate or older event timestamp.' };
  }
  if (!previous && event.eventType === 'update') return { status: 'rejected', reason: 'An update arrived before the initial incident. Send the initial full incident first.' };
  const merged = { ...(previous || event), eventId: event.eventId, eventType: event.eventType, agency, eventAt: event.eventAt || event.dispatchedAt, sequence: event.sequence, present: event.present };
  // Missing/blank scalar fields in a partial update never erase operational details.
  for (const name of ['callType', 'category', 'address', 'city', 'narrative', 'dispatchedAt', 'timeOut'] as const) {
    if (event[name]) merged[name] = event[name];
  }
  if (event.latitude !== null && event.longitude !== null && Math.abs(event.latitude) <= 90 && Math.abs(event.longitude) <= 180 && (event.latitude !== 0 || event.longitude !== 0)) {
    merged.latitude = event.latitude;
    merged.longitude = event.longitude;
  } else if (!previous) { merged.latitude = null; merged.longitude = null; }
  let rawUnits = previous?.rawUnits || [];
  if (supplied(event, ['respondingunits', 'units', 'assignedunits', 'unitids', 'apparatus'])) rawUnits = cisUnits(event.respondingUnits);
  if (event.unitAction === 'add') rawUnits = [...new Set([...rawUnits, cisToken(event.unitId)])];
  if (event.unitAction === 'remove') rawUnits = rawUnits.filter(unit => unit !== cisToken(event.unitId));
  const mappings = new Map(settings.units.filter(row => row.agency === agency).map(row => [row.external, row.apparatus]));
  const mappedUnits = [...new Set(rawUnits.flatMap(unit => mappings.has(unit) ? [mappings.get(unit)!] : []))];
  const unmappedUnits = rawUnits.filter(unit => !mappings.has(unit));
  const involvedUnits = [...new Set([...(previous?.involvedUnits || previous?.mappedUnits || []), ...mappedUnits])];
  return { status: 'applied', state: { ...merged, timeIn: event.eventType === 'close' ? event.timeIn : '', unitId: event.unitId, unitAction: event.unitAction, rawUnits, mappedUnits, involvedUnits, unmappedUnits, respondingUnits: mappedUnits.join(', '), closed: event.eventType === 'close' } };
}
