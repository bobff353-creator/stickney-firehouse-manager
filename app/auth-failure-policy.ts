// A network outage is not proof that a session has expired. Only definitive
// authentication failures should discard a login; all other failures fail closed.
export function definitiveAuthFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { status?: number; name?: string; code?: string };
  return value.status === 401 || value.status === 403 || value.name === "AuthSessionMissingError"
    || ["refresh_token_not_found", "refresh_token_already_used", "session_not_found", "session_expired", "bad_jwt"].includes(value.code ?? "");
}

export async function boundedAuthRead<T>(read: Promise<T>, timeoutMs = 10000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([read, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Secure access could not be verified in time.")), timeoutMs);
    })]);
  } finally { clearTimeout(timer); }
}
