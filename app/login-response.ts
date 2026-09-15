export const loginServiceUnavailable =
  "Sign-in is temporarily unavailable. Your email and PIN could not be checked. Please try again shortly.";

export function pinLoginError(status: number, payload: unknown): string {
  // Never report an infrastructure failure as an incorrect PIN or echo server details.
  if (status >= 500) return loginServiceUnavailable;
  const error = payload && typeof payload === "object" && "error" in payload
    && typeof payload.error === "string" ? payload.error.trim() : "";
  if (status === 401) return error || "That email or PIN is not correct.";
  if (status === 429) return error || "Too many sign-in attempts. Please wait before trying again.";
  if (status === 400) return error || "Enter your account email and 4 to 6 digit PIN.";
  return "Sign-in could not be completed. Please try again shortly.";
}
