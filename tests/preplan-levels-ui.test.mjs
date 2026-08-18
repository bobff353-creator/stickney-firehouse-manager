import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("Field Preplans workspace has a Levels & Rooms tab wired to the level/room API actions", async () => {
  const page = await read("../app/field-preplans.tsx");
  assert.match(page, /Levels & Rooms/);
  assert.match(page, /action:"saveLevel"/);
  assert.match(page, /action:"deleteLevel"/);
  assert.match(page, /action:"saveSpace"/);
  assert.match(page, /action:"deleteSpace"/);
  // Only manage_layers-permitted users can add/remove levels; the Arrival
  // level itself is never deletable from the UI (layerType!=="arrival" guard).
  assert.match(page, /canManageLayers&&<article/);
  assert.match(page, /level\.layerType!=="arrival"&&canManageLayers/);
});

test("Respond surfaces the CAD room-match banner and a level switcher", async () => {
  const page = await read("../app/respond.tsx");
  assert.match(page, /respond-room-banner unique/);
  assert.match(page, /respond-room-banner ambiguous/);
  assert.match(page, /respond-level-switcher/);
  assert.match(page, /Return to Arrival/);
  assert.match(page, /respond-room-list/);
  // Selecting a level defaults from a unique CAD room match, falling back to
  // the mandatory default (Arrival) level when there is no match.
  assert.match(page, /roomMatch\?\.kind==="unique"&&data\.roomMatch\.level/);
  assert.match(page, /level\.isDefault\)\?\.id\|\|levels\[0\]\.id/);
});

test("respond.tsx globals.css defines the new room-match banner and level switcher styles", async () => {
  const css = await read("../app/globals.css");
  assert.match(css, /\.respond-room-banner\.unique/);
  assert.match(css, /\.respond-level-switcher button\.active/);
  assert.match(css, /\.respond-room-list li\.highlighted/);
});
