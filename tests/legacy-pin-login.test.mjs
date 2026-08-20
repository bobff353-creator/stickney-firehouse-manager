import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const gateway = readFileSync(new URL("../app/auth-gateway.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/auth/legacy-pin-login/route.ts", import.meta.url), "utf8");
const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");

test("existing portal PIN accounts retain direct sign-in after the password UI migration", () => {
  assert.match(gateway, /\/api\/auth\/legacy-pin-login/);
  assert.match(gateway, /Portal PIN or password/);
  assert.match(route, /derivePortalPassword\(email, pin\)/);
  assert.match(route, /signInWithPassword\(\{ email, password \}\)/);
});

test("legacy PIN login supports both department and owner account email domains", () => {
  assert.match(route, /\[\^\\s@\]\+@\[\^\\s@\]\+/);
  assert.doesNotMatch(route, /@stickneyfire\\\.com/);
});

test("only POST requests to the legacy PIN route bypass session middleware", () => {
  assert.match(proxy, /publicAuthPostPaths/);
  assert.match(proxy, /request\.method === "POST" && publicAuthPostPaths\.has\(pathname\)/);
});
