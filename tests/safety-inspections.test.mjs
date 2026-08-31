import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("monthly safety inspections are available under Field with role permissions", async () => {
  const [shell, permissions] = await Promise.all([read("app/payroll-app.tsx"), read("app/permissions.ts")]);
  assert.match(shell, /Monthly Safety Inspections/);
  assert.match(shell, /page: "Safety Inspections"/);
  assert.match(shell, /<SafetyInspections readOnly=/);
  assert.match(permissions, /safety_inspections\.view/);
  assert.match(permissions, /safety_inspections\.complete/);
  assert.match(permissions, /safety_inspections\.manage/);
});

test("the Aladtec-derived extinguisher checklist has durable editable records", async () => {
  const [migration, bootstrap] = await Promise.all([
    read("supabase/migrations/20260831163510_monthly_safety_inspections.sql"),
    read("db/bootstrap.ts"),
  ]);
  assert.match(migration, /Public Works Monthly Fire Extinguisher Inspection/);
  assert.equal((migration.match(/'pw-ext-\d{3}'/g) || []).length, 24);
  assert.match(migration, /safety_inspection_results/);
  assert.match(migration, /safety_inspection_attachments/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /firehouse\.has_department_access/);
  assert.match(bootstrap, /monthly-public-works-extinguishers/);
});

test("inspection workflow validates, locks, reports, prints, emails, and accepts evidence", async () => {
  const [route, component, attachments] = await Promise.all([
    read("app/api/safety-inspections/route.ts"),
    read("app/safety-inspections.tsx"),
    read("app/api/safety-inspections/attachments/route.ts"),
  ]);
  assert.match(route, /not_checked.*pass.*deficient.*not_applicable/);
  assert.match(route, /Reopen this submitted inspection before editing/);
  assert.match(route, /Add a deficiency note for every deficient extinguisher/);
  assert.match(component, /Print general report/);
  assert.match(component, /Email general report/);
  assert.match(component, /Print \/ Save PDF/);
  assert.match(component, /Edit checklist/);
  assert.match(attachments, /20 \* 1024 \* 1024/);
  assert.match(attachments, /application\/pdf/);
});
