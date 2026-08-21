import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const userGuide = fs.readFileSync("docs/preplan-v2-user-guide.md", "utf8");
const adminGuide = fs.readFileSync("docs/preplan-v2-admin-guide.md", "utf8");
const migrationGuide = fs.readFileSync("docs/preplan-v2-data-migration.md", "utf8");
const acceptanceGuide = fs.readFileSync("docs/preplan-v2-acceptance.md", "utf8");

test("user guide explains published, unknown, and offline boundaries", () => {
  assert.match(userGuide, /Respond reads only published preplans/);
  assert.match(userGuide, /Not entered.*Not verified/s);
  assert.match(userGuide, /OFFLINE — READ-ONLY PREPLAN/);
  assert.match(userGuide, /Signing out clears private cached Respond packets/);
});

test("documentation links the acceptance evidence ledger", () => {
  assert.match(fs.readFileSync("docs/preplan-v2-testing.md", "utf8"), /docs\/preplan-v2-acceptance\.md/);
  assert.match(acceptanceGuide, /repository-wide `npm run lint` remains a separate whole-portal check/);
  assert.match(acceptanceGuide, /Do not place secrets/);
});

test("admin guide documents permissions and the enforced lifecycle", () => {
  for (const permission of ["view", "edit", "review", "publish", "manage_layers", "manage_hazmat", "manage_attachments", "verify_expiring", "delete", "manage_settings"]) assert.match(adminGuide, new RegExp(`field_preplans\\.${permission}`));
  assert.match(adminGuide, /Draft → Submit for review/);
  assert.match(adminGuide, /immutable revision snapshot/);
  assert.match(adminGuide, /does not authorize production promotion/);
});

test("migration guide preserves legacy records and requires isolation", () => {
  assert.match(migrationGuide, /isolated preview database and storage/);
  assert.match(migrationGuide, /does not fabricate/);
  assert.match(migrationGuide, /preplan_schema_version/);
  assert.match(migrationGuide, /does not advance `runtime_bootstrap_version`/);
  assert.match(migrationGuide, /explicit authorization/);
  assert.match(migrationGuide, /do not drop new tables during incident response/);
});
