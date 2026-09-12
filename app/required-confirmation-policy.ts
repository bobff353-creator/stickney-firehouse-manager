export type ConfirmationStatus = { required: boolean; version: string | null; exempt: boolean };
// These are only gate exceptions: every route still enforces its normal access.
export function confirmationExemptRequest(url: URL, method: string) {
  if (url.pathname === '/api/required-confirmation') return true;
  if (['/api/auth/context','/api/auth/pin','/api/auth/session'].includes(url.pathname)) return true;
  if (url.pathname === '/api/push/subscriptions') return true;
  if (method !== 'GET') return false;
  if (url.pathname === '/api/permissions' && url.searchParams.get('scope') === 'viewer') return true;
  if (['/api/respond','/api/respond/street-view','/api/apparatus-locations','/api/maps-config','/api/field-hydrants','/api/field-preplans/operational','/api/road-closures','/api/alerts'].includes(url.pathname)) return true;
  if (/^\/api\/field-preplans\/assets\/[^/]+$/.test(url.pathname)) return true;
  if (['/api/dashboard','/api/daily-duties','/api/suite-context'].includes(url.pathname) && url.searchParams.get('scope') === 'live-operations') return true;
  return false;
}
export function parseConfirmationStatus(value: string | null): ConfirmationStatus | null {
  try { const data = JSON.parse(value || 'null'); return data && typeof data.required === 'boolean' && (typeof data.version === 'string' || data.version === null) && typeof data.exempt === 'boolean' ? data : null; }
  catch { return null; }
}
