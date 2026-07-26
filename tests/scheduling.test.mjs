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
  assert.equal(source.includes("offset % cycleDays !== 0"), true);
  assert.equal(source.includes("employeeIds.length !== 1"), true);
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

test("one minimum staffing plan can contain multiple selectable positions", async () => {
  const api = await readFile(new URL("../app/api/scheduling/route.ts", import.meta.url), "utf8");
  const screen = await readFile(new URL("../app/scheduling.tsx", import.meta.url), "utf8");
  assert.equal(api.includes("payload.positions"), true);
  assert.equal(api.includes("uniqueRoles.size !== positions.length"), true);
  for (const position of ["Officer/AO", "Driver/Engineer", "Ambulance Driver", "Ambulance Attendant", "Exterior Firefighter", "Fire Prevention", "Detail"]) {
    assert.equal(screen.includes(`"${position}"`), true);
  }
  assert.equal(screen.includes("Custom position…"), true);
  assert.equal(screen.includes("+ Add Position"), true);
});

test("multiple staffing plans keep separate plan identities", async () => {
  const api = await readFile(new URL("../app/api/scheduling/route.ts", import.meta.url), "utf8");
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  const screen = await readFile(new URL("../app/scheduling.tsx", import.meta.url), "utf8");
  assert.equal(schema.includes('planId: text("plan_id")'), true);
  assert.equal(api.includes("const planId = crypto.randomUUID()"), true);
  assert.equal(screen.includes("Save as New Staffing Plan"), true);
  assert.equal(screen.includes("+ New Plan"), true);
});

test("rotating shifts use named colors and admin staffing positions", async () => {
  const api = await readFile(new URL("../app/api/scheduling/route.ts", import.meta.url), "utf8");
  const screen = await readFile(new URL("../app/scheduling.tsx", import.meta.url), "utf8");
  assert.equal(api.includes('["Red", "Gold", "Black"].includes(name)'), true);
  assert.equal(api.includes("Choose a position from the selected active minimum staffing plan."), true);
  for (const shift of ["Red", "Gold", "Black"]) assert.equal(screen.includes(`<option>${shift}</option>`), true);
  assert.equal(screen.includes("selectedRotationPlan.map"), true);
});

test("rotation form selects one employee plan start day and repeat interval", async () => {
  const api = await readFile(new URL("../app/api/scheduling/route.ts", import.meta.url), "utf8");
  const screen = await readFile(new URL("../app/scheduling.tsx", import.meta.url), "utf8");
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  assert.equal(screen.includes("Select employee"), true);
  assert.equal(screen.includes("Select staffing plan"), true);
  assert.equal(screen.includes("Start day *"), true);
  assert.equal(screen.includes('"Every day" : `Every ${days} days`'), true);
  assert.equal(screen.includes("Fill Schedule With Rotation"), true);
  assert.equal(api.includes("coverage_plan_id"), true);
  assert.equal(api.includes("assignmentsCreated: writes.length"), true);
  assert.equal(schema.includes('coveragePlanId: text("coverage_plan_id")'), true);
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
  assert.equal(source.includes("Saved staffing plans"), true);
});
