import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { portalServerHeaders } from "../portal-server-headers";
import { getPublicSupabaseConfig } from "../supabase-config";

export async function createInventorySupabaseClient() {
  const cookieStore = await cookies();
  // Inventory must use the same project as portal authentication and payroll.
  // Keep the connection in one place so a verified project migration cannot
  // leave apparatus checks writing to the previous database.
  const { url, key } = getPublicSupabaseConfig();
  return createServerClient(url, key, {
    global: { headers: portalServerHeaders() },
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
