import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { powerAppsRequest } from './power-apps-request';
import { definitiveAuthFailure } from './auth-failure-policy';

/** A member's own session; never an administrator/service-role connection. */
export async function powerAppsSessionClient(request: { headers: Headers }, url: string, key: string, serverHeaders: Record<string, string> = {}) {
  if (!powerAppsRequest(request)) return null;
  const token = request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/)?.[1];
  const refresh = request.headers.get('x-firehouse-refresh-token');
  if (!token || !refresh || refresh.length > 1024) throw Object.assign(new Error('A verified member session is required.'), { status: 401 });
  const client = createClient(url, key, {
    global: { headers: serverHeaders },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.setSession({ access_token: token, refresh_token: refresh });
  if (error || !data.session || !data.user) throw Object.assign(new Error('The member session could not be verified.'), { status: error && !definitiveAuthFailure(error) ? 503 : 401 });
  return { client, session: data.session };
}
