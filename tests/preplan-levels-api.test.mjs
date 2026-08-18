import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("field-preplans API exposes levels and spaces and enforces manage_layers on writes", async () => {
  const api = await read("../app/api/field-preplans/route.ts");
  assert.match(api, /field_preplan_levels/, "GET must read levels");
  assert.match(api, /field_preplan_spaces/, "GET must read spaces");
  assert.match(api, /canManageLayers/);
  assert.match(api, /action === "saveLevel"/);
  assert.match(api, /action === "deleteLevel"/);
  assert.match(api, /action === "saveSpace"/);
  assert.match(api, /action === "deleteSpace"/);
  assert.match(api, /canManageLayers.*403|403.*canManageLayers/s);
  // The Arrival layer type must never be creatable/renamable through the level editor —
  // only the migration creates it, and canDeleteLevel() blocks removing it.
  assert.match(api, /layerType === "arrival"/);
  assert.match(api, /canDeleteLevel/);
  // A room must be rejected if its level does not belong to the same preplan
  // (prevents cross-preplan association attacks).
  assert.match(api, /does not belong to this preplan/);
  // Saved geometry must pass validation before being persisted.
  assert.match(api, /isValidGeometry/);
});

test("field-preplans API filters legacy status text through a lifecycle default of published", async () => {
  const api = await read("../app/api/field-preplans/route.ts");
  assert.match(api, /lifecycleStatus/);
  assert.match(api, /COALESCE\(NULLIF\(lifecycle_status,''\),'published'\)/);
});

test("respond API only surfaces published preplans and computes deterministic CAD room matching", async () => {
  const api = await read("../app/api/respond/route.ts");
  assert.match(api, /WHERE COALESCE\(NULLIF\(lifecycle_status,''\),'published'\)='published'/, "Respond must never show draft/archived preplans");
  assert.match(api, /matchCadToRoom/);
  assert.match(api, /respond_visible=1 AND hidden=0/, "Respond only loads levels marked visible and not hidden");
  assert.match(api, /roomMatch/);
});
