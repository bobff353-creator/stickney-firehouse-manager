import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("../app/api/field-hydrants/route.ts",import.meta.url),"utf8");

test("hydrant cleanup uses portable explicit deletes instead of a data-changing CTE",()=>{
  assert.doesNotMatch(source,/WITH deleted_tests AS/);
  assert.match(source,/SELECT id FROM field_hydrants WHERE id=\?/);
  assert.match(source,/DELETE FROM field_hydrant_flow_tests WHERE test_hydrant_id=\? OR flow_hydrant_id=\?/);
  assert.match(source,/DELETE FROM field_hydrant_flushes WHERE hydrant_id=\?/);
  assert.match(source,/DELETE FROM field_hydrants WHERE id=\?"\)\.bind\(id\)\.run\(\)/);
  assert.doesNotMatch(source,/DELETE FROM field_hydrants WHERE id=\? RETURNING id/);
});
