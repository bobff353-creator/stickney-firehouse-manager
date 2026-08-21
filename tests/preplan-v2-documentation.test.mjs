import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const userGuide = fs.readFileSync("docs/preplan-v2-user-guide.md", "utf8");
const adminGuide = fs.readFileSync("docs/preplan-v2-admin-guide.md", "utf8");
const migrationGuide = fs.readFileSync("docs/preplan-v2-data-migration.md", "utf8");
const acceptanceGuide = fs.readFileSync("docs/preplan-v2-acceptance.md", "utf8");
const releaseReport = fs.readFileSync("docs/preplan-v2-release-report.md", "utf8");

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

test("release report separates automated preview evidence from production readiness", () => {
  for (const section of ["Release status", "Implemented capability", "Architecture and persistence", "Permissions and security", "API and UI changes", "Verification evidence", "Browser and acceptance evidence", "Exact production prerequisites"]) {
    assert.match(releaseReport, new RegExp(`## ${section}`));
  }
  assert.match(releaseReport, /282 passed, 0 failed, 0 skipped/);
  assert.match(releaseReport, /No current screenshot or signed-in browser evidence is attached/);
  assert.match(releaseReport, /Obtain explicit production-promotion authorization/);
  assert.doesNotMatch(releaseReport, /production release is complete|production migration passed/i);
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
