import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = "https://ukpdacqjmhvlhmrwxtcx.supabase.co";
const supabasePublishableKey = "sb_publishable_HY1UlYHvPnvDIuq_N_X_Sg_xu7bxTzs";

export async function createInventorySupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabasePublishableKey, {
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
          // Server Components cannot write cookies. The proxied portal refreshes
          // the shared Supabase session before the Inventory page is opened.
        }
      },
    },
  });
}
