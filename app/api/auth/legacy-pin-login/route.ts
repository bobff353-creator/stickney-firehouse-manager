import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { derivePortalPassword } from "../../../lib/portal-pin-password";
import { getPublicSupabaseConfig } from "../../../supabase-config";

type PendingCookie = { name: string; value: string; options: CookieOptions };

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({})) as { email?: unknown; pin?: unknown };
  const email = String(payload.email ?? "").trim().toLowerCase();
  const pin = String(payload.pin ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{4,6}$/.test(pin)) {
    return Response.json({ error: "Enter your account email and 4 to 6 digit portal PIN." }, { status: 400 });
  }

  let password: string;
  try {
    password = derivePortalPassword(email, pin);
  } catch {
    return Response.json({ error: "Portal PIN sign-in is temporarily unavailable." }, { status: 503 });
  }

  const cookieStore = await cookies();
  const pendingCookies: PendingCookie[] = [];
  const { url, key } = getPublicSupabaseConfig();
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (updates) => { pendingCookies.push(...updates); },
    },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return Response.json({ error: "That email or portal PIN is not correct." }, { status: 401 });
  }

  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
  for (const update of pendingCookies) response.cookies.set(update.name, update.value, update.options);
  return response;
}
