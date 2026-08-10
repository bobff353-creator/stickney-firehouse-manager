import assert from "node:assert/strict";
import test from "node:test";
import { createSessionCookie, hashPassword, readSessionToken, verifyPassword, parseCookies } from "../lib/auth.ts";

test("password hashing verifies the right password and rejects the wrong one", async () => {
  const { salt, hash } = await hashPassword("correct horse battery staple");
  assert.equal(salt.length, 32, "16-byte salt as hex");
  assert.equal(hash.length, 64, "32-byte hash as hex");
  assert.equal(await verifyPassword("correct horse battery staple", salt, hash), true);
  assert.equal(await verifyPassword("wrong password", salt, hash), false);
  assert.equal(await verifyPassword("correct horse battery staple", "", ""), false);
});

test("session cookies round-trip and reject tampering / expiry", async () => {
  const cookie = await createSessionCookie({ uid: "u1", email: "a@b.co", name: "Alex", role: "admin" });
  const session = await readSessionToken(cookie);
  assert.ok(session);
  assert.equal(session.uid, "u1");
  assert.equal(session.role, "admin");
  assert.ok(session.exp * 1000 > Date.now());

  // Tampered signature is rejected.
  const [payload] = cookie.split(".");
  assert.equal(await readSessionToken(`${payload}.deadbeef`), null);
  // Garbage is rejected.
  assert.equal(await readSessionToken("not-a-cookie"), null);
  assert.equal(await readSessionToken(undefined), null);
});

test("cookie header parsing", () => {
  const cookies = parseCookies("cad_session=abc.def; other=1");
  assert.equal(cookies.cad_session, "abc.def");
  assert.equal(cookies.other, "1");
  assert.deepEqual(parseCookies(null), {});
});
