import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  arrivalLevelDefaults,
  canDeleteLevel,
  duplicateLevel,
  isArrivalLevel,
  layerTypeLabel,
  nextSortOrder,
  reorderLevels,
} from "../app/preplans/levels.ts";
import {
  backfillLifecycleStatus,
  canTransition,
  isVisibleInRespond,
  isVisibleToEditor,
  nextRevisionNumber,
  permissionForTransition,
} from "../app/preplans/lifecycle.ts";

test("every preplan gets a mandatory, permanent Arrival level", () => {
  const arrival = arrivalLevelDefaults("preplan-1", "Lt. Smith", "arrival-preplan-1");
  assert.equal(arrival.layerType, "arrival");
  assert.equal(arrival.name, "Arrival / Ground");
  assert.equal(arrival.isDefault, true);
  assert.equal(arrival.respondVisible, true);
  assert.equal(arrival.sortOrder, 0);
  assert.equal(isArrivalLevel(arrival), true);
  assert.equal(canDeleteLevel(arrival), false);
});

test("non-arrival, non-default levels can be deleted", () => {
  assert.equal(canDeleteLevel({ layerType: "floor", isDefault: false }), true);
  assert.equal(canDeleteLevel({ layerType: "custom", isDefault: true }), false);
});

test("reordering always pins Arrival to the front regardless of requested order", () => {
  const levels = [
    { id: "arrival", layerType: "arrival" },
    { id: "floor-1", layerType: "floor" },
    { id: "floor-2", layerType: "floor" },
    { id: "basement", layerType: "basement" },
  ];
  const reordered = reorderLevels(levels, ["basement", "floor-2", "floor-1", "arrival"]);
  assert.deepEqual(reordered.map((level) => level.id), ["arrival", "basement", "floor-2", "floor-1"]);
});

test("reordering tolerates an incomplete order list by appending the rest", () => {
  const levels = [
    { id: "arrival", layerType: "arrival" },
    { id: "floor-1", layerType: "floor" },
    { id: "floor-2", layerType: "floor" },
  ];
  const reordered = reorderLevels(levels, ["floor-2"]);
  assert.deepEqual(reordered.map((level) => level.id), ["arrival", "floor-2", "floor-1"]);
});

test("nextSortOrder appends after the highest existing sort order", () => {
  assert.equal(nextSortOrder([]), 0);
  assert.equal(nextSortOrder([{ sortOrder: 0 }, { sortOrder: 3 }]), 4);
});

test("duplicating a level produces a new id and non-default copy, never sharing mutable state", () => {
  const source = arrivalLevelDefaults("preplan-1", "Lt. Smith", "arrival-preplan-1");
  const clone = duplicateLevel(source, "floor-2-copy", "Capt. Jones", 5);
  assert.notEqual(clone.id, source.id);
  assert.equal(clone.isDefault, false);
  assert.equal(clone.name, "Arrival / Ground (Copy)");
  assert.equal(clone.sortOrder, 5);
  assert.equal(clone.createdBy, "Capt. Jones");
});

test("layer type labels are human readable for every supported layer type", () => {
  assert.equal(layerTypeLabel("hazmat"), "HazMat");
  assert.equal(layerTypeLabel("iap"), "Incident Action Plan");
  assert.equal(layerTypeLabel("fire_protection"), "Fire Protection");
});

test("legacy status values backfill to published so nothing disappears from Respond", () => {
  assert.equal(backfillLifecycleStatus(null), "published");
  assert.equal(backfillLifecycleStatus(""), "published");
  assert.equal(backfillLifecycleStatus("Quick Preplan"), "published");
  assert.equal(backfillLifecycleStatus("Complete"), "published");
  assert.equal(backfillLifecycleStatus("draft"), "draft");
  assert.equal(backfillLifecycleStatus("ARCHIVED"), "archived");
});

test("only published preplans are visible in Respond", () => {
  assert.equal(isVisibleInRespond("published"), true);
  assert.equal(isVisibleInRespond("draft"), false);
  assert.equal(isVisibleInRespond("in_review"), false);
  assert.equal(isVisibleInRespond("archived"), false);
});

test("editors and owners can still see their own draft and archived records", () => {
  assert.equal(isVisibleToEditor("draft", true), true);
  assert.equal(isVisibleToEditor("draft", false), false, "an ordinary firefighter must not see someone else's draft");
  assert.equal(isVisibleToEditor("archived", true), true);
  assert.equal(isVisibleToEditor("archived", false), false);
});

test("lifecycle transitions follow the defined state machine", () => {
  assert.equal(canTransition("draft", "in_review"), true);
  assert.equal(canTransition("in_review", "published"), true);
  assert.equal(canTransition("published", "archived"), true);
  assert.equal(canTransition("archived", "published"), true);
  assert.equal(canTransition("draft", "published"), false, "must go through review before publishing");
  assert.equal(canTransition("published", "in_review"), false);
  assert.equal(canTransition("draft", "draft"), false);
});

test("each transition requires the correct server permission key", () => {
  assert.equal(permissionForTransition("published"), "field_preplans.publish");
  assert.equal(permissionForTransition("in_review"), "field_preplans.review");
  assert.equal(permissionForTransition("archived"), "field_preplans.delete");
  assert.equal(permissionForTransition("draft"), "field_preplans.edit");
});

test("revision numbers increment monotonically and recover from missing data", () => {
  assert.equal(nextRevisionNumber(undefined), 1);
  assert.equal(nextRevisionNumber(null), 1);
  assert.equal(nextRevisionNumber(0), 1);
  assert.equal(nextRevisionNumber(1), 2);
  assert.equal(nextRevisionNumber(7), 8);
});

test("bootstrap creates the field_preplan_levels table and lifecycle columns idempotently", async () => {
  const bootstrap = await readFile(new URL("../db/bootstrap.ts", import.meta.url), "utf8");
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS field_preplan_levels/);
  assert.match(bootstrap, /layer_type TEXT NOT NULL DEFAULT 'custom'/);
  assert.match(bootstrap, /ALTER TABLE field_preplans ADD COLUMN lifecycle_status/);
  assert.match(bootstrap, /ALTER TABLE field_preplans ADD COLUMN revision_number/);
  assert.match(bootstrap, /backfillPreplanLevelsAndLifecycle/);
  assert.match(bootstrap, /layer_type='arrival'/);
  // Migration must be guarded by a version marker so re-running bootstrap never
  // duplicates Arrival levels for preplans that already have one.
  assert.match(bootstrap, /preplan_v2_levels_lifecycle_version/);
});

test("new field_preplans permission keys exist and are wired into officer defaults", async () => {
  const permissions = await readFile(new URL("../app/permissions.ts", import.meta.url), "utf8");
  for (const key of [
    "field_preplans.review",
    "field_preplans.publish",
    "field_preplans.delete",
    "field_preplans.manage_layers",
    "field_preplans.manage_hazmat",
    "field_preplans.manage_attachments",
    "field_preplans.verify_expiring",
    "field_preplans.manage_settings",
  ]) {
    assert.match(permissions, new RegExp(`key: "${key.replace(".", "\\.")}"`), `${key} must be in the permission catalog`);
  }
  assert.match(permissions, /officerPermissions.*field_preplans\.publish/);
});

test("bootstrap seeds rank_permissions rows for every new field_preplans permission key", async () => {
  const bootstrap = await readFile(new URL("../db/bootstrap.ts", import.meta.url), "utf8");
  assert.match(bootstrap, /field_preplans\.review.*field_preplans\.publish.*field_preplans\.manage_layers/);
  assert.match(bootstrap, /field_preplans\.delete.*field_preplans\.manage_settings/);
});
