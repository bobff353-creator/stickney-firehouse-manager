import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "../../../supabase-server";

const pinCookie = "__Secure-firehouse-pin";
const unlockSeconds = 12 * 60 * 60;

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

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({})) as { action?: string; pin?: string };
  const action = payload.action === "set" ? "set" : "verify";
  const pin = String(payload.pin ?? "").trim();
  if (!/^\d{4,6}$/.test(pin)) {
    return Response.json({ error: "Enter a 4 to 6 digit PIN." }, { status: 400 });
  }

  const client = await getSupabaseServerClient();
  if (action === "set") {
    const { data, error } = await client.rpc("set_portal_pin", { p_pin: pin });
    if (error || typeof data !== "string" || !data) {
      return Response.json({ error: error?.message || "The PIN could not be saved." }, { status: 400 });
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
