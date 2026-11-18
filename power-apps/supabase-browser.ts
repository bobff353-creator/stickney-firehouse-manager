import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getPublicSupabaseConfig } from '../app/supabase-config';

let client: SupabaseClient | undefined;
export function getSupabaseBrowserClient() {
  if (!client) {
    const { url, key } = getPublicSupabaseConfig();
    // Code Apps run in a Microsoft frame. Keep the user's standard Supabase
    // session in its own origin's SDK storage, rather than third-party cookies.
    client = createClient(url, key);
  }
  return client;
}
