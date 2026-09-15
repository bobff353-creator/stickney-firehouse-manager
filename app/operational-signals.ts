// Signals contain only revisions, never call details, employee records or grants.
export const operationalSections = ['respond', 'dashboard', 'duties', 'fleet', 'chief', 'staffing', 'feeds'] as const;
export type OperationalSection = typeof operationalSections[number];
export type OperationalScope = 'respond' | 'board';
export type OperationalLease = { scope: OperationalScope; topic: string; expiresAt: string; revisions: Partial<Record<OperationalSection, string>>; queued: boolean };
export type OperationalSignal = { departmentId: string; userId: string; serverTime: string; leases: OperationalLease[] };
const interests = new Map<OperationalScope, number>();
const listeners = new Set<(signal: OperationalSignal | null) => void>();
export function operationalQuery() { return [...interests.keys()].sort().join(','); }
export function retainOperationalScope(scope: OperationalScope) {
  interests.set(scope, (interests.get(scope) ?? 0) + 1);
  return () => { const count = (interests.get(scope) ?? 1) - 1; if (count) interests.set(scope, count); else interests.delete(scope); };
}
export function publishOperationalSignal(signal: OperationalSignal | null) {
  // A live-view subscriber must never break an otherwise valid access check.
  listeners.forEach(listener => { try { listener(signal); } catch { /* view falls back to its normal reads */ } });
}
export function listenOperationalSignals(listener: (signal: OperationalSignal | null) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
