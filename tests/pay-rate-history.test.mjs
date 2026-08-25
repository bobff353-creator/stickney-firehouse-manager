import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("pay rates are effective-dated and historical payroll selects the applicable rate", async () => {
  const api = await readFile(new URL("../app/api/payroll/route.ts", import.meta.url), "utf8");
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  const bootstrap = await readFile(new URL("../db/bootstrap.ts", import.meta.url), "utf8");
  assert.equal(schema.includes('sqliteTable("pay_rate_history"'), true);
  assert.equal(bootstrap.includes("'1900-01-01'"), true);
  assert.equal(api.includes("rate.effectiveDate <= start"), true);
  assert.equal(api.includes("ON CONFLICT(pay_scale_id, effective_date)"), true);
});

test("rate changes must begin on a payroll-period boundary", async () => {
  const api = await readFile(new URL("../app/api/payroll/route.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8");
  assert.equal(api.includes("/^\\d{4}-\\d{2}-(11|26)$/"), true);
  assert.equal(page.includes("Effective pay-period date *"), true);
  assert.equal(page.includes("Existing history before this date remains unchanged."), true);
});

test("employee pay-scale choices include Chief and Deputy Chief without employee-specific labels", async () => {
  const bootstrap = await readFile(new URL("../db/bootstrap.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../supabase/migrations/20260825160718_normalize_chief_pay_scale_labels.sql", import.meta.url), "utf8");
  assert.equal(bootstrap.includes('["deputy-chief-1", "Chief"'), true);
  assert.equal(bootstrap.includes('["deputy-chief-2", "Deputy Chief"'), true);
  assert.equal(bootstrap.includes("Chief — O'Dowd"), false);
  assert.equal(bootstrap.includes("Chief — Babinec"), false);
  assert.equal(migration.includes("update firehouse.pay_scales"), true);
  assert.equal(migration.includes("insert into firehouse.rank_permissions"), true);
});
