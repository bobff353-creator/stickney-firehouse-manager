// Simple, self-contained dispatcher authentication.
//
// Passwords are hashed with PBKDF2 (SHA-256, 100k iterations) and sessions are
// stateless signed cookies (HMAC-SHA256 over a small JSON payload). Everything
// uses Web Crypto (crypto.subtle) so the same code runs in edge middleware and
// in Node route handlers.

const PBKDF2_ITERATIONS = 100_000;
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours
export const SESSION_COOKIE = "cad_session";

export type Session = { uid: string; email: string; name: string; role: "admin" | "dispatcher"; exp: number };

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function fromHex(value: string): Uint8Array {
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16));
}
function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index++) mismatch |= left[index] ^ right[index];
  return mismatch === 0;
}
function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return atob(padded);
}

function sessionSecret(): string {
  return process.env.CAD_SESSION_SECRET?.trim() || "cad-dispatch-development-secret-change-me";
}

// --- Password hashing ---

export async function hashPassword(password: string, saltHex?: string): Promise<{ salt: string; hash: string }> {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" }, key, 256);
  return { salt: toHex(salt), hash: toHex(new Uint8Array(bits)) };
}

export async function verifyPassword(password: string, saltHex: string, expectedHashHex: string): Promise<boolean> {
  if (!saltHex || !expectedHashHex) return false;
  const { hash } = await hashPassword(password, saltHex);
  return constantTimeEqual(fromHex(hash), fromHex(expectedHashHex));
}

// --- Session cookies ---

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(sessionSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  return toHex(signature);
}

export async function createSessionCookie(session: Omit<Session, "exp">): Promise<string> {
  const payload: Session = { ...session, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmac(encoded);
  return `${encoded}.${signature}`;
}

export async function readSessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = await hmac(encoded);
  if (!constantTimeEqual(fromHex(signature), fromHex(expected))) return null;
  try {
    const session = JSON.parse(base64UrlDecode(encoded)) as Session;
    if (!session.exp || session.exp * 1000 < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function parseCookies(header: string | null): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    result[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return result;
}

/** Resolve the signed-in dispatcher from a request's cookies, or null. */
export async function getSession(request: Request): Promise<Session | null> {
  const cookies = parseCookies(request.headers.get("cookie"));
  return readSessionToken(cookies[SESSION_COOKIE]);
}

export const sessionCookieMaxAge = SESSION_TTL_SECONDS;
