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
  assert.match(shell, /schedule-page-tabs/);
  assert.match(styles, /\.schedule-page-tabs\{top:72px/);
  assert.doesNotMatch(styles, /main\.app-shell:has\(\.station-roster-scope\) > \.mobile-bottom-tabs \{ display: none; \}/);
  assert.match(styles, /\.schedule-tabs\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\);overflow:visible\}/);
  assert.match(styles, /\.schedule-date-button\{min-width:32px;min-height:32px/);
});

test("phone dark mode keeps Daily Log and schedule controls readable", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(styles, /\.staff-row select,[^{]+\{background:#f8fafb;color:#17324d\}/);
  assert.match(styles, /\.shift-title h3,[^{]+\{color:#eef4f7\}/);
  assert.match(styles, /\.schedule-calendar>article,[^{]+\{color:#17324d\}/);
});

test("desktop navigation opens from the header and fully clears the workspace when closed", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const shell = await readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8");
  assert.match(shell, /useState\(true\)/);
  assert.match(shell, /className="desktop-sidebar-toggle"/);
  assert.match(shell, /Open navigation menu/);
  assert.match(shell, /aria-controls="desktop-navigation"/);
  assert.match(shell, /setOpenNavGroups\(\(current\) => current\.has\(group\) \? new Set\(\) : new Set\(\[group\]\)\)/);
  assert.doesNotMatch(shell, /sidebar-collapse-toggle/);
  assert.match(styles, /\.app-shell\.sidebar-collapsed \{ grid-template-columns: 0 minmax\(0, 1fr\)/);
  assert.match(styles, /\.sidebar-collapsed \.desktop-sidebar \{ opacity: 0; pointer-events: none; transform: translateX\(-100%\)/);
  assert.match(styles, /\.desktop-sidebar-toggle \{ display: none; \}/);
});
