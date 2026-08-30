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
type LoginAuditOutcome = "success" | "failed_pin" | "session_failure" | "unlock_failure";

async function repairLegacyPassword(email: string, pin: string, departmentId: string) {
  const { url, key } = getPublicSupabaseConfig();
  const password = derivePortalPassword(email, pin);
  const response = await fetch(`${url}/functions/v1/portal-pin-session`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, pin, departmentId, password }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => ({})) as { ok?: boolean };
  return payload.ok ? password : null;
}

function cleanSecret(value: string | undefined) {
  return value?.replace(/^[\s"']+|[\s"']+$/g, "") ?? "";
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({})) as { email?: unknown; pin?: unknown };
  const email = String(payload.email ?? "").trim().toLowerCase();
  const pin = String(payload.pin ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{4,6}$/.test(pin)) {
    return Response.json({ error: "Enter your account email and 4 to 6 digit PIN." }, { status: 400 });
  }

  const departmentId = process.env.PAYROLL_DEPARTMENT_ID?.trim() ?? "";
  const databaseSecret = cleanSecret(process.env.FIREHOUSE_DATABASE_SECRET);
  if (!departmentId || !databaseSecret || !process.env.PORTAL_PIN_PASSWORD_PEPPER?.trim()) {
    return Response.json({ error: "PIN login is not configured." }, { status: 503 });
  }

  const database = createPostgresD1Adapter(getSupabaseSystemClient, "firehouse_server_sql", databaseSecret);
  const recordLoginAudit = async (outcome: LoginAuditOutcome) => {
    try {
      await database.prepare(
        "INSERT INTO portal_login_audit (department_id, outcome, occurred_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
      ).bind(departmentId, outcome).run();
    } catch {
      // Audit storage must never disclose credentials or block a member from signing in.
    }
  };
  const check = await database.prepare(
    "SELECT ok, email, locked_until AS lockedUntil FROM verify_portal_login(?, ?, ?)",
  ).bind(email, pin, departmentId).first<LoginCheck>();
  if (!check?.ok || !check.email) {
    await recordLoginAudit("failed_pin");
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
  let password = derivePortalPassword(check.email, pin);
  let { data: signIn, error: signInError } = await client.auth.signInWithPassword({ email: check.email, password });
  if (signInError || !signIn.user) {
    const repairedPassword = await repairLegacyPassword(check.email, pin, departmentId);
    if (!repairedPassword) {
      await recordLoginAudit("session_failure");
      return Response.json({ error: "Your PIN is correct, but the account session could not be repaired. Try again." }, { status: 503 });
    }
    password = repairedPassword;
    ({ data: signIn, error: signInError } = await client.auth.signInWithPassword({ email: check.email, password }));
    if (signInError || !signIn.user) {
      await recordLoginAudit("session_failure");
      return Response.json({ error: "Your PIN is correct, but sign-in could not be completed. Try again." }, { status: 503 });
    }
  }

  const { data: verified, error: verifyError } = await client.rpc("verify_portal_pin", { p_pin: pin });
  const result = Array.isArray(verified) ? verified[0] as { ok?: boolean; unlock_token?: string } | undefined : undefined;
  if (verifyError || !result?.ok || !result.unlock_token) {
    await recordLoginAudit("unlock_failure");
    return Response.json({ error: "The PIN could not unlock department records." }, { status: 401 });
  }

  await recordLoginAudit("success");

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
