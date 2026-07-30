import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicSupabaseConfig } from "./supabase-config";

export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, key } = getPublicSupabaseConfig();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // proxy.ts refreshes cookies when a Server Component cannot write them.
        }
      },
    },
  });
}
