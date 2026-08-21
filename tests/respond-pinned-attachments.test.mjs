import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(
  new URL("../app/api/respond/route.ts", import.meta.url),
  "utf8",
);
const source = fs.readFileSync(
  new URL("../app/respond.tsx", import.meta.url),
  "utf8",
);
const css = fs.readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
);

test("Respond reads only active private preplan assets and exposes the pin flag", () => {
  assert.match(
    route,
    /FROM field_preplan_assets WHERE preplan_id=\? AND archived=0/,
  );
  assert.match(route, /pin_to_respond pinToRespond/);
  assert.match(route, /assets:\s*assets\.results/);
});

test("Respond quick view shows only pinned level-aware attachments", () => {
  assert.match(
    source,
    /!item\.levelId \|\| item\.levelId === selectedLevel\?\.id/,
  );
  assert.match(source, /Boolean\(item\.pinToRespond\)/);
  assert.match(source, /Pinned to Respond/);
  assert.match(source, /Open all attachments/);
});

test("Respond attachment links stay on the authenticated private asset route", () => {
  assert.match(
    source,
    /\/api\/field-preplans\/assets\/\$\{encodeURIComponent\(item\.id\)\}/,
  );
  assert.match(
    css,
    /\.respond-attachments button,\.respond-attachments a\{min-height:44px\}/,
  );
});
