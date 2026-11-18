/** Only explicitly configured Code App origins can use the cross-origin transport. */
export function powerAppsOrigin(request: { headers: Headers }) {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  const allowed = (process.env.POWER_APPS_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean);
  return allowed.some(value => {
    try { const url = new URL(value); return url.protocol === 'https:' && url.origin === value && value === origin; }
    catch { return false; }
  }) ? origin : null;
}

export function powerAppsRequest(request: { headers: Headers }) {
  return Boolean(powerAppsOrigin(request)) && request.headers.get('x-firehouse-client') === 'power-apps-v1';
}

export function powerAppsCorsHeaders(request: { headers: Headers }) {
  const headers = new Headers();
  const origin = powerAppsOrigin(request);
  if (!origin) return headers;
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Firehouse-Client, X-Firehouse-Refresh-Token');
  headers.set('Access-Control-Expose-Headers', 'X-Firehouse-Auth-Session');
  headers.set('Vary', 'Origin');
  headers.set('Cache-Control', 'private, no-store');
  return headers;
}

export function portalPinCookieOptions(request: { headers: Headers }, maxAge: number) {
  return {
    httpOnly: true, secure: true, path: '/', maxAge,
    sameSite: powerAppsRequest(request) ? 'none' as const : 'lax' as const,
    ...(powerAppsRequest(request) ? { partitioned: true } : {}),
  };
}
