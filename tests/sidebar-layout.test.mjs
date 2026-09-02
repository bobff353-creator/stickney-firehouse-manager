import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("the scrolling sidebar never shrinks navigation underneath its footer", () => {
  const css = fs.readFileSync("app/globals.css", "utf8");
  const children = css.match(/\.desktop-sidebar\s*>\s*\.sidebar-brand,\s*\.desktop-sidebar\s*>\s*\.sidebar-nav,\s*\.desktop-sidebar\s*>\s*\.sidebar-footer\s*\{([^}]+)\}/)?.[1] || "";
  assert.match(children, /flex-shrink:\s*0\s*;/);
  const sidebar = css.match(/\.desktop-sidebar\s*\{([^}]+)\}/)?.[1] || "";
  assert.match(sidebar, /overflow-y:\s*auto\s*;/);
  const footer = css.match(/\.sidebar-footer\s*\{([^}]+)\}/)?.[1] || "";
  assert.match(footer, /margin-top:\s*auto\s*;/);
  assert.doesNotMatch(footer, /position:\s*(absolute|fixed|sticky)/);
});
