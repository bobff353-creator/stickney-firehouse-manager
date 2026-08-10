import { NextResponse, type NextRequest } from "next/server";
import { parseCookies, readSessionToken, SESSION_COOKIE } from "./lib/auth";

// Machine endpoints authenticate with their own tokens, not the session cookie.
const machinePaths = ["/api/cad/webhooks", "/api/cad/alarms/signal"];
// Endpoints/pages reachable without a session.
const publicPaths = ["/login", "/api/auth/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (machinePaths.some((path) => pathname.startsWith(path)) || publicPaths.some((path) => pathname === path)) {
    return NextResponse.next();
  }

  const cookies = parseCookies(request.headers.get("cookie"));
  const session = await readSessionToken(cookies[SESSION_COOKIE]);
  if (session) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
