import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig } from "./supabase-config";

/**
 * Server-only Supabase client for trusted integrations such as the signed
 * Resend webhook. This client deliberately does not read or persist a member
 * session. Database authorization is supplied separately through the signed
 * integration RPC, so a browser cookie can never replace it.
 */
export async function getSupabaseSystemClient() {
  const { url, key } = getPublicSupabaseConfig();
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
