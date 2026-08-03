import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("phone layout keeps navigation visible and content above the safe area", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const shell = await readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8");
  assert.match(styles, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(shell, /Dashboard[\s\S]+Schedule[\s\S]+Daily Log[\s\S]+Respond[\s\S]+More/);
  assert.match(styles, /padding-bottom:calc\(94px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(styles, /\.schedule-weekdays,\.schedule-calendar\.view-month\{min-width:0\}/);
  assert.match(styles, /\.mobile-brand strong\{display:none\}/);
  assert.match(styles, /\.mobile-nav-panel\{position:fixed;z-index:100;left:8px;right:8px;bottom:64px/);
  assert.match(shell, /<\/header>\s*\{mobileMenuOpen && <nav id="mobile-navigation"/);
});

test("phone dark mode keeps Daily Log and schedule controls readable", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(styles, /\.staff-row select,[^{]+\{background:#f8fafb;color:#17324d\}/);
  assert.match(styles, /\.shift-title h3,[^{]+\{color:#eef4f7\}/);
  assert.match(styles, /\.schedule-calendar>article,[^{]+\{color:#17324d\}/);
});
