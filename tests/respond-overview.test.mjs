import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("idle Respond uses the real Stickney map data sources", async () => {
  const [route, respond, overview] = await Promise.all([
    read("../app/api/respond/route.ts"),
    read("../app/respond.tsx"),
    read("../app/respond-overview-map.tsx"),
  ]);

  assert.match(route, /FROM field_preplans WHERE COALESCE\(publication_status,'published'\)='published'/);
  assert.match(route, /FROM field_hydrants/);
  assert.match(route, /FROM road_closures WHERE status='active'/);
  assert.match(route, /FROM fleet_apparatus/);
  assert.match(respond, /<RespondOverviewMap/);
  assert.match(respond, /GPS not connected/);
  assert.match(respond, /no vehicle location is guessed/i);
  assert.match(overview, /fetch\("\/api\/maps-config"/);
  assert.match(overview, /GoogleFieldMap/);
  assert.match(overview, /Preplans/);
  assert.match(overview, /Hydrants/);
  assert.match(overview, /Road closures/);
  assert.doesNotMatch(`${route}\n${respond}\n${overview}`, /Fermilab|KUBOTA|Main Ring Road|Kautz Road/i);
});

test("idle Respond map controls are operable and activity is explicit", async () => {
  const [respond, overview] = await Promise.all([
    read("../app/respond.tsx"),
    read("../app/respond-overview-map.tsx"),
  ]);

  assert.match(respond, /Set up Monitor/);
  assert.match(respond, /ACTIVE ROAD CLOSURE/);
  assert.match(overview, /aria-pressed=\{layers\.preplans\}/);
  assert.match(overview, /aria-pressed=\{layers\.hydrants\}/);
  assert.match(overview, /aria-pressed=\{layers\.closures\}/);
  assert.match(overview, /role="tablist"/);
  assert.match(overview, /No active calls/);
  assert.match(overview, /Start incident/);
});

test("Respond overview has desktop, tablet, and phone layouts", async () => {
  const css = await read("../app/globals.css");

  assert.match(css, /\.respond-map-layout\{[^}]*grid-template-columns:minmax\(0,1fr\) 300px/);
  assert.match(css, /@media\(max-width:950px\)[^{]*\{[^]*\.respond-map-layout\{grid-template-columns:1fr/);
  assert.match(css, /@media\(max-width:1000px\)[^{]*\{[^]*\.respond-overview-page \.respond-title\{[^}]*flex-direction:column/);
  assert.match(css, /@media\(max-width:620px\)[^{]*\{[^]*\.respond-monitor-status\{grid-template-columns:1fr 1fr/);
  assert.match(css, /\.respond-map-controls button\{[^}]*min-height:40px/);
  assert.match(css, /\.respond-map-marker\{[^}]*width:31px;height:31px/);
});
