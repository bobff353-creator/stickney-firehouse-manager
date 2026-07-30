import { headers } from "next/headers";

export async function GET() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const departmentId = requestHeaders.get("x-department-id");
  const role = requestHeaders.get("x-department-role");
  if (!email || !departmentId) {
    return Response.json({ error: "An approved department account is required." }, { status: 401 });
  }
  return Response.json(
    { email, departmentId, role: role || "member" },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
