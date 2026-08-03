import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig } from "./supabase-config";

let client: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  const { url, key } = getPublicSupabaseConfig();
  if (!client) client = createBrowserClient(url, key);
  return client;
}
