import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("runs the full portal natively on Vercel without a Sites proxy", async () => {
  const [page, layout, payroll, confirm, packageJson] = await Promise.all([
    read("app/page.tsx"),
    read("app/layout.tsx"),
    read("app/payroll-app.tsx"),
    read("app/auth/confirm/route.ts"),
    read("package.json"),
  ]);
  await assert.rejects(access(new URL("app/[[...path]]/route.ts", root)));
  await assert.rejects(access(new URL("app/lib/upstream-portal.ts", root)));
  assert.match(page, /AuthGateway/);
  assert.match(confirm, /supabase/);
  assert.match(payroll, /window\.location\.assign\("\/inventory"\)/);
  assert.match(layout, /training-route\.js/);
  assert.match(layout, /fleet-notices\.js/);
  assert.match(layout, /preplan-route\.js/);
  assert.doesNotMatch([page, layout, payroll, confirm, packageJson].join("\n"), /chatgpt\.site|stickney-payroll-manager|cloudflare:workers|OAI-Sites/i);
});

test("keeps the installable advanced fleet and inventory module", async () => {
  const [layout, inventoryPage, component, operations, manifestText, serviceWorker] = await Promise.all([
    read("app/layout.tsx"),
    read("app/inventory/page.tsx"),
    read("app/inventory-live.tsx"),
    read("app/inventory-operations.tsx"),
    read("public/manifest.webmanifest"),
    read("public/sw.js"),
  ]);
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.name, "Stickney Firehouse Manager");
  assert.equal(manifest.display, "standalone");
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.match(inventoryPage, /verifyInventoryServerSession/);
  assert.match(component, /Build & Templates/);
  assert.match(component, /Scan Barcode/);
  assert.match(component, /Due Now/);
  assert.match(component, /Save Fleet status/);
  assert.match(operations, /Daily inspection/);
  assert.match(operations, /Weekly inspection/);
  assert.match(operations, /Air pack check/);
  assert.doesNotMatch(serviceWorker, /\/api\//);
});

test("formats SQLite-style CURRENT_TIMESTAMP values for migrated text columns", async () => {
  const adapter = await read("db/postgres-adapter.ts");

  assert.match(adapter, /CURRENT_TIMESTAMP\\b\/gi, "to_char\(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'\)"/);
});

test("translates bound SQLite date values for Postgres", async () => {
  const [adapter, literal] = await Promise.all([
    read("db/postgres-adapter.ts"),
    read("db/sql-literal.ts"),
  ]);

  assert.match(literal, /const requiresEncoding = \/\(;\|--\|\\\/\\\*\|\\\*\\\/\)\/\.test\(sanitized\)/);
  assert.match(literal, /gatewayBlockedSqlWord\.test\(sanitized\)/);
  assert.match(adapter, /date\\\(\\s\*\(\x27\(\?:\x27\x27\|\[\^\x27\]\)\*\x27\)\\s\*\\\)\/gi, "\(\$1\)::date"/);
});

test("encodes callback rule text before the SQL gateway scans it", async () => {
  const { sqlLiteral } = await import("../db/sql-literal.ts");
  const encoded = sqlLiteral('["Back-to-back call: another call was dispatched within 5 minutes"]');

  assert.match(encoded, /convert_from\(decode\('/);
  assert.doesNotMatch(encoded, /Back-to-back call/i);
});
