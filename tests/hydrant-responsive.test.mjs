import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync("app/field-preplans.tsx", "utf8");
const css = fs.readFileSync("app/globals.css", "utf8");

test("hydrant editor uses its own available width instead of a desktop-only breakpoint", () => {
  assert.match(css, /\.hydrant-editor\{container:hydrant-editor \/ inline-size;min-width:0;max-width:100%\}/);
  assert.match(css, /@container hydrant-editor \(min-width:560px\)/);
  assert.match(css, /\.hydrant-editor :is\(\.hydrant-details,\.hydrant-maintenance,\.hydrant-flow-workspace,\.hydrant-quick\)\{display:grid;grid-template-columns:minmax\(0,1fr\)/);
});

test("all four hydrant sections are labelled, wrap, and retain their selected state", () => {
  assert.match(page, /nav aria-label="Hydrant record sections"/);
  for (const section of ["quick", "details", "flush", "flow"]) {
    assert.ok(page.includes(`aria-pressed={hydrantTab==="${section}"}`));
  }
  assert.match(css, /\.hydrant-editor>header nav\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\);gap:8px;overflow:visible\}/);
  assert.match(css, /\.hydrant-editor>header nav button\{[^}]*min-height:46px[^}]*white-space:normal/);
});

test("hydrant fields are touch-sized and long notes cannot widen the panel", () => {
  assert.match(css, /\.hydrant-editor :is\(input:not\(\[type=checkbox\]\),select,textarea\)\{[^}]*min-width:0;max-width:100%[^}]*min-height:46px;font-size:16px/);
  assert.match(css, /\.hydrant-editor textarea\{min-height:140px;resize:vertical\}/);
  assert.match(css, /\.hydrant-editor \.primary-action\{min-height:48px;width:100%/);
  assert.match(page, /className="hydrant-profile-actions"/);
  assert.ok(page.indexOf('className="content-card hydrant-summary"') > page.indexOf('className="hydrant-profile-actions"'));
});

test("hydrant identity retains GPS provenance and unverified port values", () => {
  assert.match(page, /aria-describedby="hydrant-address-help"/);
  assert.match(page, /The map uses this hydrant’s saved GPS location/);
  assert.match(page, /<option value="0">Unknown — verify in field<\/option>/);
  assert.match(page, /Port layout is unverified/);
  assert.match(page, /saveHydrantAction\(\{action:"saveHydrant",\.\.\.hydrantDraft\}/);
  assert.match(css, /\.hydrant-editor \.hydrant-summary>strong\.out_of_service\{background:#f8e5e2;color:#9a3328\}/);
});

test("compact maps and wider editors apply only to focused hydrant records", () => {
  assert.match(page, /hydrantDraft\?" hydrant-record-focused":""/);
  assert.match(css, /\.preplan-builder-focused\.hydrant-record-focused\{grid-template-columns:minmax\(0,\.9fr\) minmax\(440px,1\.1fr\)\}/);
  assert.match(css, /\.hydrant-record-focused>\.preplan-focus-map-panel>\.field-map\{min-height:260px\}/);
});
