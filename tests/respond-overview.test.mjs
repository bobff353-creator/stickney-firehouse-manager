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
  assert.match(route, /FROM dispatch_incidents WHERE latitude IS NOT NULL AND longitude IS NOT NULL/);
  assert.match(route, /Saved CAD location/);
  assert.match(route, /Published preplan address/);
  assert.match(respond, /<RespondOverviewMap/);
  assert.match(respond, /GPS not connected/);
  assert.match(respond, /Nothing is guessed/i);
  assert.match(overview, /fetch\("\/api\/maps-config"/);
  assert.match(overview, /GoogleFieldMap/);
  assert.match(overview, /Preplans/);
  assert.match(overview, /Hydrants/);
  assert.match(overview, /Road closures/);
  assert.match(overview, /clusterRecentCallLocations/);
  assert.match(overview, /initialCallMapView/);
  assert.match(overview, /const \[initialView\] = useState\(\(\) => initialCallMapView\(recentCalls\)\)/);
  assert.match(overview, /span > 0\.055 \? 14 : span > 0\.022 \? 15 : 16/);
  assert.match(overview, /Show \$\{cluster\.calls\.length\} recent calls at this location/);
  assert.match(overview, /respond-map-marker call/);
  assert.doesNotMatch(`${route}\n${respond}\n${overview}`, /Fermilab|KUBOTA|Main Ring Road|Kautz Road/i);
});

test("idle Respond map controls are operable and activity is explicit", async () => {
  const [respond, overview] = await Promise.all([
    read("../app/respond.tsx"),
    read("../app/respond-overview-map.tsx"),
  ]);

  assert.match(respond, /Open full screen/);
  assert.match(respond, /Ready — no active incident/);
  assert.match(respond, /New CAD calls\s+open here automatically/);
  assert.match(respond, /ACTIVE ROAD CLOSURE/);
  assert.match(overview, /aria-pressed=\{layers\.preplans\}/);
  assert.match(overview, /aria-pressed=\{layers\.hydrants\}/);
  assert.match(overview, /aria-pressed=\{layers\.closures\}/);
  assert.match(overview, /aria-pressed=\{layers\.calls\}/);
  assert.match(overview, /role="tablist"/);
  assert.match(overview, /No active calls/);
  assert.match(overview, /Step \{guide\.step\}/);
  assert.match(overview, /Choose what you need/);
  assert.match(overview, /Choose a recent call/);
  assert.match(overview, /Call selected/);
  assert.match(overview, /Enter a manual call/);
  assert.match(overview, /Map options/);
  assert.match(overview, /Map key/);
  assert.match(overview, /displayedRecentCalls\.map/);
  assert.match(overview, /Show all recent calls/);
});

test("Respond overview has desktop, tablet, and phone layouts", async () => {
  const css = await read("../app/globals.css");

  assert.match(css, /\.respond-map-layout\{[^}]*grid-template-columns:minmax\(0,1fr\) 300px/);
  assert.match(css, /@media\(max-width:950px\)[^{]*\{[^]*\.respond-map-layout\{grid-template-columns:1fr/);
  assert.match(css, /@media\(max-width:1000px\)[^{]*\{[^]*\.respond-overview-page \.respond-title\{[^}]*flex-direction:column/);
  assert.match(css, /@media\(max-width:620px\)[^{]*\{[^]*\.respond-monitor-status\{grid-template-columns:1fr 1fr/);
  assert.match(css, /\.respond-map-controls button\{[^}]*min-height:40px/);
  assert.match(css, /\.respond-map-marker\{[^}]*width:31px;height:31px/);
  assert.match(css, /\.respond-task-guide\{[^}]*display:grid/);
  assert.match(css, /@media\(max-width:900px\)[^{]*\{[^]*\.respond-task-actions\{[^}]*grid-column:1\/-1/);
  assert.match(css, /@media\(max-width:520px\)[^{]*\{[^]*\.respond-task-guide\{[^}]*grid-template-columns:1fr/);
  assert.match(css, /@media\(max-width:520px\)[^{]*\{[^]*\.respond-overview-page \.respond-title-actions>\*\{flex:none/);
});
