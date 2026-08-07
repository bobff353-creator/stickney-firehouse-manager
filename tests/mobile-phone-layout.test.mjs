import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("phone layout keeps navigation visible and content above the safe area", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const shell = await readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8");
  assert.match(styles, /\.mobile-bottom-tabs[^}]+grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(shell, /Dashboard[\s\S]+Daily Log[\s\S]+Respond[\s\S]+More/);
  assert.doesNotMatch(shell, /\["Scheduling", "Schedule", "clock"\]/);
  assert.match(styles, /padding-bottom:calc\(94px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(styles, /\.mobile-brand strong\{display:none\}/);
  assert.match(styles, /\.mobile-nav-panel\{position:fixed;z-index:100;left:8px;right:8px;bottom:64px/);
  assert.match(shell, /<\/header>\s*\{mobileMenuOpen && <nav id="mobile-navigation"/);
});

test("phone dark mode keeps Daily Log controls readable", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(styles, /\.staff-row select,[^{]+\{background:#f8fafb;color:#17324d\}/);
  assert.match(styles, /\.shift-title h3,[^{]+\{color:#eef4f7\}/);
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
