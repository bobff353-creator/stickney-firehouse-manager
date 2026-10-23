import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadModule(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}
const editors = await loadModule("../app/incident-command-editors.ts");
const command = await loadModule("../app/incident-command-state.ts");
const context = {
  actor: "Local fixture officer", now: "2026-10-23T15:00:00Z",
  validPersonnel: new Set(["fixture-person"]), validUnits: new Set(["FIXTURE-E1", "FIXTURE-T1"]),
  validLevels: new Set(["Floor 2", "Floor 1", "Basement", "Level unknown"]),
};
const reduce = (state, mutation) => command.reduceIncidentCommandState(state, mutation, context).state;

test("unrelated shared revisions preserve every command editor while clean fields refresh", () => {
  const state = command.emptyIncidentCommandState();
  let local = editors.reconcileCommandEditors(null, "fixture-call", state);
  local.radio = editors.changeCommandEditor(local.radio, "Local radio draft");
  local.rit = editors.changeCommandEditor(local.rit, { ...local.rit.draft, unitId: "FIXTURE-E1" });
  local.rehab = editors.changeCommandEditor(local.rehab, { ...local.rehab.draft, assignmentNote: "Local location draft" });
  const refreshed = editors.reconcileCommandEditors(local, "fixture-call", { ...state, revision: 9 });
  assert.equal(refreshed.radio.draft, "Local radio draft");
  assert.equal(refreshed.rit.draft.unitId, "FIXTURE-E1");
  assert.equal(refreshed.rehab.draft.assignmentNote, "Local location draft");
  assert.equal(refreshed.radio.conflict || refreshed.rit.conflict || refreshed.rehab.conflict, false);
  const clean = editors.reconcileCommandEditors(null, "fixture-call", state);
  assert.equal(editors.reconcileCommandEditors(clean, "fixture-call", { ...state, radioChannel: "Saved radio" }).radio.draft, "Saved radio");
});

test("same-field changes retain the draft and require explicit review before replacement", () => {
  let local = editors.changeCommandEditor(editors.newCommandEditor("Original"), "Mine");
  local = editors.reconcileCommandEditor(local, "Colleague");
  assert.deepEqual(local, { baseline: "Original", draft: "Mine", saved: "Colleague", conflict: true });
  local = editors.reconcileCommandEditor(local, "Colleague");
  assert.equal(local.conflict, true, "another poll must not dismiss the conflict");
  const keep = editors.reviewCommandEditor(local, true);
  assert.equal(keep.draft, "Mine");
  assert.equal(keep.baseline, "Colleague");
  assert.equal(keep.conflict, false);
  assert.equal(editors.reconcileCommandEditor(keep, "Another colleague update").conflict, true);
  const saved = editors.reviewCommandEditor(local, false);
  assert.equal(saved.draft, "Colleague");
  assert.equal(editors.commandEditorDirty(saved), false);
});

test("editing back to the original value during a conflict still retains that explicit draft", () => {
  let local = editors.changeCommandEditor(editors.newCommandEditor("Original"), "Mine");
  local = editors.reconcileCommandEditor(local, "Colleague");
  local = editors.changeCommandEditor(local, "Original");
  assert.equal(editors.reconcileCommandEditor(local, "Colleague").draft, "Original");
  assert.equal(editors.reconcileCommandEditor(local, "Colleague").conflict, true);
});

test("confirmed own save clears dirty state and later saved changes refresh normally", () => {
  const local = editors.changeCommandEditor(editors.newCommandEditor("Original"), "Mine");
  const confirmed = editors.reconcileCommandEditor(local, "Mine");
  assert.equal(editors.commandEditorDirty(confirmed), false);
  assert.equal(editors.reconcileCommandEditor(confirmed, "Next saved change").draft, "Next saved change");
});

test("switching incident or department resets command editor scope", () => {
  const state = command.emptyIncidentCommandState();
  const local = editors.reconcileCommandEditors(null, "department-one:call-one", state);
  local.radio = editors.changeCommandEditor(local.radio, "Local radio draft");
  const next = editors.reconcileCommandEditors(local, "department-two:call-two", state);
  assert.equal(next.radio.draft, "");
  assert.equal(next.scope, "department-two:call-two");
});

test("removing Rehab units stages their actual assignment and preserves crew count", () => {
  let state = reduce(command.emptyIncidentCommandState(), { action: "assign-unit", unitId: "FIXTURE-E1", assignment: "Fire Attack", status: "On scene", crewStrength: 4 });
  state = reduce(state, { action: "set-rehab", unitIds: ["FIXTURE-E1", "FIXTURE-T1"], chiefEmployeeId: "" });
  state = reduce(state, { action: "set-rehab", unitIds: ["FIXTURE-T1"], chiefEmployeeId: "" });
  assert.deepEqual(state.rehab.unitIds, ["FIXTURE-T1"]);
  assert.deepEqual(state.units["FIXTURE-E1"], { assignment: "Staging", status: "Staged", floor: "", side: "", crewStrength: 4 });
  assert.equal(state.units["FIXTURE-T1"].assignment, "Rehab");
  assert.equal(state.units["FIXTURE-T1"].status, "Rehab");
});

test("blank crew count clears a reported number while omitted count preserves it", () => {
  let state = reduce(command.emptyIncidentCommandState(), { action: "assign-unit", unitId: "FIXTURE-E1", assignment: "Fire Attack", crewStrength: 4 });
  state = reduce(state, { action: "assign-unit", unitId: "FIXTURE-E1", assignment: "Primary Search", floor: "Floor 1" });
  assert.equal(state.units["FIXTURE-E1"].crewStrength, 4);
  state = reduce(state, { action: "assign-unit", unitId: "FIXTURE-E1", assignment: "Primary Search", crewStrength: null });
  assert.equal(state.units["FIXTURE-E1"].crewStrength, null);
});

test("RIT Ready requires a valid unit and does not impose a chief requirement", () => {
  const empty = command.emptyIncidentCommandState();
  assert.throws(() => reduce(empty, { action: "set-rit", unitId: "", chiefEmployeeId: "", readiness: "ready" }), /Assign a RIT unit/);
  assert.throws(() => reduce(empty, { action: "set-rit", unitId: "UNAUTHORIZED", chiefEmployeeId: "", readiness: "ready" }), /incident or manually added/);
  assert.equal(reduce(empty, { action: "set-rit", unitId: "FIXTURE-E1", chiefEmployeeId: "", readiness: "ready" }).rit.readiness, "ready");
  assert.equal(reduce(empty, { action: "set-rit", unitId: "", chiefEmployeeId: "", readiness: "not_reported" }).rit.unitId, "");
  const legacy = { ...empty, rit: { unitId: "", chiefEmployeeId: "", readiness: "ready" } };
  assert.equal(reduce(legacy, { action: "set-radio", radioChannel: "Fixture" }).rit.readiness, "ready", "an unrelated change must not rewrite legacy RIT data");
});

test("corrected building profiles keep recorded crews, hazards, and search levels visible", () => {
  let state = reduce(command.emptyIncidentCommandState(), { action: "set-building", floorCount: 2, basement: "present" });
  state = reduce(state, { action: "assign-unit", unitId: "FIXTURE-E1", assignment: "Fire Attack", floor: "Floor 2" });
  state = reduce(state, { action: "add-hazard", label: "Local fixture hazard", floor: "Basement", side: "" });
  state = reduce(state, { action: "set-search", level: "Floor 2", phase: "primary", status: "confirmed" });
  state = reduce(state, { action: "set-building", floorCount: 1, basement: "none" });
  assert.equal(state.building.floorCount, 1);
  assert.deepEqual(command.tacticalLevels(state), ["Floor 2", "Floor 1", "Basement"]);
  assert.equal(state.units["FIXTURE-E1"].floor, "Floor 2");
  assert.equal(state.hazards[0].floor, "Basement");
  assert.equal(state.searches["Floor 2"].primary, "confirmed");
  state.searches["Level unknown"] = { primary: "in_progress" };
  assert.ok(command.tacticalLevels(state).includes("Level unknown"));
});
