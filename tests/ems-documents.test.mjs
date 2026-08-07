import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("EMS is a permission-gated Documents page for administrators and employees", async () => {
  const [app, pdf] = await Promise.all([
    readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/ems/stickney-refusal-of-medical-advice.pdf", import.meta.url)),
  ]);
  assert.match(app, /label: "Documents"[\s\S]*label: "EMS", page: "EMS"/);
  assert.match(app, /const employeeNavItems:[^\n]+"EMS"/);
  assert.match(app, /memberDocumentItems = new Set<NavItem>\(\["Policies", "EMS"\]\)/);
  assert.match(app, /<h2>Documents<\/h2>/);
  assert.match(app, /EMS: "documents\.view"/);
  assert.match(app, /activeNav === "EMS"/);
  assert.match(app, /Refusal of Medical Advice/);
  assert.match(app, /href="\/ems\/stickney-refusal-of-medical-advice\.pdf"/);
  assert.doesNotMatch(app, /No EMS documents have been added yet\./);
  assert.doesNotMatch(app, /Important Documents/);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.length > 20_000);
});
