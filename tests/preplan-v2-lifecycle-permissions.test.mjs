import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const permissions = fs.readFileSync("app/server-permissions.ts", "utf8");
const listRoute = fs.readFileSync("app/api/field-preplans/route.ts", "utf8");
const operationalRoute = fs.readFileSync(
  "app/api/field-preplans/operational/route.ts",
  "utf8",
);
const photoRoute = fs.readFileSync(
  "app/api/field-preplans/photos/[photoId]/route.ts",
  "utf8",
);
const assetRoute = fs.readFileSync(
  "app/api/field-preplans/assets/[assetId]/route.ts",
  "utf8",
);

test("published preplans remain visible to ordinary authorized viewers", () => {
  assert.match(permissions, /if \(status === "published"\) return true/);
  assert.match(permissions, /canViewPublished: permissions\.has\("field_preplans\.view"\)/);
});

test("working preplans require ownership or edit, review, or publish authority", () => {
  for (const permission of [
    "field_preplans.edit",
    "field_preplans.review",
    "field_preplans.publish",
  ]) {
    assert.match(permissions, new RegExp(permission.replace(".", "\\.")));
  }
  assert.match(permissions, /access\.identities\.has\(identity\)/);
  assert.match(permissions, /plan\.createdBy, plan\.updatedBy/);
  assert.doesNotMatch(permissions, /bwyant@stickneyfire\.com/);
});

test("list and direct operational reads enforce the same lifecycle rule", () => {
  assert.match(listRoute, /visiblePlans = plans\.results\.filter/);
  assert.match(listRoute, /canReadPreplanLifecycle\(plan, readAccess\)/);
  assert.match(listRoute, /preplans:visiblePlans\.map/);
  assert.match(operationalRoute, /canReadPreplanLifecycle\(lifecycle, readAccess\)/);
  assert.match(operationalRoute, /return Response\.json\(\{ error:"Preplan not found\." \}, \{ status:404 \}\)/);
});

test("direct photo and attachment streams cannot bypass draft visibility", () => {
  for (const route of [photoRoute, assetRoute]) {
    assert.match(route, /JOIN field_preplans plan ON plan\.id=/);
    assert.match(route, /canReadPreplanLifecycle/);
    assert.match(route, /preplanReadAccess\(request,db\)|preplanReadAccess\(request, db\)/);
  }
  assert.match(photoRoute, /\{ error:"Photo not found\." \}, \{ status:404 \}/);
  assert.match(assetRoute, /\{error:"Preplan asset not found\."\},\{status:404\}/);
});
