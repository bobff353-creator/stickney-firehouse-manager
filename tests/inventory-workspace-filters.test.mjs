import test from "node:test";
import assert from "node:assert/strict";
import { filterRepairOrders, filterStock, stockAttention, stockGroups, inventoryRefreshInterval, openRepair, recordedRepairCost } from "../app/inventory-workspace-filters.ts";
import { stockExpiryDays } from "../app/inventory-check-flow.ts";

const now = Date.parse("2026-09-29T15:00:00Z");
const stock = stockGroups([
  { id: "gloves", name: "Gloves", unit: "boxes", lot_id: "old", location_id: "Engine", lot_number: "OLD", quantity_on_hand: 3, expires_at: "2026-09-28", reorder_point: 2 },
  { id: "gloves", name: "Gloves", unit: "boxes", lot_id: "new", location_id: "Station", lot_number: "NEW", quantity_on_hand: 2, expires_at: "2026-10-05", reorder_point: 2 },
  { id: "tape", name: "Tape", unit: "rolls", lot_id: "tape", location_id: "Engine", lot_number: "TAPE", quantity_on_hand: 0, expires_at: "2020-01-01", reorder_point: 1 },
]);
test("stock grouping keeps each lot and never mixes units or hides expired counts", () => {
  assert.equal(stock.length, 2);
  assert.equal(stock[0].total, 5);
  assert.equal(stock[0].lots.length, 2);
  const state = stockAttention(stock[0], now);
  assert.equal(state.low, true);
  assert.equal(state.usable, 2);
  assert.deepEqual(state.expired.map(lot => lot.lot_id), ["old"]);
  assert.deepEqual(state.expiring.map(lot => lot.lot_id), ["new"]);
  assert.equal(stockAttention(stock[1], now).expired.length, 0, "empty lots do not imply expired stock on hand");
});
test("stock location, search and expiration filters refer to the same lot scope", () => {
  assert.equal(filterStock(stock, { query: "", location: "Engine", status: "expired" }, now).length, 1);
  assert.equal(filterStock(stock, { query: "", location: "Station", status: "expired" }, now).length, 0);
  assert.equal(filterStock(stock, { query: "OLD", location: "Station", status: "all" }, now).length, 0);
  assert.equal(filterStock(stock, { query: "NEW", location: "Station", status: "expiring" }, now)[0].total, 5);
  assert.deepEqual(filterStock(stock, { query: "", location: "all", status: "low" }, now).map(item => item.row.id), ["gloves", "tape"]);
  assert.equal(filterStock([], { query: "", location: "all", status: "attention" }, now).length, 0);
});
test("expiration follows Chicago calendar days at midnight and across daylight saving changes", () => {
  assert.equal(stockExpiryDays("2026-09-28", Date.parse("2026-09-29T04:59:00Z")), 0);
  assert.equal(stockExpiryDays("2026-09-28", Date.parse("2026-09-29T05:00:00Z")), -1);
  assert.equal(stockExpiryDays("2026-10-29", now), 30);
  assert.equal(stockExpiryDays("2026-03-09", Date.parse("2026-03-08T07:00:00Z")), 1);
  assert.equal(stockExpiryDays("2026-02-30", now), null);
  assert.equal(stockExpiryDays("", now), null);
});
test("repairs narrow by combined filters and retain completed records", () => {
  const rows = [
    { id: "open", status: "open", priority: "high", apparatus_id: "engine", summary: "Broken lamp", assigned_employee_names: ["Preview Member"] },
    { id: "waiting", status: "waiting_parts", priority: "routine", apparatus_id: "ambulance", summary: "New tires" },
    { id: "done", status: "completed", priority: "high", apparatus_id: "engine", summary: "Pump service", invoice_number: "TEST-123" },
  ];
  const filter = { query: "", apparatus: "all", status: "open", priority: "all" };
  assert.deepEqual(filterRepairOrders(rows, filter).map(row => row.id), ["open", "waiting"]);
  assert.equal(filterRepairOrders(rows, { ...filter, query: "preview", apparatus: "engine", priority: "high" })[0].id, "open");
  assert.equal(filterRepairOrders(rows, { ...filter, query: "TEST-123", status: "closed" })[0].id, "done");
  assert.equal(filterRepairOrders(rows, { ...filter, apparatus: "unknown" }).length, 0);
  assert.equal(rows.length, 3);
  assert.equal(openRepair({ status: "cancelled" }), false);
});
test("fast polling is reserved for shared active check workspaces", () => {
  assert.equal(inventoryRefreshInterval("check"), 45000);
  assert.equal(inventoryRefreshInterval("legacy_check"), 45000);
  for (const view of ["due", "stock", "service", "equipment", "air", "inventory", "builder", "reports"]) assert.equal(inventoryRefreshInterval(view), 240000);
});
test("missing repair costs never display as made-up zero or NaN", () => {
  for (const cost of [undefined, null, "", "unknown"]) assert.equal(recordedRepairCost(cost), "Not recorded");
  assert.equal(recordedRepairCost(0), "$0.00");
  assert.equal(recordedRepairCost("125.25"), "$125.25");
});
