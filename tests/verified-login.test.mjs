import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const gateway = readFileSync(new URL("../app/auth-gateway.tsx", import.meta.url), "utf8");
const payrollApp = readFileSync(new URL("../app/payroll-app.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
const confirmation = readFileSync(new URL("../app/auth/confirm/route.ts", import.meta.url), "utf8");
const authContext = readFileSync(new URL("../app/api/auth/context/route.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

test("verified email and password login requires confirmation and department approval", () => {
  assert.match(gateway, /Firehouse Manager/);
  assert.match(gateway, /signInWithPassword/);
  assert.match(gateway, /auth\.signUp/);
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
