import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseConfig } from "./app/supabase-config";

const publicApiPaths = new Set([
  "/api/close-call-news",
  "/api/river-gauge",
  "/api/usfa-fatalities",
  "/api/weather",
]);

const signedWebhookPaths = new Set([
  "/api/dispatch-bridge",
  "/api/resend-dispatch",
  "/api/admin/migration-export",
  "/api/auth/send-email-hook",
]);

const publicAuthPostPaths = new Set([
  "/api/auth/activate",
  "/api/auth/login",
]);

const pinSetupPaths = new Set([
  "/api/auth/context",
  "/api/auth/pin",
]);

function configuration() {
  const { url, key } = getPublicSupabaseConfig();
  const departmentId = process.env.PAYROLL_DEPARTMENT_ID?.trim();
  return { url, key, departmentId };
}

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const signedWebhookRequest = request.method === "POST"
    && (signedWebhookPaths.has(pathname) || pathname === "/api/cad/cis");
  const publicAuthRequest = request.method === "POST" && publicAuthPostPaths.has(pathname);
  if (publicApiPaths.has(pathname) || signedWebhookRequest || publicAuthRequest) {
    return NextResponse.next();
  }

  const { url, key, departmentId } = configuration();
  if (!url || !key || !departmentId) {
    return jsonError("Verified department sign-in is not configured.", 503);
  }

  let response = NextResponse.next({ request });
  const requestHeaders = new Headers(request.headers);
  const client = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: userResult, error: userError } = await client.auth.getUser();
  const user = userResult.user;
  if (userError || !user?.email) {
    return jsonError("Your session has expired. Sign in again.", 401);
  }

  const [membershipResult, ownerResult] = await Promise.all([
    client
      .from("department_memberships")
      .select("role,status")
      .eq("department_id", departmentId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle(),
    client.rpc("is_platform_owner"),
  ]);
  if (membershipResult.error || ownerResult.error) {
    return jsonError("Department authorization could not be verified.", 503);
  }

  const isOwner = ownerResult.data === true;
  let membership = membershipResult.data as { role?: string } | null;
  if (!membership && !isOwner) {
    // Confirmation links can legitimately return to either the dedicated invite
    // page or the app root, depending on the email template/provider. Redeem a
    // matching, unexpired administrator invitation before denying access.
    await client.rpc("accept_department_invite");
    const membershipRetry = await client
      .from("department_memberships")
      .select("role,status")
      .eq("department_id", departmentId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (membershipRetry.error) {
      return jsonError("Department authorization could not be verified.", 503);
    }
    membership = membershipRetry.data as { role?: string } | null;
  }
  if (!membership && !isOwner) {
    return jsonError(
      "Your email is confirmed. A department administrator must approve access before records can open.",
      403,
    );
  }

  const unlockToken = request.cookies.get("__Secure-firehouse-pin")?.value ?? "";
  const { data: pinRows, error: pinError } = await client.rpc("portal_pin_status", {
    p_unlock_token: unlockToken || null,
  });
  if (pinError) return jsonError("Portal PIN security could not be verified.", 503);
  const pinStatus = (Array.isArray(pinRows) ? pinRows[0] : pinRows) as { configured?: boolean; unlocked?: boolean } | null;
  const pinConfigured = Boolean(pinStatus?.configured);
  const pinUnlocked = !pinConfigured || Boolean(pinStatus?.unlocked);
  if (!pinUnlocked && !pinSetupPaths.has(pathname)) {
    return jsonError("Enter your portal PIN to unlock department records.", 423);
  }

  requestHeaders.set("oai-authenticated-user-email", user.email.toLowerCase());
  requestHeaders.set("x-department-id", departmentId);
  requestHeaders.set("x-department-role", isOwner ? "owner" : membership?.role || "member");
  requestHeaders.set("x-portal-pin-configured", String(pinConfigured));
  requestHeaders.set("x-portal-pin-unlocked", String(pinUnlocked));
  response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
