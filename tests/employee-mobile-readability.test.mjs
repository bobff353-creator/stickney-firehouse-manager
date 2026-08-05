import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("phone employee cards keep values and disabled invitations readable in dark mode", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(styles, /\.employee-roster-card tbody tr, \.employee-roster-card td, \.employee-roster-card td strong \{ color: #17324d; \}/);
  assert.match(styles, /\.employee-roster-card td::before \{ color: #5b7180; \}/);
  assert.match(styles, /\.employee-roster-card \.invite-employee:disabled \{[^}]*background: #e7ecef; color: #5f707c; opacity: 1;/);
});
