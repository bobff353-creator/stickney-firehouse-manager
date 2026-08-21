import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../app/respond.tsx", import.meta.url),
  "utf8",
);
const css = fs.readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
);

test("Respond quick intelligence contains every required first-30-second field", () => {
  for (const label of [
    "Construction",
    "Floors",
    "Building area",
    "Advisory fire flow",
    "Occupancy",
    "Special population",
    "Fire protection",
    "Contacts",
    "Water supply",
  ])
    assert.match(source, new RegExp(label));
  assert.match(source, /aria-label="Quick building intelligence"/);
});

test("quick intelligence preserves unknown values and advisory fire-flow context", () => {
  assert.match(source, /Below[\s\S]*?Not verified/);
  assert.match(source, /None verified/);
  assert.match(source, /No emergency contact recorded/);
  assert.match(source, /No verified nearby hydrant/);
  assert.match(source, /Fire-flow value is an advisory planning estimate/);
});

test("quick intelligence remains responsive and high-contrast", () => {
  assert.match(css, /\.respond-quick-building\{[^}]*border:2px solid/);
  assert.match(
    css,
    /\.respond-quick-building dl\{[^}]*grid-template-columns:repeat\(3/,
  );
  assert.match(
    css,
    /@media\(max-width:560px\)\{\.respond-quick-building dl\{grid-template-columns:1fr\}\}/,
  );
});
