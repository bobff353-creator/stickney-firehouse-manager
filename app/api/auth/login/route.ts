import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createPostgresD1Adapter } from "../../../../db/postgres-adapter";
import { derivePortalPassword } from "../../../lib/portal-pin-password";
import { getPublicSupabaseConfig } from "../../../supabase-config";
import { getSupabaseSystemClient } from "../../../supabase-system";

const pinCookie = "__Secure-firehouse-pin";
const unlockSeconds = 30 * 60;

type PendingCookie = { name: string; value: string; options: CookieOptions };
type LoginCheck = { ok?: boolean; email?: string; lockedUntil?: string | null };

function cleanSecret(value: string | undefined) {
  return value?.replace(/^[\s"']+|[\s"']+$/g, "") ?? "";
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({})) as { email?: unknown; pin?: unknown };
  const email = String(payload.email ?? "").trim().toLowerCase();
  const pin = String(payload.pin ?? "").trim();
  if (!/^[^\s@]+@stickneyfire\.com$/.test(email) || !/^\d{4,6}$/.test(pin)) {
    return Response.json({ error: "Enter your Stickney email and 4 to 6 digit PIN." }, { status: 400 });
  }

  const departmentId = process.env.PAYROLL_DEPARTMENT_ID?.trim() ?? "";
  const databaseSecret = cleanSecret(process.env.FIREHOUSE_DATABASE_SECRET);
  if (!departmentId || !databaseSecret || !process.env.PORTAL_PIN_PASSWORD_PEPPER?.trim()) {
    return Response.json({ error: "PIN login is not configured." }, { status: 503 });
  }

  const database = createPostgresD1Adapter(getSupabaseSystemClient, "firehouse_server_sql", databaseSecret);
  const check = await database.prepare(
    "SELECT ok, email, locked_until AS lockedUntil FROM verify_portal_login(?, ?, ?)",
  ).bind(email, pin, departmentId).first<LoginCheck>();
  if (!check?.ok || !check.email) {
    return Response.json(
      {
        error: check?.lockedUntil
          ? `Too many attempts. Try again after ${new Date(check.lockedUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`
          : "That email or PIN is not correct.",
      },
      { status: check?.lockedUntil ? 429 : 401 },
    );
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
  const password = derivePortalPassword(check.email, pin);
  const { data: signIn, error: signInError } = await client.auth.signInWithPassword({ email: check.email, password });
  if (signInError || !signIn.user) {
    return Response.json({ error: "This account needs its one-time PIN upgrade link before direct PIN login." }, { status: 409 });
  }

  const { data: verified, error: verifyError } = await client.rpc("verify_portal_pin", { p_pin: pin });
  const result = Array.isArray(verified) ? verified[0] as { ok?: boolean; unlock_token?: string } | undefined : undefined;
  if (verifyError || !result?.ok || !result.unlock_token) {
    return Response.json({ error: "The PIN could not unlock department records." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, email: check.email }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
  for (const update of pendingCookies) response.cookies.set(update.name, update.value, update.options);
  response.cookies.set(pinCookie, result.unlock_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: unlockSeconds,
  });
  return response;
}
