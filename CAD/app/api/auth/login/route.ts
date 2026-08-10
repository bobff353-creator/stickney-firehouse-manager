import { ensureDatabase } from "../../../../lib/bootstrap";
import { get, run } from "../../../../lib/db";
import { createSessionCookie, SESSION_COOKIE, sessionCookieMaxAge, verifyPassword } from "../../../../lib/auth";

type Dispatcher = { id: string; email: string; name: string; role: string; passwordSalt: string; passwordHash: string; active: number };

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const body = await request.json().catch(() => ({})) as { email?: unknown; password?: unknown };
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!email || !password) return Response.json({ error: "Email and password are required." }, { status: 400 });

    const dispatcher = await get<Dispatcher>(
      "SELECT id, email, name, role, password_salt AS passwordSalt, password_hash AS passwordHash, active FROM dispatchers WHERE email = ? LIMIT 1",
      [email],
    );
    // Verify against the stored hash (or a throwaway when the user is unknown) so
    // response timing does not reveal whether an email exists.
    const ok = dispatcher && dispatcher.active
      ? await verifyPassword(password, dispatcher.passwordSalt, dispatcher.passwordHash)
      : (await verifyPassword(password, "00", "00"), false);
    if (!dispatcher || !ok) return Response.json({ error: "Invalid email or password." }, { status: 401 });

    await run("UPDATE dispatchers SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", [dispatcher.id]);
    const cookie = await createSessionCookie({ uid: dispatcher.id, email: dispatcher.email, name: dispatcher.name, role: dispatcher.role === "admin" ? "admin" : "dispatcher" });
    const response = Response.json({ ok: true, dispatcher: { email: dispatcher.email, name: dispatcher.name, role: dispatcher.role } });
    response.headers.append(
      "set-cookie",
      `${SESSION_COOKIE}=${cookie}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionCookieMaxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    );
    return response;
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Sign-in failed." }, { status: 500 });
  }
}
