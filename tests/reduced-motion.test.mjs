import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync("app/globals.css", "utf8");
const respond = fs.readFileSync("app/respond.tsx", "utf8");

test("reduced-motion preference stops animation, transitions, and smooth scrolling", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /scroll-behavior: auto !important/);
  assert.match(css, /transition: none !important/);
  assert.match(css, /animation: none !important/);
});

test("stopping motion does not remove Respond refresh or emergency labels", () => {
  assert.match(respond, /setInterval\(\(\) => void load\(\), 10000\)/);
  assert.match(respond, /alert\.severity\.toUpperCase\(\)/);
  assert.match(respond, /HAZMAT EMERGENCY DETAIL/);
  assert.match(respond, /OFFLINE — READ-ONLY PREPLAN/);
});
