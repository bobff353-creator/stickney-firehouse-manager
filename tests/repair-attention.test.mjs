import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
const source = await readFile(new URL("../app/repair-attention.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { repairStage, repairAttention } = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
const now = Date.parse("2026-10-25T12:00:00Z");

test("legacy open repairs remain visible and unfamiliar statuses require review", () => {
  assert.equal(repairStage({ status: "open" }), "new");
  for (const status of [null, "", "unexpected", "completed"]) {
    assert.equal(repairStage({ status }), "unknown");
    assert.ok(repairAttention({ status }, now).includes("Status needs review"));
  }
});
test("missing ownership and invalid deadlines are explicit without inventing overdue dates", () => {
  assert.deepEqual(repairAttention({ status: "new", assigned_to: " ", assigned_employee_ids: [""] , due_at: "invalid" }, now), ["Owner not recorded", "Due date not recorded or invalid"]);
  for (const owner of [{ assigned_to: "Service shop" }, { assigned_employee_ids: ["employee-1"] }, { assigned_employee_names: ["Officer"] }]) {
    assert.deepEqual(repairAttention({ status: "assigned", due_at: "2026-10-26T12:00:00Z", ...owner }, now), []);
  }
});
test("only open repairs with elapsed valid deadlines are flagged as past due", () => {
  const repair = { assigned_to: "Shop", due_at: "2026-10-25T11:59:00Z" };
  assert.deepEqual(repairAttention({ ...repair, status: "in_repair" }, now), ["Past recorded due date"]);
  assert.deepEqual(repairAttention({ status: "closed" }, now), []);
  assert.deepEqual(repairAttention({ ...repair, status: "assigned", due_at: "2026-10-25T12:00:00Z" }, now), []);
});
