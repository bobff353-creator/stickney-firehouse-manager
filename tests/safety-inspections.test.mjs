import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("monthly safety inspections are available under Field with role permissions", async () => {
  const [shell, permissions] = await Promise.all([read("app/payroll-app.tsx"), read("app/permissions.ts")]);
  assert.match(shell, /Safety Inspections/);
  assert.match(shell, /page: "Safety Inspections"/);
  assert.match(shell, /<SafetyInspections readOnly=/);
  assert.match(permissions, /safety_inspections\.view/);
  assert.match(permissions, /safety_inspections\.complete/);
  assert.match(permissions, /safety_inspections\.manage/);
});

test("the Aladtec-derived extinguisher checklist has durable editable records", async () => {
  const [migration, libraryMigration, catalog, bootstrap] = await Promise.all([
    read("supabase/migrations/20260831163510_monthly_safety_inspections.sql"),
    read("supabase/migrations/20260831213454_add_aladtec_safety_inspection_templates.sql"),
    read("db/safety-inspection-catalog.ts"),
    read("db/bootstrap.ts"),
  ]);
  assert.match(migration, /Public Works Monthly Fire Extinguisher Inspection/);
  assert.equal((migration.match(/'pw-ext-\d{3}'/g) || []).length, 24);
  assert.match(migration, /safety_inspection_results/);
  assert.match(migration, /safety_inspection_attachments/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /firehouse\.has_department_access/);
  assert.match(bootstrap, /safetyInspectionTemplates/);
  for (const template of [
    "monthly-public-works-extinguishers",
    "monthly-pump-station-extinguishers",
    "monthly-village-hall-police-extinguishers",
    "weekly-eyewash-inspection",
    "monthly-general-safety-inspection",
  ]) {
    assert.match(catalog, new RegExp(template));
    assert.match(libraryMigration, new RegExp(template));
  }
  assert.equal((catalog.match(/\["Safe Work Practice"/g) || []).length, 13);
  assert.equal((catalog.match(/\["Electrical"/g) || []).length, 9);
  assert.equal((catalog.match(/\["Miscellaneous Items"/g) || []).length, 13);
  assert.match(libraryMigration, /item_count <> 128/);
  assert.match(libraryMigration, /location_options/);
  assert.match(libraryMigration, /inspection_location/);
});

test("inspection workflow validates, locks, reports, prints, emails, and accepts evidence", async () => {
  const [route, component, attachments] = await Promise.all([
    read("app/api/safety-inspections/route.ts"),
    read("app/safety-inspections.tsx"),
    read("app/api/safety-inspections/attachments/route.ts"),
  ]);
  assert.match(route, /not_checked.*pass.*deficient.*not_applicable/);
  assert.match(route, /Reopen this submitted inspection before editing/);
  assert.match(route, /Add a deficiency note for every deficient checkpoint/);
  assert.match(route, /updateTemplate/);
  assert.match(route, /createItem/);
  assert.match(component, /Print general report/);
  assert.match(component, /Email general report/);
  assert.match(component, /Print \/ Save PDF/);
  assert.match(component, /Edit inspection forms/);
  assert.match(component, /All inspection forms/);
  assert.match(component, /Email detailed report/);
  assert.match(attachments, /20 \* 1024 \* 1024/);
  assert.match(attachments, /application\/pdf/);
});
