import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("EMS is a permission-gated Documents page for administrators and employees", async () => {
  const app = await readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8");
  assert.match(app, /label: "Documents"[\s\S]*label: "EMS", page: "EMS"/);
  assert.match(app, /const employeeNavItems:[^\n]+"EMS"/);
  assert.match(app, /memberDocumentItems = new Set<NavItem>\(\["Policies", "EMS"\]\)/);
  assert.match(app, /<h2>Documents<\/h2>/);
  assert.match(app, /EMS: "documents\.view"/);
  assert.match(app, /activeNav === "EMS"/);
  assert.match(app, /No EMS documents have been added yet\./);
  assert.doesNotMatch(app, /Important Documents/);
});
