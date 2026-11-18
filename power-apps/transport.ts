import { getSupabaseBrowserClient } from './supabase-browser';

let installed = false;
export function installPowerAppsTransport(backendUrl: string) {
  if (installed) return;
  const backend = new URL(backendUrl);
  if (backend.origin !== backendUrl || backend.protocol !== 'https:' || backend.hostname !== 'stickney-power-apps-review.vercel.app') {
    throw new Error('The independent Power Apps backend URL is required.');
  }
  installed = true;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const source = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
    // Never forward a member's credentials to another origin or a non-API URL.
    if (source.origin !== location.origin || !source.pathname.startsWith('/api/')) return nativeFetch(input, init);
    const original = new Request(source, input instanceof Request ? new Request(input, init) : init);
    const headers = new Headers(original.headers);
    headers.set('x-firehouse-client', 'power-apps-v1');
    const client = getSupabaseBrowserClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw new Error('The member session could not be renewed. Sign in again.');
    if (data.session) {
      headers.set('authorization', `Bearer ${data.session.access_token}`);
      headers.set('x-firehouse-refresh-token', data.session.refresh_token);
    }
    const target = new URL(source.pathname + source.search, backend);
    const response = await nativeFetch(new Request(target, original), { headers, credentials: 'include', redirect: 'error' });
    if (source.pathname === '/api/auth/login' && response.ok) {
      const payload = await response.clone().json();
      if (!payload.session?.access_token || !payload.session?.refresh_token) throw new Error('The backend did not return a verified sign-in session.');
      const result = await client.auth.setSession(payload.session);
      if (result.error) throw new Error('The member sign-in session could not be established.');
    }
    const renewed = response.headers.get('x-firehouse-auth-session');
    if (renewed) {
      const result = await client.auth.setSession(JSON.parse(atob(renewed.replaceAll('-', '+').replaceAll('_', '/'))));
      if (result.error) throw new Error('The renewed member session could not be established.');
    }
    return response;
  };
}
