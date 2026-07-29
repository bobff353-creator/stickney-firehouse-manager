import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { availableHydrantFlow, hydrantOutletFlow, nfpa291FlowClass } from "../app/hydrant-flow.ts";

test("NFPA 291 hydrant discharge and available-flow math is deterministic", () => {
  const measured = hydrantOutletFlow(2.5, 20, 0.9);
  assert.equal(Math.round(measured), 750);
  const available = availableHydrantFlow(measured, 70, 50, 20);
  assert.equal(Math.round(available), 1231);
  assert.equal(nfpa291FlowClass(available).code, "A");
  assert.equal(availableHydrantFlow(measured, 50, 50, 20), 0);
});

test("Field map supports quick hydrants, clustering, maintenance, and guided flow testing", async () => {
  const [page, route, bootstrap] = await Promise.all([
    readFile(new URL("../app/field-preplans.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/field-hydrants/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/bootstrap.ts", import.meta.url), "utf8"),
  ]);
  assert.match(page, /\+ Add Hydrant/);
  assert.match(page, /hydrant-cluster/);
  assert.match(page, /HydrantIcon/);
  assert.match(page, /NFPA 291 guided flow test/);
  assert.match(page, /Static pressure/);
  assert.match(page, /Residual pressure while flowing/);
  assert.match(page, /Pitot pressure/);
  assert.match(page, /0\.90 · smooth \/ rounded outlet/);
  assert.match(route, /action==="addFlush"/);
  assert.match(route, /action==="addFlowTest"/);
  assert.match(route, /hydrantOutletFlow/);
  assert.match(route, /availableHydrantFlow/);
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS field_hydrants/);
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS field_hydrant_flushes/);
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS field_hydrant_flow_tests/);
});
