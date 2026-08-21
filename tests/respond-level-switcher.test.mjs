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

test("Respond defaults to the published default level and preserves a valid selection", () => {
  assert.match(
    source,
    /operational\?\.levels\.find\(\(level\) => Boolean\(level\.isDefault\)\)/,
  );
  assert.match(source, /level\.id === selectedLevelId/);
});

test("Respond keeps global warnings while filtering level-specific records", () => {
  assert.equal(
    (
      source.match(
        /!item\.levelId \|\| item\.levelId === selectedLevel\?\.id/g,
      ) ?? []
    ).length,
    2,
  );
  assert.match(source, /visibleAlerts\.slice\(0, 3\)/);
  assert.match(source, /visibleHazmat\.slice\(0, 3\)/);
});

test("Respond exposes a persistent accessible switcher with fireground touch targets", () => {
  assert.match(source, /aria-label="Preplan level"/);
  assert.match(source, /aria-pressed=\{selectedLevel\?\.id === level\.id\}/);
  assert.match(css, /\.respond-level-switcher\{position:sticky/);
  assert.match(
    css,
    /\.respond-level-switcher button\{min-width:44px;min-height:44px/,
  );
});
