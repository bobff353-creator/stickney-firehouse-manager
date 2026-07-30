import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const gateway = readFileSync(new URL("../app/auth-gateway.tsx", import.meta.url), "utf8");
const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
const confirmation = readFileSync(new URL("../app/auth/confirm/route.ts", import.meta.url), "utf8");

test("verified email and password login requires confirmation and department approval", () => {
  assert.match(gateway, /Firehouse Manager/);
  assert.match(gateway, /signInWithPassword/);
  assert.match(gateway, /auth\.signUp/);
  assert.match(gateway, /emailRedirectTo/);
  assert.match(gateway, /department administrator must approve access/i);
  assert.match(confirmation, /exchangeCodeForSession/);
  assert.match(confirmation, /verifyOtp/);
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
