import { headers } from 'next/headers';
import { getSupabaseSystemClient } from './supabase-system';

export type PortalDepartment = { id: string; name: string; slug: string; isolated: boolean };
const portals = new Map<string, { expires: number; value: PortalDepartment }>();

// The hostname is mapped in the database. A query parameter or caller-supplied
// department header must never choose the database used for a request.
export async function resolvePortalDepartment(host: string): Promise<PortalDepartment> {
  host = host.toLowerCase().split(':')[0];
  const cached = portals.get(host);
  if (cached && cached.expires > Date.now()) return cached.value;
  const client = await getSupabaseSystemClient();
  const { data, error } = await client.rpc('department_portal_for_host', { p_host: host.toLowerCase().split(':')[0] });
  if (error || !data?.id) throw new Error('This department portal has not been published.');
  const value = data as PortalDepartment;
  if (portals.size > 100) portals.clear();
  portals.set(host, { expires: Date.now() + 60000, value });
  return value;
}

export async function getPortalDepartment() {
  const requestHeaders = await headers();
  return resolvePortalDepartment(requestHeaders.get('host') ?? '');
}
