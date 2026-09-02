import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { clusterHydrantLocations, mapWorldPoint, projectMapPoint } from "../app/respond-map-markers.ts";

const hydrant = (id, longitude, serviceStatus = "in_service") => ({ id, latitude: 41.82, longitude, serviceStatus });

test("hydrants group at overview zoom and separate at street zoom without changing records", () => {
  const records = [hydrant("a", -87.77), hydrant("b", -87.7695), hydrant("c", -87.769)];
  const original = JSON.stringify(records);
  assert.equal(clusterHydrantLocations(records, 14).length, 1);
  assert.equal(clusterHydrantLocations(records, 20).length, 3);
  assert.equal(JSON.stringify(records), original);
});

test("hydrant grouping preserves every ID, exposes service exceptions, and is order-stable", () => {
  const records = [hydrant("a", -87.77), hydrant("b", -87.77, "out_of_service"), hydrant("c", -87.77, "impaired")];
  const groups = clusterHydrantLocations(records, 21);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].outOfService, 1);
  assert.equal(groups[0].needsAttention, 2);
  assert.deepEqual(groups[0].hydrants.map(h => h.id), ["a", "b", "c"]);
  assert.deepEqual(clusterHydrantLocations([...records].reverse(), 21), groups);
});

test("invalid coordinates are never projected as hydrant markers", () => {
  const records = [hydrant("valid", -87.77), hydrant("nan", NaN), hydrant("range", 200), {...hydrant("missing", -87.77), latitude:null}];
  assert.deepEqual(clusterHydrantLocations(records, 14).flatMap(g => g.hydrants.map(h => h.id)), ["valid"]);
});

test("projection follows the actual map dimensions instead of stretching a fixed canvas", () => {
  const center = { lat: 41.82, lng: -87.77 };
  const east = { lat: center.lat, lng: center.lng + 0.001 };
  for (const size of [{width:360,height:390},{width:768,height:590},{width:1518,height:800}]) {
    assert.deepEqual(projectMapPoint(center, center, 17, size), {x:size.width/2,y:size.height/2});
    const position = projectMapPoint(east, center, 17, size);
    const expectedOffset = mapWorldPoint(east, 17).x - mapWorldPoint(center, 17).x;
    assert.ok(Math.abs(position.x - size.width / 2 - expectedOffset) < 1e-7);
  }
  assert.ok(Number.isFinite(mapWorldPoint({lat:90,lng:0}, 21).y));
});

test("Respond keeps compact symbols, selectable groups, exact record links and clean resize teardown", () => {
  const source = fs.readFileSync("app/respond-overview-map.tsx", "utf8");
  const css = fs.readFileSync("app/globals.css", "utf8");
  assert.match(source, /new ResizeObserver/);
  assert.match(source, /observer.disconnect\(\)/);
  assert.doesNotMatch(source, /width: 1600/);
  assert.match(source, /clusterHydrantLocations\(overview.hydrants, zoom\)/);
  assert.match(source, /selectedHydrants.map/);
  assert.match(source, /url.searchParams.set\("hydrant", hydrant.id\)/);
  assert.match(source, /Math.min\(21, current \+ 2\)/);
  assert.match(source, /className="respond-call-symbol"/);
  assert.match(source, /Group · tap to zoom/);
  assert.doesNotMatch(source, /H: hydrant/);
  assert.match(css, /\.respond-call-symbol\{[^}]*width:16px;height:16px/);
  assert.match(css, /@media\(pointer:coarse\)\{\.respond-overview-map \.respond-map-marker:is\(\.preplan,\.hydrant,\.call\)\{width:44px;height:44px/);
});

test("overview group badges stay separated and anchored to real record coordinates", () => {
  const records = Array.from({length:210}, (_, index) => ({...hydrant(`h${index}`, -87.784 + index % 15 * .00075),latitude:41.812 + Math.floor(index / 15) * .00065}));
  const groups = clusterHydrantLocations(records, 14);
  assert.ok(groups.length < 20);
  assert.equal(groups.reduce((count, group) => count + group.hydrants.length, 0), 210);
  for (const [index, group] of groups.entries()) {
    assert.equal(group.latitude, group.hydrants[0].latitude);
    assert.equal(group.longitude, group.hydrants[0].longitude);
    const p = mapWorldPoint({lat:group.latitude,lng:group.longitude},14);
    for (const other of groups.slice(index + 1)) {
      const q = mapWorldPoint({lat:other.latitude,lng:other.longitude},14);
      assert.ok(Math.hypot(p.x-q.x,p.y-q.y)>=48);
    }
  }
});
