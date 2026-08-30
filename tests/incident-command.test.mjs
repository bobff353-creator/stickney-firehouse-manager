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

test("command state separates CAD units from audited manual on-scene units", async () => {
  const { emptyIncidentCommandState, reduceIncidentCommandState } = await loadCommandModule();
  const empty = emptyIncidentCommandState();
  assert.throws(() => reduceIncidentCommandState(empty, { action: "assign-unit", unitId: "DEMO-1", assignment: "Fire Attack" }, context()), /incident or manually added unit/);
  const manualUnit = reduceIncidentCommandState(empty, { action: "add-manual-unit", unitId: "  bc 1  " }, context());
  assert.deepEqual(manualUnit.state.manualUnits, ["BC 1"]);
  assert.equal(manualUnit.state.units["BC 1"].status, "On scene");
  assert.equal(manualUnit.state.units["BC 1"].assignment, "Staging");
  assert.match(manualUnit.summary, /manually added on scene/);
  assert.throws(() => reduceIncidentCommandState(manualUnit.state, { action: "add-manual-unit", unitId: "E1201" }, context()), /already listed/);
  const cadPosition = reduceIncidentCommandState(empty, { action: "assign-position", position: "Incident Commander", assignee: "unit:E1201" }, context());
  assert.equal(cadPosition.state.positions["Incident Commander"], "unit:E1201");
  const assigned = reduceIncidentCommandState(empty, { action: "assign-unit", unitId: "E1201", assignment: "Fire Attack", status: "On scene", floor: "Floor 1", side: "A" }, context());
  assert.equal(assigned.state.units.E1201.assignment, "Fire Attack");
  assert.equal(assigned.state.units.E1201.floor, "Floor 1");
  assert.equal(assigned.state.revision, 1);
  const positioned = reduceIncidentCommandState(assigned.state, { action: "assign-position", position: "Incident Commander", assignee: "unit:E1201" }, context());
  assert.equal(positioned.state.positions["Incident Commander"], "unit:E1201");
  const manual = reduceIncidentCommandState(positioned.state, { action: "assign-position", position: "Safety", assignee: "manual:Chief Smith / BC-1" }, context());
  assert.equal(manual.state.positions.Safety, "manual:Chief Smith / BC-1");
});

test("rehab chief accepts a roster member or a typed chief name without weakening RIT validation", async () => {
  const { emptyIncidentCommandState, reduceIncidentCommandState } = await loadCommandModule();
  const typed = reduceIncidentCommandState(emptyIncidentCommandState(), { action: "set-rehab", unitIds: ["E1201"], chiefEmployeeId: "manual:Chief Smith / BC 1" }, context());
  assert.equal(typed.state.rehab.chiefEmployeeId, "manual:Chief Smith / BC 1");
  const roster = reduceIncidentCommandState(typed.state, { action: "set-rehab", unitIds: ["E1201"], chiefEmployeeId: "employee-1" }, context());
  assert.equal(roster.state.rehab.chiefEmployeeId, "employee-1");
  assert.throws(() => reduceIncidentCommandState(roster.state, { action: "set-rit", unitId: "E1201", chiefEmployeeId: "manual:Outside Chief", readiness: "ready" }, context()), /authorized active employee/);
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

test("tactical assignment automates search and rehab without losing the audited unit location", async () => {
  const { emptyIncidentCommandState, reduceIncidentCommandState } = await loadCommandModule();
  const searching = reduceIncidentCommandState(emptyIncidentCommandState(), { action: "assign-unit", unitId: "E1201", assignment: "Primary Search", status: "On scene", floor: "Floor 1", side: "A" }, context());
  assert.equal(searching.state.searches["Floor 1"].primary, "in_progress");
  assert.match(searching.summary, /primary search started/);
  const rehab = reduceIncidentCommandState(searching.state, { action: "assign-unit", unitId: "E1201", assignment: "Rehab", status: "Rehab", floor: "", side: "" }, context());
  assert.deepEqual(rehab.state.rehab.unitIds, ["E1201"]);
  assert.equal(rehab.state.units.E1201.status, "Rehab");
});

test("hazards and incident closeout are validated, timestamped, and locked", async () => {
  const { emptyIncidentCommandState, reduceIncidentCommandState } = await loadCommandModule();
  const hazard = reduceIncidentCommandState(emptyIncidentCommandState(), { action: "add-hazard", label: "Electrical", floor: "Floor 1", side: "" }, context());
  assert.equal(hazard.state.hazards[0].label, "Electrical");
  assert.equal(hazard.state.hazards[0].floor, "Floor 1");
  assert.throws(() => reduceIncidentCommandState(hazard.state, { action: "end-call", confirmation: "yes" }, context()), /END INCIDENT/);
  const ended = reduceIncidentCommandState(hazard.state, { action: "end-call", confirmation: "END INCIDENT" }, context());
  assert.equal(ended.eventType, "incident-ended");
  assert.equal(ended.state.closeout.endedBy, "Authenticated Officer");
  assert.ok(ended.state.benchmarks["Incident terminated"]);
  assert.throws(() => reduceIncidentCommandState(ended.state, { action: "set-radio", radioChannel: "Fireground" }, context()), /incident is closed/i);
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
  assert.match(route, /state\.manualUnits/);
  assert.match(bootstrap, /incident_command_events/);
  assert.match(migration, /incident_command_event_revision_idx/);
  assert.match(page, /confirm-par-unit/);
  assert.match(page, /requestFullscreen/);
  assert.match(page, /dropUnitOnFloor/);
  assert.match(page, /DRAG A UNIT, OR TAP IT THEN TAP A FLOOR \/ SIDE/);
  assert.match(page, /icb-command-assignees/);
  assert.match(page, /\+ ADD UNIT/);
  assert.match(page, /icb-add-unit-form/);
  assert.match(page, /add-manual-unit/);
  assert.match(page, /icb-rehab-chief-suggestions/);
  assert.match(page, /Select or type chief name\/unit/);
  assert.match(page, /icb-idle-body/);
  assert.match(page, /icb-panel-toggle/);
  assert.match(page, /dropUnitOnSide/);
  assert.match(page, /dropUnitInRehab/);
  assert.match(page, /Primary Search.*primary search/si);
  assert.match(page, /armAlertTone/);
  assert.match(page, /icb-hazard-editor/);
  assert.match(page, /icb-history-drawer/);
  assert.match(page, /END CALL/);
  assert.match(page, /Print Report/);
  assert.match(route, /UPDATE dispatch_incidents SET active=0,cleared_at/);
  assert.match(page, /ACTIVE-INCIDENT LAYOUT/);
  assert.match(page, /PREVIEW · NOT ACTIVE/);
  assert.match(page, /PAR \/ ACCOUNTABILITY/);
  assert.match(page, /manual:/);
  assert.match(page, /side-a/);
  assert.match(page, /side-b/);
  assert.match(page, /side-c/);
  assert.match(page, /side-d/);
  assert.doesNotMatch(page, /360 Incident Command|Command 360|E-201|T-204|DEMO INCIDENT/i);
});
