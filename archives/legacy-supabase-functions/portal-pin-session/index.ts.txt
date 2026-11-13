import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.8";

const jsonHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Type": "application/json",
};

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed." }), { status: 405, headers: jsonHeaders });
  }

  const payload = await request.json().catch(() => ({})) as {
    email?: unknown;
    pin?: unknown;
    departmentId?: unknown;
    password?: unknown;
  };
  const email = String(payload.email ?? "").trim().toLowerCase();
  const pin = String(payload.pin ?? "").trim();
  const departmentId = String(payload.departmentId ?? "").trim();
  const password = String(payload.password ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || !/^\d{4,6}$/.test(pin)
      || !/^[0-9a-f-]{36}$/.test(departmentId)
      || !/^SfdPin1![0-9a-f]{64}$/.test(password)) {
    return new Response(JSON.stringify({ error: "Invalid sign-in request." }), { status: 400, headers: jsonHeaders });
  }

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Sign-in repair is unavailable." }), { status: 503, headers: jsonHeaders });
  }
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await admin.rpc("verify_portal_pin_for_login", {
    p_email: email,
    p_pin: pin,
    p_department_id: departmentId,
  });
  const result = (Array.isArray(data) ? data[0] : data) as {
    ok?: boolean;
    user_id?: string;
    email?: string;
    locked_until?: string | null;
  } | null;
  if (error || !result?.ok || !result.user_id || result.email?.toLowerCase() !== email) {
    return new Response(JSON.stringify({ error: "That email or PIN is not correct." }), {
      status: result?.locked_until ? 429 : 401,
      headers: jsonHeaders,
    });
  }

  const updated = await admin.auth.admin.updateUserById(result.user_id, {
    password,
    email_confirm: true,
  });
  if (updated.error || !updated.data.user) {
    return new Response(JSON.stringify({ error: "The account session could not be repaired." }), { status: 503, headers: jsonHeaders });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders });
});
