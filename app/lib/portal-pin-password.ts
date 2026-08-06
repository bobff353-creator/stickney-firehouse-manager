import "server-only";
import { createHmac } from "node:crypto";

export function derivePortalPassword(email: string, pin: string) {
  const pepper = process.env.PORTAL_PIN_PASSWORD_PEPPER?.trim();
  if (!pepper) throw new Error("PIN login is not configured.");
  const normalizedEmail = email.trim().toLowerCase();
  const digest = createHmac("sha256", pepper)
    .update(`stickney-firehouse-manager:portal-pin:v1\0${normalizedEmail}\0${pin}`)
    .digest("hex");
  return `SfdPin1!${digest}`;
}
