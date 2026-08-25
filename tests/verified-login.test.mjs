import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const gateway = readFileSync(new URL("../app/auth-gateway.tsx", import.meta.url), "utf8");
const sessionIdleLock = readFileSync(new URL("../app/session-idle-lock.tsx", import.meta.url), "utf8");
const inventoryPage = readFileSync(new URL("../app/inventory/page.tsx", import.meta.url), "utf8");
const inventoryAccessGate = readFileSync(new URL("../app/components/InventoryAccessGate.tsx", import.meta.url), "utf8");
const inventorySession = readFileSync(new URL("../app/lib/inventory-session.ts", import.meta.url), "utf8");
const payrollApp = readFileSync(new URL("../app/payroll-app.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
const confirmation = readFileSync(new URL("../app/auth/confirm/route.ts", import.meta.url), "utf8");
const authContext = readFileSync(new URL("../app/api/auth/context/route.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const inviteRoute = readFileSync(new URL("../app/api/auth/invites/route.ts", import.meta.url), "utf8");
const pinRoute = readFileSync(new URL("../app/api/auth/pin/route.ts", import.meta.url), "utf8");
const acceptInvite = readFileSync(new URL("../app/accept-invite/page.tsx", import.meta.url), "utf8");
const pinMigration = readFileSync(new URL("../supabase/migrations/20260803211245_member_invites_and_pin_unlock.sql", import.meta.url), "utf8");
const emailHook = readFileSync(new URL("../app/api/auth/send-email-hook/route.ts", import.meta.url), "utf8");
const portalPinPassword = readFileSync(new URL("../app/lib/portal-pin-password.ts", import.meta.url), "utf8");
const pinLoginRoute = readFileSync(new URL("../app/api/auth/login/route.ts", import.meta.url), "utf8");
const primaryPinMigration = readFileSync(new URL("../supabase/migrations/20260806160437_portal_pin_primary_login.sql", import.meta.url), "utf8");
const activationRoute = readFileSync(new URL("../app/api/auth/activate/route.ts", import.meta.url), "utf8");
const activationMigration = readFileSync(new URL("../supabase/migrations/20260806164801_roster_pin_self_activation.sql", import.meta.url), "utf8");
const supabaseAdmin = readFileSync(new URL("../app/supabase-admin.ts", import.meta.url), "utf8");

test("verified invited email login confirms once and then uses email plus PIN", () => {
  assert.match(gateway, /Firehouse Manager/);
  assert.match(pinLoginRoute, /signInWithPassword/);
  assert.doesNotMatch(gateway, /auth\.signUp/);
  assert.match(gateway, /signInWithOtp/);
  assert.match(gateway, /shouldCreateUser: false/);
  assert.match(gateway, /emailRedirectTo/);
  assert.match(gateway, /Sign in with email and PIN/);
  assert.match(gateway, /Email me a one-time sign-in link/);
  assert.doesNotMatch(gateway, /Older account only/);
  assert.match(gateway, /fetch\("\/api\/auth\/login"/);
  assert.match(pinLoginRoute, /verify_portal_login/);
  assert.match(pinLoginRoute, /verify_portal_pin/);
  assert.match(portalPinPassword, /import "server-only"/);
  assert.match(portalPinPassword, /createHmac\("sha256", pepper\)/);
  assert.match(portalPinPassword, /PORTAL_PIN_PASSWORD_PEPPER/);
  assert.match(pinRoute, /portal_pin_password_version: 1/);
  assert.match(pinRoute, /syncPasswordLogin/);
  assert.match(gateway, /department administrator must approve access/i);
  assert.match(confirmation, /exchangeCodeForSession/);
  assert.match(confirmation, /verifyOtp/);
});

test("the portal does not render authorized records until the PIN session is verified", () => {
  assert.match(authContext, /__Secure-firehouse-access=verified/);
  assert.match(page, /<AuthGateway \/>/);
  assert.match(gateway, /useState<Mode>\("loading"\)/);
  assert.match(gateway, /checkAccess\(data\.user, true\)/);
  assert.match(gateway, /event === "TOKEN_REFRESHED"/);
  assert.match(gateway, /checkAccess\(session\.user, false\)/);
  assert.match(gateway, /response\.status !== 401 && !blocking/);
  assert.doesNotMatch(gateway, /TOKEN_REFRESHED"\) \{\s*setMode\("checking"\)/);
});

test("verified account sign out lives in the scrolling navigation", () => {
  assert.match(gateway, /accountEmail=\{user\?\.email/);
  assert.match(payrollApp, /className="account-session-bar"/);
  assert.match(payrollApp, /Test as Member/);
  assert.match(styles, /\.account-session-bar \{ margin:/);
  assert.doesNotMatch(styles, /\.account-session-bar \{ position: fixed/);
});

test("protected APIs receive only a server-verified department identity", () => {
  assert.match(proxy, /client\.auth\.getUser/);
  assert.match(proxy, /department_memberships/);
  assert.match(proxy, /PAYROLL_DEPARTMENT_ID/);
  assert.match(proxy, /oai-authenticated-user-email/);
  assert.match(proxy, /x-department-id/);
});

test("signed dispatch webhook paths remain available without an employee session", () => {
  assert.match(proxy, /\/api\/dispatch-bridge/);
  assert.match(proxy, /\/api\/resend-dispatch/);
  assert.match(proxy, /pathname === "\/api\/cad\/cis"/);
  assert.match(proxy, /request\.method === "POST"/);
});

test("PIN sign-in route is public only for POST and keeps derivation server-side", () => {
  assert.match(proxy, /publicAuthPostPaths/);
  assert.match(proxy, /"\/api\/auth\/login"/);
  assert.match(proxy, /request\.method === "POST" && publicAuthPostPaths\.has\(pathname\)/);
  assert.doesNotMatch(gateway, /derivePortalPassword|PORTAL_PIN_PASSWORD_PEPPER/);
  assert.match(pinLoginRoute, /firehouse_server_sql/);
  assert.match(pinLoginRoute, /Too many attempts/);
  assert.match(gateway, /window\.location\.reload\(\)/);
  assert.match(primaryPinMigration, /CREATE OR REPLACE FUNCTION firehouse\.verify_portal_login/);
  assert.match(primaryPinMigration, /extensions\.crypt\(p_pin, credentials\.pin_hash\)/);
  assert.match(primaryPinMigration, /next_failed_attempts >= 5/);
  assert.match(primaryPinMigration, /REVOKE ALL ON FUNCTION firehouse\.verify_portal_login[\s\S]*FROM anon/);
});

test("administrators send employee-bound invitations that confirm email before PIN setup", () => {
  assert.match(inviteRoute, /hasPermission\(request, db, "employees\.manage"\)/);
  assert.match(inviteRoute, /employee_profiles/);
  assert.match(inviteRoute, /department_invites/);
  assert.match(inviteRoute, /signInWithOtp/);
  assert.match(inviteRoute, /shouldCreateUser: true/);
  assert.match(inviteRoute, /next", "\/accept-invite"/);
  assert.match(inviteRoute, /employee_number/);
  assert.match(inviteRoute, /@stickneyfire\.com/);
  assert.match(inviteRoute, /4 to 6 digit Employee #/);
  assert.doesNotMatch(inviteRoute, /service_role|SUPABASE_SERVICE_ROLE|secret[_ -]?key/i);
  assert.match(acceptInvite, /accept_department_invite/);
  assert.match(acceptInvite, /pattern="\[0-9\]\{4,6\}"/);
  assert.match(acceptInvite, /Temporary PIN \(your employee number\)/);
  assert.match(acceptInvite, /action: "activate"/);
  assert.match(pinRoute, /timingSafeEqual/);
});

test("new employees self-activate with roster email and employee number before choosing a PIN", () => {
  assert.match(gateway, /New User — Create Login/);
  assert.match(gateway, /Create your login/);
  assert.match(gateway, /Employee number/);
  assert.match(gateway, /Enter private PIN again/);
  assert.match(gateway, /fetch\("\/api\/auth\/activate"/);
  assert.match(proxy, /"\/api\/auth\/activate"/);
  assert.match(supabaseAdmin, /SUPABASE_SECRET_KEY/);
  assert.match(supabaseAdmin, /decoded\.role === "service_role"/);
  assert.match(supabaseAdmin, /import "server-only"/);
  assert.match(activationRoute, /employee_profiles/);
  assert.match(activationRoute, /timingSafeEqual/);
  assert.match(activationRoute, /portal_activation_attempts/);
  assert.match(activationRoute, /admin\.auth\.admin\.createUser/);
  assert.match(activationRoute, /email_confirm: true/);
  assert.match(activationRoute, /activate_roster_portal_user/);
  assert.match(activationRoute, /signInWithPassword/);
  assert.doesNotMatch(gateway, /SUPABASE_SECRET_KEY|derivePortalPassword/);
  assert.match(activationMigration, /CREATE TABLE IF NOT EXISTS firehouse\.portal_activation_attempts/);
  assert.match(activationMigration, /REVOKE ALL ON TABLE firehouse\.portal_activation_attempts/);
  assert.match(activationMigration, /GRANT EXECUTE ON FUNCTION public\.activate_roster_portal_user[\s\S]*TO service_role/);
  assert.match(activationMigration, /extensions\.crypt\(p_pin, extensions\.gen_salt\('bf', 12\)\)/);
});

test("Supabase authentication emails use the signed Resend hook instead of the two-per-hour demo mailer", () => {
  assert.match(proxy, /\/api\/auth\/send-email-hook/);
  assert.match(emailHook, /new Webhook\(secret\)\.verify/);
  assert.match(emailHook, /SUPABASE_SEND_EMAIL_HOOK_SECRET/);
  assert.match(emailHook, /RESEND_API_KEY/);
  assert.match(emailHook, /AUTH_EMAIL_FROM/);
  assert.doesNotMatch(emailHook, /DISPATCH_EMAIL_FROM/);
  assert.match(emailHook, /https:\/\/api\.resend\.com\/emails/);
  assert.match(emailHook, /\/auth\/v1\/verify/);
});

test("a confirmed administrator invite is redeemed even when the email returns to the app root", () => {
  assert.match(proxy, /if \(!membership && !isOwner\)/);
  assert.match(proxy, /client\.rpc\("accept_department_invite"\)/);
  assert.match(proxy, /const membershipRetry = await client/);
  assert.match(proxy, /membership = membershipRetry\.data/);
  assert.match(proxy, /administrator must approve access before records can open/);
});

test("portal PINs are hashed, attempt-limited, and enforced through a secure unlock cookie", () => {
  assert.match(pinMigration, /crypt\(p_pin, gen_salt\('bf', 12\)\)/);
  assert.match(pinMigration, /next_failed_attempts >= 5/);
  assert.match(pinMigration, /interval '15 minutes'/);
  assert.match(pinMigration, /interval '12 hours'/);
  assert.match(pinMigration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(pinRoute, /httpOnly: true/);
  assert.match(pinRoute, /secure: true/);
  assert.match(pinRoute, /const unlockSeconds = 30 \* 60/);
  assert.match(pinRoute, /export async function PATCH/);
  assert.match(proxy, /portal_pin_status/);
  assert.match(proxy, /records\.", 423\)/);
  assert.match(gateway, /Enter your portal PIN/);
  assert.match(gateway, /if \(!payload\.pinConfigured\)/);
  assert.match(gateway, /setMode\("set-pin"\)/);
  assert.match(gateway, /Your approved account existed before PIN login was added/);
  assert.match(gateway, /action: "set"/);
});

test("verified login card keeps small labels at WCAG AA contrast", () => {
  assert.match(styles, /\.login-card \.login-eyebrow \{ color: #805300; \}/);
  assert.match(styles, /\.login-divider span \{[^}]*color: #596d79;/);
});

test("verified roster members can securely reset a forgotten private PIN", () => {
  assert.match(gateway, /Forgot PIN\? Reset with employee number/);
  assert.match(gateway, /action: "reset"/);
  assert.match(gateway, /Reset PIN and open app/);
  assert.match(pinRoute, /action === "reset"/);
  assert.match(pinRoute, /portal_activation_attempts/);
  assert.match(pinRoute, /Too many reset attempts/);
  assert.match(pinRoute, /timingSafeEqual/);
  assert.match(pinRoute, /client\.rpc\("set_portal_pin"/);
  assert.match(pinRoute, /syncPasswordLogin/);
  assert.doesNotMatch(gateway, /FIREHOUSE_DATABASE_SECRET|PORTAL_PIN_PASSWORD_PEPPER/);
});

test("30 minutes of inactivity locks without unmounting unfinished work", () => {
  assert.match(sessionIdleLock, /const inactivityLimitMs = 30 \* 60 \* 1000/);
  assert.match(sessionIdleLock, /The app locked after 30 minutes without activity\. Your unfinished work is still here\./);
  assert.match(sessionIdleLock, /<div aria-hidden=\{locked\}[\s\S]*\{children\}[\s\S]*\{locked \? <main className="session-lock-overlay"/);
  assert.match(sessionIdleLock, /method: "PATCH"/);
  assert.match(sessionIdleLock, /Unlock and continue/);
  assert.match(gateway, /<SessionIdleLock onSignOut=\{signOut\}>[\s\S]*<PayrollApp/);
  assert.match(inventoryPage, /<SessionIdleLock>[\s\S]*<Inventory360/);
  assert.match(styles, /\.session-lock-overlay \{ position: fixed; inset: 0; z-index: 1000/);
});

test("approved legacy accounts must create a PIN before opening Inventory", () => {
  assert.match(inventorySession, /if \(!pinStatus\?\.configured\)/);
  assert.match(inventorySession, /create your 4 to 6 digit PIN before opening Inventory/);
  assert.match(inventorySession, /status: 423/);
});

test("an authenticated member can unlock an expired PIN session directly from Inventory", () => {
  assert.match(inventoryPage, /status=\{session\.status\}/);
  assert.match(inventoryAccessGate, /status === 423/);
  assert.match(inventoryAccessGate, /fetch\("\/api\/auth\/pin"/);
  assert.match(inventoryAccessGate, /action: "verify"/);
  assert.match(inventoryAccessGate, /Unlock and reopen Inventory/);
  assert.match(inventoryAccessGate, /window\.location\.reload\(\)/);
  assert.doesNotMatch(inventoryAccessGate, /localStorage|sessionStorage/);
});
