import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const shell = await readFile(new URL("../app/inventory-live.tsx", import.meta.url), "utf8");
const operations = await readFile(new URL("../app/inventory-operations.tsx", import.meta.url), "utf8");

test("inventory is a separate top-level apparatus workflow", () => {
  assert.match(shell, /\["inventory", "Inventory counts"\]/);
  assert.match(shell, /view === "inventory"/);
  assert.match(shell, /Inventory checks by apparatus/);
});

test("due work keeps inventory in its own apparatus-aligned section", () => {
  assert.match(operations, /Other checks/);
  assert.match(operations, /Open inventory count/);
  assert.match(operations, /item\.check_types\.includes\("inventory"\)/);
  assert.match(operations, /renderCheckCards\(inventoryChecks/);
  assert.match(operations, /key={`\$\{item\.apparatusId\}-\$\{item\.checkType\}`}/);
  assert.match(operations, /!item\.active && !item\.configured \? "Not configured" : checkNextAction\(Boolean\(item\.active\), item\.total, item\.pending\)/);
});
