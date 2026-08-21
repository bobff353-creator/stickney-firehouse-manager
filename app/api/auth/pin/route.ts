import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { ensureDatabase } from "../../../../db/bootstrap";
import { createPostgresD1Adapter } from "../../../../db/postgres-adapter";
import { derivePortalPassword } from "../../../lib/portal-pin-password";
import { getSupabaseServerClient } from "../../../supabase-server";
import { getSupabaseSystemClient } from "../../../supabase-system";

const pinCookie = "__Secure-firehouse-pin";
const unlockSeconds = 30 * 60;

type AttemptStatus = { lockedUntil?: string | null };

function cleanSecret(value: string | undefined) {
  return value?.replace(/^[\s"']+|[\s"']+$/g, "") ?? "";
}

function safeMatch(expected: string, supplied: string) {
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

function withUnlockCookie(payload: object, token: string) {
  const response = NextResponse.json(payload, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
  response.cookies.set(pinCookie, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: unlockSeconds,
  });
  return response;
}

async function syncPasswordLogin(client: Awaited<ReturnType<typeof getSupabaseServerClient>>, email: string, pin: string) {
  const password = derivePortalPassword(email, pin);
  const { error } = await client.auth.updateUser({
    password,
    data: { portal_pin_password_version: 1 },
  });
  return error;
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({})) as { action?: string; pin?: string; temporaryPin?: string };
  const action = payload.action === "set" || payload.action === "activate" || payload.action === "reset" ? payload.action : "verify";
  const pin = String(payload.pin ?? "").trim();
  if (!/^\d{4,6}$/.test(pin)) {
    return Response.json({ error: "Enter a 4 to 6 digit PIN." }, { status: 400 });
  }

  const client = await getSupabaseServerClient();
  if (action === "activate" || action === "reset") {
    const temporaryPin = String(payload.temporaryPin ?? "").trim();
    if (!/^\d{4,6}$/.test(temporaryPin)) {
      return Response.json({ error: "Enter your 4 to 6 digit employee number as the temporary PIN." }, { status: 400 });
    }
    if (temporaryPin === pin) {
      return Response.json({ error: "Choose a new private PIN that is different from your employee number." }, { status: 400 });
    }
    const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
    const databaseSecret = cleanSecret(process.env.FIREHOUSE_DATABASE_SECRET);
    if (!email || (action === "reset" && !databaseSecret)) {
      return Response.json({ error: "Secure PIN reset is not configured." }, { status: 503 });
    }
    const db = action === "reset"
      ? createPostgresD1Adapter(getSupabaseSystemClient, "firehouse_server_sql", databaseSecret)
      : await ensureDatabase();
    if (action === "reset") {
      const attempt = await db.prepare(
        "SELECT locked_until AS lockedUntil FROM portal_activation_attempts WHERE lower(email)=? LIMIT 1",
      ).bind(email).first<AttemptStatus>();
      if (attempt?.lockedUntil && new Date(attempt.lockedUntil).getTime() > Date.now()) {
        return Response.json({ error: "Too many reset attempts. Wait 15 minutes and try again." }, { status: 429 });
      }
    }
    const employee = email ? await db.prepare(
      "SELECT TRIM(COALESCE(p.employee_number,'')) AS employeeNumber FROM employees e JOIN employee_profiles p ON p.employee_id=e.id WHERE e.active=1 AND lower(trim(p.email))=? LIMIT 1",
    ).bind(email).first<{ employeeNumber: string }>() : null;
    const expected = employee?.employeeNumber ?? "";
    const matches = safeMatch(expected, temporaryPin);
    if (!matches) {
      if (action === "reset") {
        await db.prepare(
          "INSERT INTO portal_activation_attempts(email,failed_attempts,locked_until,updated_at) VALUES(?,1,NULL,now()) ON CONFLICT(email) DO UPDATE SET failed_attempts=CASE WHEN portal_activation_attempts.failed_attempts+1>=5 THEN 0 ELSE portal_activation_attempts.failed_attempts+1 END,locked_until=CASE WHEN portal_activation_attempts.failed_attempts+1>=5 THEN now() + interval '15 minutes' ELSE NULL END,updated_at=now()",
        ).bind(email).run();
      }
      return Response.json({ error: "That temporary PIN does not match your employee number. Ask an administrator to verify your employee record." }, { status: 401 });
    }
    if (action === "reset") {
      await db.prepare("DELETE FROM portal_activation_attempts WHERE lower(email)=?").bind(email).run();
    }
  }
  if (action === "set") {
    const { data, error } = await client.rpc("set_portal_pin", { p_pin: pin });
    if (error || typeof data !== "string" || !data) {
      return Response.json({ error: error?.message || "The PIN could not be saved." }, { status: 400 });
    }
    const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
    const passwordError = email ? await syncPasswordLogin(client, email, pin) : new Error("Verified email is unavailable.");
    if (passwordError) {
      return Response.json({ error: "The PIN was saved, but repeat login could not be enabled. Try saving it again." }, { status: 503 });
    }
    return withUnlockCookie({ ok: true, configured: true, unlocked: true }, data);
  }

  if (action === "activate") {
    const { data, error } = await client.rpc("set_portal_pin", { p_pin: pin });
    if (error || typeof data !== "string" || !data) {
      return Response.json({ error: error?.message || "The private PIN could not be saved." }, { status: 400 });
    }
    const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
    const passwordError = email ? await syncPasswordLogin(client, email, pin) : new Error("Verified email is unavailable.");
    if (passwordError) {
      return Response.json({ error: "The private PIN was saved, but repeat login could not be enabled. Try activating it again." }, { status: 503 });
    }
    return withUnlockCookie({ ok: true, configured: true, unlocked: true }, data);
  }

  if (action === "reset") {
    const { data, error } = await client.rpc("set_portal_pin", { p_pin: pin });
    if (error || typeof data !== "string" || !data) {
      return Response.json({ error: "The new PIN could not be saved." }, { status: 400 });
    }
    const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
    const passwordError = email ? await syncPasswordLogin(client, email, pin) : new Error("Verified email is unavailable.");
    if (passwordError) {
      return Response.json({ error: "The PIN was reset, but repeat login could not be enabled. Use the email link and try again." }, { status: 503 });
    }
    return withUnlockCookie({ ok: true, configured: true, unlocked: true }, data);
  }

  const { data, error } = await client.rpc("verify_portal_pin", { p_pin: pin });
  const result = Array.isArray(data) ? data[0] as { ok?: boolean; unlock_token?: string; locked_until?: string | null } | undefined : undefined;
  if (error) return Response.json({ error: "The PIN could not be verified." }, { status: 400 });
  if (!result?.ok || !result.unlock_token) {
    return Response.json(
      {
        error: result?.locked_until
          ? `Too many attempts. Try again after ${new Date(result.locked_until).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`
          : "That PIN is not correct.",
        lockedUntil: result?.locked_until ?? null,
      },
      { status: result?.locked_until ? 429 : 401 },
    );
  }
  const { data: userData } = await client.auth.getUser();
  const passwordVersion = Number(userData.user?.user_metadata?.portal_pin_password_version ?? 0);
  if (passwordVersion < 1 && userData.user?.email) {
    const passwordError = await syncPasswordLogin(client, userData.user.email, pin);
    if (passwordError) {
      return Response.json({ error: "Your PIN is correct, but this older account still needs its one-time login upgrade. Try again from the email link." }, { status: 503 });
    }
  }
  return withUnlockCookie({ ok: true, configured: true, unlocked: true }, result.unlock_token);
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(pinCookie, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function PATCH() {
  const cookieStore = await cookies();
  const token = cookieStore.get(pinCookie)?.value ?? "";
  if (!token) {
    return Response.json({ error: "Enter your portal PIN to continue." }, { status: 423 });
  }

  const client = await getSupabaseServerClient();
  const { data, error } = await client.rpc("portal_pin_status", { p_unlock_token: token });
  const status = (Array.isArray(data) ? data[0] : data) as { configured?: boolean; unlocked?: boolean } | null;
  if (error) {
    return Response.json({ error: "Portal PIN security could not be verified." }, { status: 503 });
  }
  if (!status?.configured) {
    return Response.json({ ok: true, configured: false, unlocked: true });
  }
  if (!status.unlocked) {
    return Response.json({ error: "Enter your portal PIN to continue." }, { status: 423 });
  }
  return withUnlockCookie({ ok: true, configured: true, unlocked: true }, token);
}
