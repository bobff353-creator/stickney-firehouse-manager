import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("verifies the signed-in Supabase user and active department membership", async () => {
  const [session, sessionRoute] = await Promise.all([
    read("app/lib/inventory-session.ts"),
    read("app/api/auth/session/route.ts"),
  ]);

  assert.match(session, /supabase\.auth\.getUser\(\)/);
  assert.match(session, /stickney-fire-department/);
  assert.match(session, /department_members/);
  assert.match(session, /\.eq\("status", "active"\)/);
  assert.match(session, /platform_owner/);
  assert.match(session, /canMutateInventory/);
  assert.doesNotMatch(session, /service_role|SUPABASE_SERVICE_ROLE/i);
  assert.match(sessionRoute, /verifyInventoryRequest\(request\)/);
});

test("all inventory APIs resolve the department from the verified session", async () => {
  const [suite, twin, media, operations] = await Promise.all([
    read("app/api/suite-context/route.ts"),
    read("app/api/digital-twin/route.ts"),
    read("app/api/digital-twin/media/[id]/route.ts"),
    read("app/api/operations/route.ts"),
  ]);

  for (const source of [suite, twin, media, operations]) {
    assert.match(source, /verifyInventoryRequest\(request\)/);
    assert.doesNotMatch(source, /x-department-id|SUITE_DEPARTMENT_ID/);
  }

  assert.match(twin, /session\.context\.department\.id/);
  assert.match(twin, /sameOriginInventoryRequest\(request\)/);
  assert.match(twin, /canMutateInventory\(session\.context\.role\)/);
  assert.match(media, /session\.context\.department\.id/);
  assert.match(operations, /session\.context\.department\.id/);
});

test("uses the browser-safe Supabase key and never a server secret", async () => {
  const client = await read("app/lib/supabase-server.ts");

  assert.match(client, /sb_publishable_/);
  assert.match(client, /createServerClient/);
  assert.match(client, /cookies\(\)/);
  assert.doesNotMatch(client, /service_role|SUPABASE_SERVICE_ROLE/i);
});
