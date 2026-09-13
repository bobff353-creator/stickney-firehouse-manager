export const rememberedDeviceSeconds = 7 * 24 * 60 * 60;
export const isRememberedDeviceToken = (token: string) => /^rd1_[a-f0-9]{64}$/.test(token);

export function rememberedCookieSeconds(token: string, deadline: unknown): number {
  if (!isRememberedDeviceToken(token) || typeof deadline !== "string") return 0;
  const seconds = Math.floor((Date.parse(deadline) - Date.now()) / 1000);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, rememberedDeviceSeconds) : 0;
}

/** Server-confirmed duration only. Browser preferences and clocks never authorize access. */
export function rememberedDeviceRemainingMs(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  const payload = value as { rememberedUntil?: unknown; serverNow?: unknown };
  if (typeof payload.rememberedUntil !== "string" || typeof payload.serverNow !== "string") return 0;
  const remaining = Date.parse(payload.rememberedUntil) - Date.parse(payload.serverNow);
  return Number.isFinite(remaining) && remaining > 0 && remaining <= rememberedDeviceSeconds * 1000 ? remaining : 0;
}
