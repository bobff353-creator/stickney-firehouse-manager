import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadShiftClock() {
  const source = await readFile(new URL("../app/operations-shift-time.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("Live Operations points the overnight shift to 6 AM Chicago time", async () => {
  const { nextOperationsShiftChange } = await loadShiftClock();
  assert.deepEqual(nextOperationsShiftChange(new Date("2026-08-01T02:00:00Z")), { label:"6:00 AM", remaining:"9h 0m" });
  assert.deepEqual(nextOperationsShiftChange(new Date("2026-07-31T11:00:00Z")), { label:"Noon", remaining:"6h 0m" });
  assert.deepEqual(nextOperationsShiftChange(new Date("2026-07-31T17:00:00Z")), { label:"6:00 PM", remaining:"6h 0m" });
});
