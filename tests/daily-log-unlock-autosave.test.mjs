import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("administrator unlock immediately enables Daily Log autosave", async () => {
  const component = await readFile(new URL("../app/daily-log.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/logbook/route.ts", import.meta.url), "utf8");

  assert.match(component, /autosaveAuthorized = useRef\(false\)/);
  assert.match(component, /autosaveAuthorized\.current = !serverLocked \|\| serverUnlocked/);
  assert.match(component, /response\.ok && result\.adminUnlocked === true/);
  assert.match(component, /autosaveAuthorized\.current = true/);
  assert.match(component, /changes save automatically/);
  assert.match(component, /!loaded\.current \|\| !autosaveAuthorized\.current/);
  assert.match(route, /adminUnlocked: true, autosaveEnabled: true/);
  assert.doesNotMatch(route, /SET locked = 1, admin_unlocked = 0/);
  assert.match(route, /\(date < operational\.lockBeforeDate \|\| existing\?\.locked\) && !existing\?\.adminUnlocked/);
});
