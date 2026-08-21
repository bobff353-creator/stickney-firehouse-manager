import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const route = fs.readFileSync("app/api/respond/route.ts", "utf8");
const respond = fs.readFileSync("app/respond.tsx", "utf8");

test("Respond reads saved HazMat zone geometry and presentation metadata", () => {
  for (const field of [
    "geometry",
    "fill_color fillColor",
    "line_color lineColor",
    "opacity",
  ])
    assert.match(route, new RegExp(field));
  assert.match(route, /geometry: parseJson<unknown>\(item\.geometry, null\)/);
});

test("HazMat zones respect the selected operational level", () => {
  assert.match(
    respond,
    /!zone\.levelId \|\| zone\.levelId === selectedLevel\?\.id/,
  );
});

test("Respond renders active zones without inventing missing distance or location", () => {
  assert.match(respond, /ACTIVE OPERATIONAL ZONES/);
  assert.match(respond, /Distance not recorded/);
  assert.match(respond, /Location not mapped/);
  assert.match(respond, /Do not infer a\s+distance when none is recorded/);
});
