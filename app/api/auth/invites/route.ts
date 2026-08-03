import { createClient } from "@supabase/supabase-js";
import { ensureDatabase } from "../../../../db/bootstrap";
import { hasPermission } from "../../../server-permissions";
import { getPublicSupabaseConfig } from "../../../supabase-config";
import { getSupabaseServerClient } from "../../../supabase-server";

function normalizedEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export async function GET(request: Request) {
  const db = await ensureDatabase();
  if (!await hasPermission(request, db, "employees.manage")) {
    return Response.json({ error: "Employee management permission is required." }, { status: 403 });
  }
  const departmentId = request.headers.get("x-department-id") ?? "";
  const client = await getSupabaseServerClient();
  const { data, error } = await client
    .from("department_invites")
    .select("id,email,role,status,expires_at,created_at,updated_at")
    .eq("department_id", departmentId)
    .order("created_at", { ascending: false });
  if (error) return Response.json({ error: "Invitations could not be loaded." }, { status: 503 });
  return Response.json({ invites: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const db = await ensureDatabase();
  if (!await hasPermission(request, db, "employees.manage")) {
    return Response.json({ error: "Employee management permission is required." }, { status: 403 });
  }
  const payload = await request.json().catch(() => ({})) as { email?: string };
  const email = normalizedEmail(payload.email);
  if (!email) return Response.json({ error: "Enter a valid employee email address." }, { status: 400 });

  const employee = await db.prepare(
    "SELECT e.id,e.name,COALESCE(p.is_admin,0) AS isAdmin FROM employees e JOIN employee_profiles p ON p.employee_id=e.id WHERE e.active=1 AND lower(trim(p.email))=? LIMIT 1",
  ).bind(email).first<{ id: string; name: string; isAdmin: number }>();
  if (!employee) {
    return Response.json({ error: "Save this email on an active employee record before sending an app invite." }, { status: 409 });
  }

  const departmentId = request.headers.get("x-department-id") ?? "";
  if (!departmentId) return Response.json({ error: "Department authorization is unavailable." }, { status: 503 });
  const client = await getSupabaseServerClient();
  const { data: userData } = await client.auth.getUser();
  if (!userData.user) return Response.json({ error: "Your administrator session expired." }, { status: 401 });

  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
  const role = employee.isAdmin ? "admin" : "user";
  const { error: inviteError } = await client.from("department_invites").upsert({
    department_id: departmentId,
    email,
    role,
    status: "pending",
    invited_by: userData.user.id,
    accepted_by: null,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }, { onConflict: "department_id,email" });
  if (inviteError) return Response.json({ error: "The department invitation could not be saved." }, { status: 500 });

  const { url, key } = getPublicSupabaseConfig();
  const mailClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const callback = new URL("/auth/confirm", request.url);
  callback.searchParams.set("next", "/accept-invite");
  const { error: mailError } = await mailClient.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: callback.toString() },
  });
  if (mailError) {
    return Response.json({ error: `The invitation was saved, but the email could not be sent: ${mailError.message}` }, { status: 502 });
  }

  return Response.json({ ok: true, email, employeeName: employee.name, expiresAt });
}
