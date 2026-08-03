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
  assert.match(component, /DIGITAL TWIN BUILDER/);
  assert.match(component, /Save Fleet status/);
  assert.match(operations, /Daily inspection/);
  assert.match(operations, /Weekly inspection/);
  assert.match(operations, /Air pack check/);
  assert.doesNotMatch(serviceWorker, /\/api\//);
});
