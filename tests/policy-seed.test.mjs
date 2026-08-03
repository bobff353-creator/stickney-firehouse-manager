import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const policies = JSON.parse(
  await readFile(new URL("../db/policy-seed.json", import.meta.url), "utf8"),
);

test("contains the complete Stickney policy library", () => {
  assert.equal(policies.length, 110);
  assert.equal(new Set(policies.map((policy) => policy.policyNumber)).size, 110);
  assert.equal(policies[0].policyNumber, "100");
  assert.equal(policies.at(-1).policyNumber, "1104");
});

test("every imported policy has searchable official content", () => {
  for (const policy of policies) {
    assert.match(policy.id, /^sfd-policy-\d+$/);
    assert.match(policy.effectiveDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(policy.title.length > 3, `Missing title for ${policy.policyNumber}`);
    assert.ok(policy.category.length > 3, `Missing category for ${policy.policyNumber}`);
    assert.ok(policy.body.startsWith("PURPOSE"), `Missing purpose for ${policy.policyNumber}`);
    assert.ok(policy.body.length > 500, `Policy ${policy.policyNumber} appears truncated`);
    assert.doesNotMatch(policy.body, /Page \d+ of \d+/i);
  }
});
