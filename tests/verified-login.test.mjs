import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const gateway = readFileSync(new URL("../app/auth-gateway.tsx", import.meta.url), "utf8");
const sessionIdleLock = readFileSync(new URL("../app/session-idle-lock.tsx", import.meta.url), "utf8");
const inventoryPage = readFileSync(new URL("../app/inventory/page.tsx", import.meta.url), "utf8");
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

test("verified invited email login requires confirmation and department approval", () => {
  assert.match(gateway, /Firehouse Manager/);
  assert.match(gateway, /signInWithPassword/);
  assert.doesNotMatch(gateway, /auth\.signUp/);
  assert.match(gateway, /signInWithOtp/);
  assert.match(gateway, /shouldCreateUser: false/);
  assert.match(gateway, /emailRedirectTo/);
  assert.match(gateway, /department administrator must approve access/i);
  assert.match(confirmation, /exchangeCodeForSession/);
  assert.match(confirmation, /verifyOtp/);
});

test("recently verified access stays mounted during silent token revalidation", () => {
  assert.match(authContext, /__Secure-firehouse-access=verified/);
  assert.match(page, /recentlyVerified/);
  assert.match(gateway, /initiallyVerified \? "authorized" : "loading"/);
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

test("administrators send employee-bound invitations that confirm email before PIN setup", () => {
  assert.match(inviteRoute, /hasPermission\(request, db, "employees\.manage"\)/);
  assert.match(inviteRoute, /employee_profiles/);
  assert.match(inviteRoute, /department_invites/);
  assert.match(inviteRoute, /signInWithOtp/);
  assert.match(inviteRoute, /shouldCreateUser: true/);
  assert.match(inviteRoute, /next", "\/accept-invite"/);
  assert.doesNotMatch(inviteRoute, /service_role|SUPABASE_SERVICE_ROLE|secret[_ -]?key/i);
  assert.match(acceptInvite, /accept_department_invite/);
  assert.match(acceptInvite, /pattern="\[0-9\]\{4,6\}"/);
  assert.match(acceptInvite, /action: "set"/);
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
