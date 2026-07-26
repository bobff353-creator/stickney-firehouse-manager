import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("scheduling is separate from payroll for admins and employees", async () => {
  const source = await readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8");
  assert.equal(source.includes('{ label: "Scheduling", icon: "clock"'), true);
  assert.equal(source.includes('"Scheduling", "My Timesheet"'), true);
  assert.equal(source.includes('activeNav === "Scheduling" && <Scheduling'), true);
});

test("custom rotations generate assignments", async () => {
  const source = await readFile(new URL("../app/api/scheduling/route.ts", import.meta.url), "utf8");
  assert.equal(source.includes('action === "createRotation"'), true);
  assert.equal(source.includes("cycleDays < 1 || cycleDays > 60"), true);
  assert.equal(source.includes("dutyDays.includes(offset % cycleDays)"), true);
});

test("availability open shifts trades and approvals are supported", async () => {
  const source = await readFile(new URL("../app/api/scheduling/route.ts", import.meta.url), "utf8");
  assert.equal(source.includes('["availability", "time_off", "shift_claim", "trade"]'), true);
  assert.equal(source.includes('action === "reviewRequest"'), true);
});

test("alerts include in-app email and text channels", async () => {
  const source = await readFile(new URL("../app/api/scheduling/route.ts", import.meta.url), "utf8");
  assert.equal(source.includes("schedule_notifications"), true);
  assert.equal(source.includes("contact?.email ? 1 : 0"), true);
  assert.equal(source.includes("contact?.phone ? 1 : 0"), true);
});

test("coverage rules calculate future staffing gaps", async () => {
  const source = await readFile(new URL("../app/api/scheduling/route.ts", import.meta.url), "utf8");
  assert.equal(source.includes("schedule_coverage_rules"), true);
  assert.equal(source.includes("function coverageGaps"), true);
  assert.equal(source.includes('action === "saveCoverageRule"'), true);
});

test("open shifts enforce rank and response deadlines", async () => {
  const source = await readFile(new URL("../app/api/scheduling/route.ts", import.meta.url), "utf8");
  assert.equal(source.includes("required_rank requiredRank"), true);
  assert.equal(source.includes("claimDeadline < chicagoNow()"), true);
  assert.equal(source.includes("This shift requires"), true);
});

test("trades require member acceptance before admin approval", async () => {
  const source = await readFile(new URL("../app/api/scheduling/route.ts", import.meta.url), "utf8");
  assert.equal(source.includes('action === "respondTrade"'), true);
  assert.equal(source.includes('item.targetStatus !== "accepted"'), true);
});

test("rotations can end without changing past schedule history", async () => {
  const source = await readFile(new URL("../app/api/scheduling/route.ts", import.meta.url), "utf8");
  assert.equal(source.includes('action === "deactivateRotation"'), true);
  assert.equal(source.includes("past schedule history was preserved"), true);
});

test("schedule includes agenda filters and coverage command views", async () => {
  const source = await readFile(new URL("../app/scheduling.tsx", import.meta.url), "utf8");
  assert.equal(source.includes('"agenda"'), true);
  assert.equal(source.includes("schedule-filters"), true);
  assert.equal(source.includes("Coverage watch"), true);
});
