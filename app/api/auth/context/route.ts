import { headers } from "next/headers";

export async function GET() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const departmentId = requestHeaders.get("x-department-id");
  const role = requestHeaders.get("x-department-role");
  const pinConfigured = requestHeaders.get("x-portal-pin-configured") === "true";
  const pinUnlocked = requestHeaders.get("x-portal-pin-unlocked") === "true";
  if (!email || !departmentId) {
    return Response.json({ error: "An approved department account is required." }, { status: 401 });
  }
  const response = Response.json(
    { email, departmentId, role: role || "member", pinConfigured, pinUnlocked },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
  response.headers.append(
    "Set-Cookie",
    "__Secure-firehouse-access=verified; Path=/; Max-Age=300; SameSite=Lax; Secure",
  );
  return response;
}
