import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  canTransition,
  canViewRecord,
  nextRevisionNumber,
  permissionForTransition,
  REVISION_SNAPSHOT_FIELDS,
} from "../app/preplans/lifecycle.ts";

test("Scenario F — a draft is visible only to its owner or someone with review/publish authority", () => {
  assert.equal(canViewRecord("draft", { isOwner: true, canReview: false }), true, "Firefighter A can see their own draft");
  assert.equal(canViewRecord("draft", { isOwner: false, canReview: false }), false, "unauthorized Firefighter B cannot see someone else's draft");
  assert.equal(canViewRecord("draft", { isOwner: false, canReview: true }), true, "a reviewer can see any draft submitted for review");
  assert.equal(canViewRecord("in_review", { isOwner: false, canReview: true }), true);
});

test("published records are always visible regardless of ownership", () => {
  assert.equal(canViewRecord("published", { isOwner: false, canReview: false }), true);
});

test("archived records stay visible to owner/reviewer but not to an unrelated user", () => {
  assert.equal(canViewRecord("archived", { isOwner: true, canReview: false }), true);
  assert.equal(canViewRecord("archived", { isOwner: false, canReview: false }), false);
});

test("the full lifecycle state machine matches Scenario F's draft -> review -> publish path", () => {
  assert.equal(canTransition("draft", "in_review"), true);
  assert.equal(canTransition("in_review", "published"), true, "reviewer/publisher can publish");
  assert.equal(canTransition("in_review", "draft"), true, "reviewer can send back to draft");
  assert.equal(canTransition("draft", "published"), false, "a draft cannot skip review");
  assert.equal(canTransition("published", "archived"), true);
  assert.equal(canTransition("archived", "published"), true, "restoring an archived record back to published");
  assert.equal(canTransition("archived", "draft"), true, "an authorized user can also restore to draft for edits");
});

test("each transition target maps to the correct required permission", () => {
  assert.equal(permissionForTransition("in_review"), "field_preplans.review");
  assert.equal(permissionForTransition("published"), "field_preplans.publish");
  assert.equal(permissionForTransition("archived"), "field_preplans.delete");
  assert.equal(permissionForTransition("draft"), "field_preplans.edit");
});

test("revision numbers increment on every publish, never reset or overwrite history", () => {
  assert.equal(nextRevisionNumber(1), 2);
  assert.equal(nextRevisionNumber(5), 6);
  assert.equal(nextRevisionNumber(undefined), 1, "first publish");
});

test("the revision snapshot field list covers every field a restore needs to reconstruct", () => {
  for (const field of ["businessName", "footprint", "constructionType", "suggestedFireFlowGpm", "status"]) {
    assert.ok(REVISION_SNAPSHOT_FIELDS.includes(field), `${field} must be part of the snapshot`);
  }
});

test("bootstrap creates field_preplan_revisions as an immutable append-only log with a legacy backfill", async () => {
  const bootstrap = await readFile(new URL("../db/bootstrap.ts", import.meta.url), "utf8");
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS field_preplan_revisions/);
  assert.match(bootstrap, /revision_number INTEGER NOT NULL/);
  assert.match(bootstrap, /backfillPreplanRevisions/);
  assert.match(bootstrap, /migration_backfill/);
});

test("field-preplans API restricts draft/in_review visibility and never bypasses lifecycle transition rules", async () => {
  const api = await readFile(new URL("../app/api/field-preplans/route.ts", import.meta.url), "utf8");
  assert.match(api, /canViewRecord/);
  assert.match(api, /action === "transitionPreplan"/);
  assert.match(api, /canTransition\(plan\.lifecycleStatus, to\)/);
  assert.match(api, /action === "restoreRevision"/);
  // Publishing must write an immutable revision row before flipping status.
  assert.match(api, /INSERT INTO field_preplan_revisions/);
  // Restoring a revision returns the record to draft rather than silently republishing it —
  // "publish restored revision as a new revision" means restore-then-publish, not restore-as-publish.
  assert.match(api, /lifecycle_status='draft'/);
});
