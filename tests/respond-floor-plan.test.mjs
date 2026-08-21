import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync("app/api/respond/route.ts", "utf8");
const respond = fs.readFileSync("app/respond.tsx", "utf8");

test("Respond loads saved room geometry, details, aliases, and CAD keywords", () => {
  for (const field of [
    "roomNumber",
    "cadKeywords",
    "coordinateSpace",
    "accessNotes",
    "fireProtectionNotes",
    "hazards",
  ]) {
    assert.match(route, new RegExp(field));
  }
  assert.match(route, /geometry: parseJson<unknown>\(space\.geometry, \[\]\)/);
  assert.match(
    route,
    /\.\.\.parseJson<string\[\]>\(space\.cadKeywords, \[\]\)/,
  );
});

test("a reliable CAD room match suggests its tactical level and opens intentionally", () => {
  assert.match(
    respond,
    /level\.id === data\.operational\?\.roomMatch\?\.room\?\.levelId/,
  );
  assert.match(respond, /Open matched room/);
  assert.match(respond, /setView\("floorplan"\)/);
});

test("floor-plan view uses private assets and highlights only saved normalized room geometry", () => {
  assert.match(respond, /function normalizedRoomPolygon/);
  assert.match(respond, /point\.x \* 100/);
  assert.match(respond, /space\.id === matchedRoomId/);
  assert.match(respond, /api\/field-preplans\/assets/);
  assert.match(respond, /No floor plan published for this level/);
  assert.match(respond, /No reliable CAD room highlight/);
});
