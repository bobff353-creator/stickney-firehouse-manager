import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadClusters() {
  const source = await readFile(
    new URL("../app/respond-call-clusters.ts", import.meta.url),
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

test("recent calls at the same or nearby saved location share one numbered cluster", async () => {
  const { clusterRecentCallLocations } = await loadClusters();
  const calls = [
    { reportNumber: "A", latitude: 41.8189, longitude: -87.7734 },
    { reportNumber: "B", latitude: 41.81891, longitude: -87.77341 },
    { reportNumber: "C", latitude: 41.825, longitude: -87.78 },
  ];

  const clusters = clusterRecentCallLocations(calls);
  assert.equal(clusters.length, 2);
  assert.deepEqual(
    clusters.map((cluster) => cluster.calls.map((call) => call.reportNumber)),
    [["A", "B"], ["C"]],
  );
});

test("recent calls without a real coordinate never receive a map dot", async () => {
  const { clusterRecentCallLocations } = await loadClusters();
  const clusters = clusterRecentCallLocations([
    { reportNumber: "missing", latitude: null, longitude: null },
    { reportNumber: "invalid", latitude: 999, longitude: -87.7 },
    { reportNumber: "mapped", latitude: 41.8189, longitude: -87.7734 },
  ]);

  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].calls[0].reportNumber, "mapped");
});
