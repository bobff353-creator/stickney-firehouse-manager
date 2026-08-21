import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  nextPublicationStatus,
  publicationActionsFor,
} from "../app/preplans/publication-workflow.mjs";

const operationalRoute = fs.readFileSync(
  "app/api/field-preplans/operational/route.ts",
  "utf8",
);
const respondRoute = fs.readFileSync("app/api/respond/route.ts", "utf8");
const panel = fs.readFileSync("app/preplans/operational-panel.tsx", "utf8");

test("isolated draft review publish workflow reaches a new Respond-visible revision", () => {
  let status = "draft";
  let revision = 1;

  assert.deepEqual(publicationActionsFor(status), ["submitReview"]);
  status = nextPublicationStatus(status, "submitReview");
  assert.equal(status, "in_review");
  assert.equal(revision, 1, "review does not create a published revision");

  assert.deepEqual(publicationActionsFor(status), ["returnDraft", "publish"]);
  status = nextPublicationStatus(status, "publish");
  if (status === "published") revision += 1;
  assert.equal(status, "published");
  assert.equal(revision, 2);

  assert.match(operationalRoute, /if \(action === "publish"\) \{[\s\S]*?buildSnapshot/);
  assert.match(operationalRoute, /field_preplan_revisions/);
  assert.match(respondRoute, /COALESCE\(publication_status,'published'\)='published'/);
});

test("invalid lifecycle shortcuts are rejected before persistence", () => {
  assert.equal(nextPublicationStatus("draft", "publish"), null);
  assert.equal(nextPublicationStatus("draft", "archive"), null);
  assert.equal(nextPublicationStatus("archived", "publish"), null);
  assert.match(operationalRoute, /if \(!nextStatus\).*status:409/);
});

test("the editor renders only actions allowed for the current lifecycle state", () => {
  assert.match(panel, /publicationActionsFor\(data\.plan\?\.publicationStatus\)/);
  for (const action of ["returnDraft", "submitReview", "publish", "archive"]) {
    assert.match(panel, new RegExp(`publicationActions\\.has\\("${action}"\\)`));
  }
});
