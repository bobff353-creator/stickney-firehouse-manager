import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadCommandModule() {
  const source = await readFile(new URL("../app/incident-command-state.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

function context() {
  return {
    actor: "Authenticated Officer",
    now: "2026-07-29T15:00:00.000Z",
    validPersonnel: new Set(["employee-1"]),
    validUnits: new Set(["E1201", "T1204"]),
    validLevels: new Set(["Floor 2", "Floor 1", "Basement"]),
  };
}

test("command state accepts only real CAD units and active personnel", async () => {
  const { emptyIncidentCommandState, reduceIncidentCommandState } = await loadCommandModule();
  const empty = emptyIncidentCommandState();
  assert.throws(() => reduceIncidentCommandState(empty, { action: "assign-unit", unitId: "DEMO-1", assignment: "Fire Attack" }, context()), /assigned by CAD/);
  assert.throws(() => reduceIncidentCommandState(empty, { action: "assign-position", position: "Incident Commander", employeeId: "unknown" }, context()), /active employee/);
  const assigned = reduceIncidentCommandState(empty, { action: "assign-unit", unitId: "E1201", assignment: "Fire Attack", floor: "Floor 1", side: "A" }, context());
  assert.equal(assigned.state.units.E1201.assignment, "Fire Attack");
  assert.equal(assigned.state.units.E1201.floor, "Floor 1");
  assert.equal(assigned.state.revision, 1);
});

test("PAR is confirmed separately for each CAD unit", async () => {
  const { emptyIncidentCommandState, reduceIncidentCommandState } = await loadCommandModule();
  const first = reduceIncidentCommandState(emptyIncidentCommandState(), { action: "confirm-par-unit", unitId: "E1201" }, context());
  assert.deepEqual(Object.keys(first.state.par.confirmations), ["E1201"]);
  const second = reduceIncidentCommandState(first.state, { action: "confirm-par-unit", unitId: "T1204" }, context());
  assert.deepEqual(Object.keys(second.state.par.confirmations).sort(), ["E1201", "T1204"]);
  assert.equal(second.state.revision, 2);
});

test("Mayday activation and resolution require intentional confirmation phrases", async () => {
  const { emptyIncidentCommandState, reduceIncidentCommandState } = await loadCommandModule();
  const empty = emptyIncidentCommandState();
  assert.throws(() => reduceIncidentCommandState(empty, { action: "set-mayday", active: true, confirmation: "yes" }, context()), /CONFIRM MAYDAY/);
  const activated = reduceIncidentCommandState(empty, { action: "set-mayday", active: true, confirmation: "CONFIRM MAYDAY" }, context());
  assert.equal(activated.state.mayday.active, true);
  assert.equal(activated.eventType, "mayday-activated");
  assert.throws(() => reduceIncidentCommandState(activated.state, { action: "set-mayday", active: false, confirmation: "done" }, context()), /RESOLVE MAYDAY/);
});

test("search completion, support, and tactical profile changes are revisioned", async () => {
  const { emptyIncidentCommandState, reduceIncidentCommandState, tacticalLevels } = await loadCommandModule();
  const profile = reduceIncidentCommandState(emptyIncidentCommandState(), { action: "set-building", floorCount: 2, basement: "present" }, context());
  assert.deepEqual(tacticalLevels(profile.state, 1), ["Floor 2", "Floor 1", "Basement"]);
  const search = reduceIncidentCommandState(profile.state, { action: "set-search", level: "Floor 1", phase: "primary", status: "confirmed" }, context());
  const support = reduceIncidentCommandState(search.state, { action: "set-support", resource: "Gas", status: "called" }, context());
  assert.equal(search.state.searches["Floor 1"].primary, "confirmed");
  assert.equal(support.state.support.Gas, "called");
  assert.equal(support.state.revision, 3);
});

test("Command Board is under Field, permission gated, durable, and contains no copied demo identity", async () => {
  const [app, page, route, permissions, bootstrap, migration] = await Promise.all([
    readFile(new URL("../app/payroll-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/incident-command-board.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/incident-command/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/permissions.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/bootstrap.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0028_incident_command_board.sql", import.meta.url), "utf8"),
  ]);
  assert.match(app, /label: "Field".*page: "Command Board"/);
  assert.match(app, /"Command Board": "incident_command\.view"/);
  assert.match(permissions, /incident_command\.manage/);
  assert.match(route, /dispatch_incidents/);
  assert.match(route, /field_preplans/);
  assert.match(route, /expectedRevision/);
  assert.match(bootstrap, /incident_command_events/);
  assert.match(migration, /incident_command_event_revision_idx/);
  assert.match(page, /confirm-par-unit/);
  assert.match(page, /requestFullscreen/);
  assert.match(page, /side-a/);
  assert.match(page, /side-b/);
  assert.match(page, /side-c/);
  assert.match(page, /side-d/);
  assert.doesNotMatch(page, /360 Incident Command|Command 360|E-201|T-204|DEMO INCIDENT/i);
});
