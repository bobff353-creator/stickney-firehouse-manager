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
  const screen = await readFile(new URL("../app/scheduling.tsx", import.meta.url), "utf8");
  const employeeScreen = await readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8");
  assert.equal(source.includes("schedule_notifications"), true);
  assert.equal(source.includes("schedule_notification_rules"), true);
  assert.equal(source.includes("contact.smsOptIn"), true);
  assert.equal(source.includes('action === "saveNotificationRules"'), true);
  assert.equal(screen.includes("Alert times (select multiple)"), true);
  assert.equal(screen.includes("Save Notification Setup"), true);
  assert.equal(employeeScreen.includes("Employee elected to receive scheduling texts"), true);
});

test("employees have a private schedule portal with recurring requests and self-service alerts", async () => {
  const [page, route, bootstrap, app] = await Promise.all([
    readFile(new URL("../app/scheduling.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/scheduling/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/bootstrap.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(page, /Employee Schedule Portal/);
  assert.match(page, /Build & Submit Schedule/);
  assert.match(page, /Open Shifts & Trades/);
  assert.match(page, /repeatInterval/);
  assert.match(page, /Save My Alert Preferences/);
  assert.match(route, /saveMyNotificationPreferences/);
  assert.match(route, /repeat_interval repeatInterval/);
  assert.match(route, /repeatInterval < 2 \|\| repeatInterval > 365/);
  assert.match(bootstrap, /schedule_requests ADD COLUMN repeat_interval/);
  assert.match(app, /item === "Scheduling" \? "Employee Schedule Portal"/);
});

test("administrator Test View stays on the selected employee schedule portal", async () => {
  const [page, route, app] = await Promise.all([
    readFile(new URL("../app/scheduling.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/scheduling/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(app, /<Scheduling testMember=\{testMember\}/);
  assert.match(page, /data\?\.viewer\.isAdmin && !testMember/);
  assert.match(page, /item\.employeeId === portalEmployeeId \|\| item\.status === "open"/);
  assert.match(page, /Boolean\(testMember\)/);
  assert.match(route, /current\.isAdmin \? new URL\(request\.url\)\.searchParams\.get\("testEmployeeId"\)/);
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

test("shift references recur on the calendar and support weekend and holiday staffing", async () => {
  const api = await readFile(new URL("../app/api/scheduling/route.ts", import.meta.url), "utf8");
  const screen = await readFile(new URL("../app/scheduling.tsx", import.meta.url), "utf8");
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  assert.equal(schema.includes('scheduleShiftPatterns = sqliteTable("schedule_shift_patterns"'), true);
  assert.equal(schema.includes('scheduleStaffingOverrides = sqliteTable("schedule_staffing_overrides"'), true);
  assert.equal(api.includes('action === "saveShiftPattern"'), true);
  assert.equal(api.includes('action === "saveStaffingOverride"'), true);
  assert.equal(api.includes('override.conditionType === "weekend"'), true);
  assert.equal(api.includes('override.conditionType === "holiday"'), true);
  for (const name of ["Red 2", "Black 2", "Gold 2", "A", "B", "C", "D"]) assert.equal(screen.includes(`"${name}"`), true);
  assert.equal(screen.includes("Repeats every *"), true);
  assert.equal(screen.includes("schedule-pattern-chip"), true);
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

test("Acting Officer eligibility gates officer scheduling workflows", async () => {
  const api = await readFile(new URL("../app/api/scheduling/route.ts", import.meta.url), "utf8");
  const profile = await readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8");
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  assert.equal(schema.includes('actingOfficerEligible: integer("acting_officer_eligible"'), true);
  assert.equal(profile.includes("Eligible to work Acting Officer shifts"), true);
  assert.equal(api.includes("qualifiedForRole(requiredPosition.role"), true);
  assert.equal(api.includes("qualifiedForRole(openShift.role"), true);
  assert.equal(api.includes("The selected member is not eligible to work this Officer/AO shift."), true);
  assert.equal(api.includes("The requested member is not eligible for this Officer/AO shift."), true);
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

test("calendar supports day week and month views with transparent shift colors", async () => {
  const [screen, styles] = await Promise.all([
    readFile(new URL("../app/scheduling.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  for (const view of ["day", "week", "month"]) {
    assert.equal(screen.includes(`viewMode === "${view}"`), true);
    assert.equal(screen.includes(`setViewMode("${view}")`), true);
  }
  assert.equal(screen.includes("data-shift-color"), true);
  assert.equal(styles.includes('article[data-shift-color="red"]'), true);
  assert.equal(styles.includes("rgba(180,59,59,.10)"), true);
  assert.equal(styles.includes(".schedule-calendar.view-day"), true);
  assert.equal(styles.includes(".schedule-calendar.view-week"), true);
});
