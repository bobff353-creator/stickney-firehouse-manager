import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadProgressModule() {
  const source = await readFile(
    new URL("../app/respond-progress.ts", import.meta.url),
    "utf8",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(
    `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
  );
}

test("response progress is scoped to the incident and apparatus device", async () => {
  const { readRespondProgress, writeRespondProgress } =
    await loadProgressModule();
  const values = new Map();
  const store = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  writeRespondProgress(
    store,
    "INC-100",
    "1204",
    "en_route",
    "2026-08-30T12:00:00.000Z",
  );

  assert.deepEqual(readRespondProgress(store, "INC-100", "1204"), {
    status: "en_route",
    updatedAt: "2026-08-30T12:00:00.000Z",
  });
  assert.equal(readRespondProgress(store, "INC-100", "1205"), null);
  assert.equal(readRespondProgress(store, "INC-200", "1204"), null);
});

test("invalid or damaged saved progress fails closed", async () => {
  const { readRespondProgress, RESPOND_PROGRESS_STORAGE_KEY } =
    await loadProgressModule();
  const store = {
    getItem: () => "not-json",
    setItem: () => undefined,
  };
  assert.equal(readRespondProgress(store, "INC-100", "1204"), null);

  const invalidStore = {
    getItem: (key) =>
      key === RESPOND_PROGRESS_STORAGE_KEY
        ? JSON.stringify({ "INC-100::1204": { status: "cleared" } })
        : null,
    setItem: () => undefined,
  };
  assert.equal(readRespondProgress(invalidStore, "INC-100", "1204"), null);
});
