import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadDeviceModule() {
  const source = await readFile(new URL("../app/respond-device.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("apparatus matching uses exact CAD unit tokens", async () => {
  const { respondingUnitsIncludeUnit } = await loadDeviceModule();
  assert.equal(respondingUnitsIncludeUnit("1201, 1204 / B11", "1204"), true);
  assert.equal(respondingUnitsIncludeUnit("E1204; M1205", "1204"), false);
  assert.equal(respondingUnitsIncludeUnit("12040", "1204"), false);
  assert.equal(respondingUnitsIncludeUnit("", ""), true);
});

test("Respond device mode is normalized and stored only in the selected browser", async () => {
  const { readRespondDeviceSettings, writeRespondDeviceSettings, RESPOND_DEVICE_STORAGE_KEY } = await loadDeviceModule();
  const values = new Map();
  const store = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const saved = writeRespondDeviceSettings(store, { mode: "apparatus", apparatus: " 12-04! ", deviceName: "  1204 iPad  " });
  assert.deepEqual(saved, { mode: "apparatus", apparatus: "12-04", deviceName: "1204 iPad" });
  assert.equal(values.has(RESPOND_DEVICE_STORAGE_KEY), true);
  assert.deepEqual(readRespondDeviceSettings(store), saved);
});

test("Operations Alert duration is fixed at 90 seconds", async () => {
  const { RESPOND_ALERT_DURATION_SECONDS } = await loadDeviceModule();
  assert.equal(RESPOND_ALERT_DURATION_SECONDS, 90);
});
