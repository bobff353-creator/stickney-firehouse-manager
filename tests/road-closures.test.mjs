import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const api = await readFile(new URL("../app/api/road-closures/route.ts", import.meta.url), "utf8");
const board = await readFile(new URL("../app/operations-board.tsx", import.meta.url), "utf8");
const page = await readFile(new URL("../app/road-closures.tsx", import.meta.url), "utf8");
const shell = await readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20260826204400_operational_road_closures.sql", import.meta.url), "utf8");

test("road closure mutations require same-origin incident command access", () => {
  assert.match(api, /sameOriginInventoryRequest\(request\)/);
  assert.match(api, /incident_command\.manage/);
});

test("closure creation requires a traced segment and bypass point", () => {
  assert.match(api, /path\.length < 2/);
  assert.match(api, /if \(!detourPoint\)/);
  assert.match(page, /Trace at least two road points/);
  assert.match(page, /Set the preferred bypass point/);
});

test("reopening preserves history instead of deleting the record", () => {
  assert.match(api, /UPDATE road_closures SET status='cleared'/);
  assert.doesNotMatch(api, /DELETE FROM road_closures/);
});

test("Live Operations shows active road closure and detour", () => {
  assert.match(board, /ROAD OUT OF SERVICE/);
  assert.match(board, /OPEN DETOUR/);
  assert.match(board, /waypoints=/);
});

test("road closures have a field navigation entry", () => {
  assert.match(shell, /label: "Road Closures", page: "Road Closures"/);
});

test("Supabase road closure table is protected and explicitly granted", () => {
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /has_department_access/);
  assert.match(migration, /grant select, insert, update/i);
});
