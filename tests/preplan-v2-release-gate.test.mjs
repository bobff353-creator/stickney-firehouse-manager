import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const gate = fs.readFileSync("scripts/verify-preplan-v2.mjs", "utf8");
const guide = fs.readFileSync("docs/preplan-v2-testing.md", "utf8");

test("Preplan 2.0 has a repeatable focused production-build release gate", () => {
  assert.equal(packageJson.scripts["test:preplan-v2"], "node scripts/verify-preplan-v2.mjs");
  assert.equal(
    packageJson.scripts["verify:preplan-v2"],
    "npm run build && npm run test:preplan-v2",
  );
  assert.match(gate, /entry\.name\.startsWith\("preplan-v2-"\)/);
  assert.match(gate, /entry\.name\.startsWith\("respond-"\)/);
  assert.doesNotMatch(gate, /--prod|vercel|DELETE FROM|UPDATE |INSERT INTO/);
});

test("Phase 8 matrix distinguishes automated evidence from manual browser work", () => {
  assert.match(guide, /## Phase 8 release gate/);
  assert.match(guide, /Automated, no live database/);
  assert.match(guide, /Not automated yet/);
  assert.match(guide, /Manual required/);
  assert.match(guide, /Production promotion is not authorized/);
});
