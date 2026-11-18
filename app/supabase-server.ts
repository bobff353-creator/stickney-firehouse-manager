import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { getPublicSupabaseConfig } from "./supabase-config";
import { portalServerHeaders } from "./portal-server-headers";
import { powerAppsSessionClient } from './power-apps-session';

// Next supplies a distinct cookie store for each request. Reuse verification
// within that request without retaining another member's session globally.
const powerAppsClients = new WeakMap<object, ReturnType<typeof powerAppsSessionClient>>();

export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  const { url, key } = getPublicSupabaseConfig();
  let pending = powerAppsClients.get(cookieStore);
  if (!pending) {
    pending = powerAppsSessionClient({ headers: await headers() }, url, key, portalServerHeaders());
    powerAppsClients.set(cookieStore, pending);
  }
  const member = await pending;
  if (member) return member.client;
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
          // proxy.ts refreshes cookies when a Server Component cannot write them.
        }
      },
    },
  });
}
