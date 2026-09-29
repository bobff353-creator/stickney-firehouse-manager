import 'server-only';
import { createPostgresD1Adapter } from '../db/postgres-adapter';
import { getSupabaseSystemClient } from './supabase-system';
import { portalServerHeaders } from './portal-server-headers';

// Only trusted server jobs may use this connection. Authenticate the caller first.
export function backgroundDatabase() {
  return createPostgresD1Adapter(getSupabaseSystemClient, 'firehouse_server_sql', portalServerHeaders()['x-firehouse-server-key']);
}
