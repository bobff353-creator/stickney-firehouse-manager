import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("../app/api/flowmsp-import/route.ts", import.meta.url), "utf8");
const hydrants = await readFile(new URL("../app/api/field-hydrants/route.ts", import.meta.url), "utf8");
const bootstrap = await readFile(new URL("../db/bootstrap.ts", import.meta.url), "utf8");

test("FlowMSP import is admin-only, idempotent, and preserves source IDs", () => {
  assert.match(route, /Administrator privileges are required/);
  assert.match(route, /ON CONFLICT\(id\) DO UPDATE/);
  assert.match(route, /source_external_id/);
  assert.match(route, /FlowMSP source ID/);
  assert.match(route, /doNotShare/);
});

test("unknown hydrant ports remain unknown instead of being invented", () => {
  assert.match(route, /,0,"\[\]",hydrantNote/);
  assert.match(hydrants, /count<0\|\|count>3/);
});

test("duplicate real department hydrant IDs are retained by location", () => {
  assert.match(bootstrap, /DROP INDEX IF EXISTS field_hydrant_number_idx/);
  assert.doesNotMatch(bootstrap, /CREATE UNIQUE INDEX IF NOT EXISTS field_hydrant_number_idx/);
});
