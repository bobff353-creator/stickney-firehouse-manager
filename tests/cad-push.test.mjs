import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("CAD push payload includes the requested lock-screen fields", async () => {
  const source = await readFile(new URL("../app/cad-push.ts", import.meta.url), "utf8");
  assert.match(source, /title: callType/);
  assert.match(source, /Call \$\{callNumber\}/);
  assert.match(source, /Time out \$\{timeOut\}/);
  assert.match(source, /cadNotesPreview\(incident\.narrative\)/);
  assert.match(source, /page=respond/);
});

test("service worker displays pushes and opens Respond when tapped", async () => {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  assert.match(source, /addEventListener\("push"/);
  assert.match(source, /showNotification/);
  assert.match(source, /addEventListener\("notificationclick"/);
  assert.match(source, /clients\.openWindow/);
});

test("push subscriptions require a verified same-origin member session", async () => {
  const source = await readFile(new URL("../app/api/push/subscriptions/route.ts", import.meta.url), "utf8");
  assert.match(source, /verifyInventoryRequest/);
  assert.match(source, /sameOriginInventoryRequest/);
  assert.match(source, /session\.context\.user\.id/);
  assert.match(source, /session\.context\.department\.id/);
});
