// Next.js middleware (Vercel). Ported from the vinext `proxy.ts`: it verifies
// the Supabase session and department membership, then injects the identity
// headers (`oai-authenticated-user-email`, `x-department-id`,
// `x-department-role`) that every API route reads.

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
]);

const publicAuthPostPaths = new Set([
  "/api/auth/legacy-pin-login",
]);

// The Supabase URL/key have a known-good fallback baked into
// getPublicSupabaseConfig() specifically so the app keeps working even if
// Vercel's environment variables are missing/misconfigured for a given
// environment — this middleware previously duplicated the same lookup
// without that fallback, which silently broke every request whenever those
// Vercel env vars weren't set, regardless of PAYROLL_DEPARTMENT_ID.
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
  const membership = membershipResult.data as { role?: string } | null;
  if (!membership && !isOwner) {
    return jsonError(
      "Your email is confirmed. A department administrator must approve access before records can open.",
      403,
    );
  }

  requestHeaders.set("oai-authenticated-user-email", user.email.toLowerCase());
  requestHeaders.set("x-department-id", departmentId);
  requestHeaders.set("x-department-role", isOwner ? "owner" : membership?.role || "member");
  response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
