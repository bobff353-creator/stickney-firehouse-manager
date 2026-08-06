import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createPostgresD1Adapter } from "../../../../db/postgres-adapter";
import { derivePortalPassword } from "../../../lib/portal-pin-password";
import { getSupabaseAdminClient } from "../../../supabase-admin";
import { getPublicSupabaseConfig } from "../../../supabase-config";
import { getSupabaseSystemClient } from "../../../supabase-system";

const pinCookie = "__Secure-firehouse-pin";
const unlockSeconds = 30 * 60;

type PendingCookie = { name: string; value: string; options: CookieOptions };
type EmployeeActivation = {
  name: string;
  employeeNumber: string;
  isAdmin: number;
};
type AttemptStatus = { failedAttempts?: number; lockedUntil?: string | null };

function cleanSecret(value: string | undefined) {
  return value?.replace(/^[\s"']+|[\s"']+$/g, "") ?? "";
}

function safeMatch(expected: string, supplied: string) {
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({})) as {
    email?: unknown;
    employeeNumber?: unknown;
    pin?: unknown;
  };
  const email = String(payload.email ?? "").trim().toLowerCase();
  const employeeNumber = String(payload.employeeNumber ?? "").trim();
  const pin = String(payload.pin ?? "").trim();
  if (!/^[^\s@]+@stickneyfire\.com$/.test(email)
      || !/^\d{4,6}$/.test(employeeNumber)
      || !/^\d{4,6}$/.test(pin)) {
    return Response.json({ error: "Enter your Stickney email, employee number, and a new 4 to 6 digit PIN." }, { status: 400 });
  }
  if (employeeNumber === pin) {
    return Response.json({ error: "Choose a private PIN that is different from your employee number." }, { status: 400 });
  }

  const departmentId = process.env.PAYROLL_DEPARTMENT_ID?.trim() ?? "";
  const databaseSecret = cleanSecret(process.env.FIREHOUSE_DATABASE_SECRET);
  if (!departmentId || !databaseSecret || !process.env.PORTAL_PIN_PASSWORD_PEPPER?.trim()) {
    return Response.json({ error: "Secure employee activation is not configured." }, { status: 503 });
  }
  let admin;
  try {
    admin = getSupabaseAdminClient();
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Secure employee activation is not configured." }, { status: 503 });
  }

  const database = createPostgresD1Adapter(getSupabaseSystemClient, "firehouse_server_sql", databaseSecret);
  const attempt = await database.prepare(
    "SELECT failed_attempts AS failedAttempts, locked_until AS lockedUntil FROM portal_activation_attempts WHERE lower(email)=? LIMIT 1",
  ).bind(email).first<AttemptStatus>();
  if (attempt?.lockedUntil && new Date(attempt.lockedUntil).getTime() > Date.now()) {
    return Response.json({ error: "Too many activation attempts. Wait 15 minutes and try again." }, { status: 429 });
  }

  const employee = await database.prepare(
    "SELECT e.name,TRIM(COALESCE(p.employee_number,'')) AS employeeNumber,COALESCE(p.is_admin,0) AS isAdmin FROM employees e JOIN employee_profiles p ON p.employee_id=e.id WHERE e.active=1 AND lower(trim(p.email))=? LIMIT 1",
  ).bind(email).first<EmployeeActivation>();
  if (!employee || !safeMatch(employee.employeeNumber, employeeNumber)) {
    await database.prepare(
      "INSERT INTO portal_activation_attempts(email,failed_attempts,locked_until,updated_at) VALUES(?,1,NULL,now()) ON CONFLICT(email) DO UPDATE SET failed_attempts=CASE WHEN portal_activation_attempts.failed_attempts+1>=5 THEN 0 ELSE portal_activation_attempts.failed_attempts+1 END,locked_until=CASE WHEN portal_activation_attempts.failed_attempts+1>=5 THEN now() + interval '15 minutes' ELSE NULL END,updated_at=now()",
    ).bind(email).run();
    return Response.json({ error: "That email and employee number do not match an active employee record." }, { status: 401 });
  }

  const password = derivePortalPassword(email, pin);
  const usersResult = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersResult.error) return Response.json({ error: "Employee activation is temporarily unavailable." }, { status: 503 });
  let authUser = usersResult.data.users.find((candidate) => candidate.email?.toLowerCase() === email);
  if (authUser) {
    const { data: existingPin, error: pinLookupError } = await admin
      .from("portal_pin_credentials")
      .select("user_id")
      .eq("user_id", authUser.id)
      .maybeSingle();
    if (pinLookupError) return Response.json({ error: "Employee activation could not be checked." }, { status: 503 });
    if (existingPin) {
      return Response.json({ error: "This account is already activated. Return to Sign In and use your private PIN." }, { status: 409 });
    }
  }
  if (authUser) {
    const updated = await admin.auth.admin.updateUserById(authUser.id, {
      password,
      email_confirm: true,
      user_metadata: { ...authUser.user_metadata, portal_pin_password_version: 1 },
    });
    if (updated.error || !updated.data.user) {
      return Response.json({ error: "The employee login could not be activated." }, { status: 503 });
    }
    authUser = updated.data.user;
  } else {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { portal_pin_password_version: 1 },
    });
    if (created.error || !created.data.user) {
      return Response.json({ error: "The employee login could not be created." }, { status: 503 });
    }
    authUser = created.data.user;
  }

  const { data: unlockToken, error: activationError } = await admin.rpc("activate_roster_portal_user", {
    p_user_id: authUser.id,
    p_email: email,
    p_department_id: departmentId,
    p_role: employee.isAdmin ? "admin" : "user",
    p_pin: pin,
  });
  if (activationError || typeof unlockToken !== "string" || !unlockToken) {
    return Response.json({ error: "The employee account was created, but its private PIN could not be activated. Try again." }, { status: 503 });
  }
  await database.prepare("DELETE FROM portal_activation_attempts WHERE lower(email)=?").bind(email).run();

  const cookieStore = await cookies();
  const pendingCookies: PendingCookie[] = [];
  const { url, key } = getPublicSupabaseConfig();
  const sessionClient = createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (updates) => { pendingCookies.push(...updates); },
    },
  });
  const { data: signIn, error: signInError } = await sessionClient.auth.signInWithPassword({ email, password });
  if (signInError || !signIn.user) {
    return Response.json({ error: "Your login was created. Return to Sign In and use your new PIN." }, { status: 409 });
  }

  const response = NextResponse.json({ ok: true, email, employeeName: employee.name }, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
  for (const update of pendingCookies) response.cookies.set(update.name, update.value, update.options);
  response.cookies.set(pinCookie, unlockToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: unlockSeconds,
  });
  return response;
}
