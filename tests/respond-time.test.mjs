import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadFormatter() {
  const source = await readFile(new URL("../app/respond-time.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("Respond formats Daily Log military times as the correct AM or PM", async () => {
  const { formatRespondTime } = await loadFormatter();
  assert.equal(formatRespondTime("0930"), "9:30 AM");
  assert.equal(formatRespondTime("2130"), "9:30 PM");
  assert.equal(formatRespondTime("0005"), "12:05 AM");
  assert.equal(formatRespondTime("1205"), "12:05 PM");
});

test("Respond displays full CAD timestamps in Chicago time", async () => {
  const { formatRespondTime } = await loadFormatter();
  assert.equal(formatRespondTime("2026-07-31T14:30:00Z"), "9:30 AM");
  assert.equal(formatRespondTime(""), "Not reported");
});

test("Respond displays call time out in four-digit military time", async () => {
  const { formatRespondMilitaryTime } = await loadFormatter();
  assert.equal(formatRespondMilitaryTime("0930"), "0930");
  assert.equal(formatRespondMilitaryTime("4:09"), "0409");
  assert.equal(formatRespondMilitaryTime("2130"), "2130");
  assert.equal(formatRespondMilitaryTime("2026-07-31T14:30:00Z"), "0930");
  assert.equal(formatRespondMilitaryTime(""), "Not reported");
});
