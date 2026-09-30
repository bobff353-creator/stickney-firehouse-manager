// Local synthetic CPU benchmark only; never connects to an API or database.
// Includes building the indexes in every optimized sample (React normally reuses them).
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { indexFirstBy, sortCheckItems } from '../app/inventory-index.ts';
import { inventoryFixture, previousCheckSort } from '../tests/fixtures/inventory-performance-data.mjs';

function measure(run) {
  run(); // Warm up both implementations.
  const samples = Array.from({ length: 5 }, () => {
    const start = performance.now(); run(); return performance.now() - start;
  }).sort((a, b) => a - b);
  return Number(samples[2].toFixed(2));
}
const results = [];
for (const size of [500, 1630, 5000]) {
  const { items, equipment, compartments } = inventoryFixture(size);
  const previous = () => previousCheckSort(items, equipment, compartments);
  const indexed = () => sortCheckItems(items, indexFirstBy(equipment, row => row.id), indexFirstBy(compartments, row => row.id));
  assert.deepEqual(indexed(), previous());
  results.push({ operation: 'Check item ordering', records: size, previousMedianMs: measure(previous), optimizedMedianMs: measure(indexed), sameResults: true });
}
console.log(JSON.stringify({ environment: `Node ${process.version} / ${process.platform}`, scope: 'Local synthetic sorting CPU, five samples; not production page latency or database CPU', results }, null, 2));
