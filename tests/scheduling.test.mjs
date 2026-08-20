import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("the Claude Station Scheduler replaces the removed scheduling interface", async () => {
  const [shell, styles] = await Promise.all([
    readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(shell, /import StationScheduler from "\.\/station-scheduler"/);
  assert.match(shell, /page: "Scheduling"/);
  assert.match(shell, /activeNav === "Scheduling" && <StationScheduler/);
  assert.doesNotMatch(shell, /Employee Schedule Portal/);
  assert.doesNotMatch(styles, /@import "\.\/station-roster\.css"/);
  await assert.rejects(access(new URL("../app/scheduling.tsx", import.meta.url)));
  await assert.rejects(access(new URL("../app/station-roster.css", import.meta.url)));
});

test("schedule records and server workflows remain available for the replacement", async () => {
  const [api, bootstrap, schema, permissions] = await Promise.all([
    readFile(new URL("../app/api/scheduling/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/bootstrap.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/permissions.ts", import.meta.url), "utf8"),
  ]);
  for (const action of ["createRotation", "reviewRequest", "saveShiftPattern", "saveGeneratedSchedule", "respondTrade"]) {
    assert.match(api, new RegExp(`action === "${action}"`));
  }
  for (const table of ["schedule_assignments", "schedule_requests", "schedule_shift_patterns", "schedule_notifications"]) {
    assert.match(bootstrap, new RegExp(table));
  }
  assert.match(schema, /scheduleShiftPatterns/);
  assert.match(schema, /scheduleStaffingOverrides/);
  assert.match(permissions, /scheduling\.view/);
  assert.match(permissions, /scheduling\.manage/);
});

test("schedule generation remains availability gated for the future replacement", async () => {
  const [api, generator] = await Promise.all([
    readFile(new URL("../app/api/scheduling/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/schedule-generator.ts", import.meta.url), "utf8"),
  ]);
  assert.match(api, /generateScheduleDraft/);
  assert.match(api, /overlapping generated shifts/);
  assert.match(generator, /matchingRequests\(input\.requests, employee\.id, "availability"/);
});
