import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("phone layout keeps navigation visible and content above the safe area", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const navigationStyles = await readFile(new URL("../app/today-dashboard.css", import.meta.url), "utf8");
  const shell = await readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8");
  assert.match(navigationStyles, /\.mobile-bottom-tabs[^}]+grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
  assert.match(shell, /Dashboard[\s\S]+Daily Log[\s\S]+Respond[\s\S]+More/);
  assert.match(shell, /\["Dashboard", "Today", "home"\][\s\S]+\["Respond", "Response", "warning"\][\s\S]+\["Inventory", "Operations", "box"\][\s\S]+\["Scheduling", "Schedule", "clock"\]/);
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

test("desktop navigation starts hidden and closes when no longer in use", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const shell = await readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8");
  const menu = await readFile(new URL("../app/portal-menu-items.ts", import.meta.url), "utf8");
  assert.match(shell, /const \[sidebarCollapsed, setSidebarCollapsed\] = useState\(true\)/);
  assert.match(shell, /className="desktop-sidebar-toggle"/);
  assert.match(shell, /Show navigation menu/);
  assert.match(shell, /Hide navigation menu/);
  assert.match(shell, /aria-controls="desktop-navigation"/);
  assert.doesNotMatch(shell, /stickney-desktop-menu-hidden/);
  assert.match(shell, /document\.addEventListener\("click", outsideMenu\)/);
  assert.match(shell, /document\.addEventListener\("focusin", outsideMenu\)/);
  assert.match(shell, /document\.removeEventListener\("click", outsideMenu\)/);
  assert.match(shell, /event\.key !== "Escape"/);
  assert.match(shell, /if \(!confirmLeavingWork\(\)\) return;\s+setDesktopMenuHidden\(true\)/);
  assert.match(shell, /if \(hidden && document\.activeElement\?\.closest\("#desktop-navigation"\)\)/);
  assert.match(shell, /className="sidebar-core-nav"/);
  assert.match(shell, /import.*featuredNavItems.*from "\.\/portal-menu-items"/);
  assert.match(menu, /page: "Dashboard", label: "Today"[\s\S]+page: "Respond", label: "Response"[\s\S]+page: "Inventory", label: "Operations"[\s\S]+page: "Scheduling", label: "Schedule"/);
  assert.ok(menu.match(/const featuredNavItems[\s\S]+?\];/));
  assert.doesNotMatch(menu.match(/const featuredNavItems[\s\S]+?\];/)?.[0], /Command Center|Station Board/);
  assert.match(menu, /label: "Operations"[\s\S]+label: "Command Center", page: "Command Center"/);
  assert.match(shell, /className="desktop-more-nav"[\s\S]+<span>More tools<\/span>/);
  assert.match(shell, /visibleMoreNavGroups\.some[\s\S]+setMoreToolsOpen\(true\)/);
  assert.doesNotMatch(shell, /navigate\(item\.page\); setSidebarCollapsed\(true\)/);
  assert.doesNotMatch(shell, /openNavGroups|sidebar-group-toggle/);
  assert.doesNotMatch(shell, /sidebar-collapse-toggle/);
  assert.match(styles, /\.sidebar-feature-icon\.apparatus\{background:#c92e4d\}/);
  assert.match(styles, /\.desktop-more-nav\{margin-top:9px/);
  assert.match(styles, /\.app-shell\.sidebar-collapsed \{ grid-template-columns: 0 minmax\(0, 1fr\)/);
  assert.match(styles, /\.sidebar-collapsed \.desktop-sidebar \{ opacity: 0; pointer-events: none; transform: translateX\(-100%\)/);
  assert.match(styles, /\.desktop-sidebar-toggle \{ display: none; \}/);
});
