import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  isValidGeometry,
  parseAliasList,
  polygonCentroid,
  searchableNames,
  spaceTypeLabel,
} from "../app/preplans/spaces.ts";
import {
  extractFloorHint,
  extractRoomMentions,
  matchCadToRoom,
} from "../app/preplans/cad-room-match.ts";

function makeSpace(overrides = {}) {
  return {
    id: "space-1",
    preplanId: "preplan-1",
    levelId: "level-floor-2",
    displayName: "Classroom 205",
    roomNumber: "205",
    spaceType: "classroom",
    aliases: [],
    cadKeywords: [],
    geometry: [],
    labelPosition: null,
    typicalOccupancy: 28,
    peakOccupancy: 30,
    specialPopulationNotes: "",
    accessNotes: "",
    fireProtectionNotes: "",
    hazards: "",
    createdBy: "system",
    updatedBy: "system",
    ...overrides,
  };
}

function makeLevel(overrides = {}) {
  return {
    id: "level-floor-2",
    preplanId: "preplan-1",
    name: "Floor 2",
    shortLabel: "FLOOR 2",
    layerType: "floor",
    floorIndex: 2,
    grade: "above_grade",
    sortOrder: 2,
    isDefault: false,
    respondVisible: true,
    hidden: false,
    backgroundType: "none",
    backgroundAssetKey: null,
    backgroundTransform: "{}",
    createdBy: "system",
    updatedBy: "system",
    ...overrides,
  };
}

test("alias parsing dedupes and normalizes comma/semicolon/newline separated lists", () => {
  assert.deepEqual(parseAliasList("Room 205, RM 205; classroom 205\nClassroom 205"), ["Room 205", "RM 205", "classroom 205"]);
  assert.deepEqual(parseAliasList(""), []);
  assert.deepEqual(parseAliasList("  ,  ;\n"), []);
});

test("searchable names include the room number in every common CAD phrasing", () => {
  const names = searchableNames(makeSpace());
  for (const expected of ["classroom 205", "205", "room 205", "rm 205", "rm. 205"]) {
    assert.equal(names.includes(expected), true, `expected "${expected}" in searchable names`);
  }
});

test("searchable names include explicit aliases and CAD keywords", () => {
  const names = searchableNames(makeSpace({ aliases: ["Main Boiler Room"], cadKeywords: ["boiler"] }));
  assert.equal(names.includes("main boiler room"), true);
  assert.equal(names.includes("boiler"), true);
});

test("geometry validation requires at least 3 normalized points inside 0..1", () => {
  assert.equal(isValidGeometry([]), false);
  assert.equal(isValidGeometry([{ x: 0, y: 0 }, { x: 1, y: 0 }]), false, "two points cannot form a polygon");
  assert.equal(isValidGeometry([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]), true);
  assert.equal(isValidGeometry([{ x: -0.1, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]), false, "out of normalized bounds");
});

test("polygon centroid gives a reasonable default label position", () => {
  const centroid = polygonCentroid([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]);
  assert.deepEqual(centroid, { x: 0.5, y: 0.5 });
  assert.equal(polygonCentroid([]), null);
});

test("space type labels are human readable", () => {
  assert.equal(spaceTypeLabel("boiler_room"), "Boiler Room");
  assert.equal(spaceTypeLabel("roof_access"), "Roof Access");
});

test("extractFloorHint recognizes numeric, ordinal, division, basement, and roof phrasing", () => {
  assert.deepEqual(extractFloorHint("Smoke showing from floor 2"), { kind: "floor", floorIndex: 2 });
  assert.deepEqual(extractFloorHint("Fire on the 2nd floor"), { kind: "floor", floorIndex: 2 });
  assert.deepEqual(extractFloorHint("Alarm activation Division 2"), { kind: "floor", floorIndex: 2 });
  assert.deepEqual(extractFloorHint("Water flow alarm basement"), { kind: "basement" });
  assert.deepEqual(extractFloorHint("Person stuck on roof"), { kind: "roof" });
  assert.equal(extractFloorHint("Odor of smoke, unknown origin"), null);
});

test("extractRoomMentions finds classroom/room/rm/suite/unit phrasing", () => {
  assert.deepEqual(extractRoomMentions("Smoke showing from Classroom 205"), ["classroom 205", "205"]);
  assert.deepEqual(extractRoomMentions("Fire alarm RM 12"), ["rm 12", "12"]);
  assert.deepEqual(extractRoomMentions("Water leak Suite 4B"), ["suite 4b", "4b"]);
  assert.deepEqual(extractRoomMentions("Unknown medical, no room given"), []);
});

test("Scenario A — a unique room mention auto-selects the level and room", () => {
  const space = makeSpace();
  const level = makeLevel();
  const result = matchCadToRoom("Smoke showing from Classroom 205", [space], [level]);
  assert.equal(result.kind, "unique");
  assert.equal(result.space.id, "space-1");
  assert.equal(result.level.levelId, "level-floor-2");
  assert.match(result.explanation, /Classroom 205/);
  assert.match(result.explanation, /Floor 2/);
});

test("an ambiguous room number across levels is disambiguated by a floor hint when present", () => {
  const spaceFloor1 = makeSpace({ id: "space-f1", levelId: "level-floor-1", displayName: "Room 205" });
  const spaceFloor2 = makeSpace({ id: "space-f2", levelId: "level-floor-2", displayName: "Room 205" });
  const levelFloor1 = makeLevel({ id: "level-floor-1", name: "Floor 1", floorIndex: 1 });
  const levelFloor2 = makeLevel({ id: "level-floor-2", name: "Floor 2", floorIndex: 2 });
  const result = matchCadToRoom("2nd floor, Room 205", [spaceFloor1, spaceFloor2], [levelFloor1, levelFloor2]);
  assert.equal(result.kind, "unique");
  assert.equal(result.space.id, "space-f2");
});

test("an ambiguous room number with no floor hint surfaces selectable candidates instead of guessing", () => {
  const spaceFloor1 = makeSpace({ id: "space-f1", levelId: "level-floor-1", displayName: "Room 205" });
  const spaceFloor2 = makeSpace({ id: "space-f2", levelId: "level-floor-2", displayName: "Room 205" });
  const levelFloor1 = makeLevel({ id: "level-floor-1", name: "Floor 1", floorIndex: 1 });
  const levelFloor2 = makeLevel({ id: "level-floor-2", name: "Floor 2", floorIndex: 2 });
  const result = matchCadToRoom("Fire in Room 205", [spaceFloor1, spaceFloor2], [levelFloor1, levelFloor2]);
  assert.equal(result.kind, "ambiguous");
  assert.equal(result.candidates.length, 2);
});

test("a weak floor-only mention with no room number never triggers a room match", () => {
  const space = makeSpace();
  const level = makeLevel();
  const result = matchCadToRoom("Smoke investigation, second floor", [space], [level]);
  assert.equal(result.kind, "none");
});

test("no room-shaped text in narrative falls through to Arrival without a match", () => {
  const space = makeSpace();
  const level = makeLevel();
  assert.deepEqual(matchCadToRoom("Odor of gas outside", [space], [level]), { kind: "none" });
  assert.deepEqual(matchCadToRoom("", [space], [level]), { kind: "none" });
});

test("room-shaped text that matches nothing in this building falls through to Arrival", () => {
  const space = makeSpace();
  const level = makeLevel();
  const result = matchCadToRoom("Smoke showing from Room 999", [space], [level]);
  assert.equal(result.kind, "none");
});

test("bootstrap creates the field_preplan_spaces table with the level/preplan foreign keys", async () => {
  const bootstrap = await readFile(new URL("../db/bootstrap.ts", import.meta.url), "utf8");
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS field_preplan_spaces/);
  assert.match(bootstrap, /level_id TEXT NOT NULL REFERENCES field_preplan_levels\(id\)/);
  assert.match(bootstrap, /aliases TEXT NOT NULL DEFAULT '\[\]'/);
  assert.match(bootstrap, /cad_keywords TEXT NOT NULL DEFAULT '\[\]'/);
  assert.match(bootstrap, /field_preplan_space_preplan_idx/);
  assert.match(bootstrap, /field_preplan_space_level_idx/);
});
