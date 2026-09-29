import { stockExpiryDays } from "./inventory-check-flow.ts";

type RecordRow = Record<string, unknown>;
const text = (value: unknown) => value == null ? "" : String(value);
export type StockFilter = "all" | "attention" | "low" | "expired" | "expiring";
export type RepairFilter = { query: string; apparatus: string; status: string; priority: string };

export function repairStage(row: RecordRow) {
  const status = text(row.status).trim().toLowerCase();
  return status === "open" ? "new" : status === "completed" ? "closed" : status;
}

export function openRepair(row: RecordRow) {
  return !["closed", "cancelled"].includes(repairStage(row));
}

export function filterRepairOrders<T extends RecordRow>(rows: T[], filter: RepairFilter) {
  const query = filter.query.trim().toLowerCase();
  return rows.filter(row => {
    const matchesStatus = filter.status === "all" || (filter.status === "open" ? openRepair(row) : repairStage(row) === filter.status);
    const searchable = [row.summary, row.details, row.apparatus_name, row.assigned_to, row.assigned_employee_names, row.vendor, row.invoice_number, row.resolution_notes].map(text).join(" ").toLowerCase();
    return matchesStatus && (filter.apparatus === "all" || row.apparatus_id === filter.apparatus)
      && (filter.priority === "all" || row.priority === filter.priority) && searchable.includes(query);
  });
}

/** Group physical counts by supply; never combine units or erase lot identity. */
export function stockGroups<T extends RecordRow>(rows: T[]) {
  const grouped = new Map<string, { row: T; total: number; lots: T[] }>();
  for (const row of rows) {
    const id = text(row.id);
    const existing = grouped.get(id) || { row, total: 0, lots: [] };
    existing.total += Number(row.quantity_on_hand) || 0;
    if (row.lot_id) existing.lots.push(row);
    grouped.set(id, existing);
  }
  return [...grouped.values()];
}

export function stockAttention(item: { row: RecordRow; total: number; lots: RecordRow[] }, now = Date.now()) {
  const expired = item.lots.filter(lot => Number(lot.quantity_on_hand) > 0 && (stockExpiryDays(lot.expires_at, now) ?? Infinity) < 0);
  const expiring = item.lots.filter(lot => {
    const days = stockExpiryDays(lot.expires_at, now);
    return Number(lot.quantity_on_hand) > 0 && days !== null && days >= 0 && days <= 30;
  });
  return { low: item.total <= Number(item.row.reorder_point || 0), expired, expiring };
}

export function filterStock<T extends RecordRow>(items: ReturnType<typeof stockGroups<T>>, filter: { query: string; location: string; status: StockFilter }, now = Date.now()) {
  const query = filter.query.trim().toLowerCase();
  return items.filter(item => {
    // Scope lot search and expiry filters to the same location, but keep the
    // item's department-wide quantity and reorder threshold intact.
    const lots = filter.location === "all" ? item.lots : item.lots.filter(lot => text(lot.location_id) === filter.location);
    if (filter.location !== "all" && !lots.length) return false;
    const searchable = [item.row.name, item.row.sku, item.row.barcode, ...lots.flatMap(lot => [lot.lot_number, lot.location_id])].map(text).join(" ").toLowerCase();
    const state = stockAttention({ ...item, lots }, now);
    const matches = filter.status === "all" || (filter.status === "low" && state.low)
      || (filter.status === "expired" && state.expired.length > 0)
      || (filter.status === "expiring" && state.expiring.length > 0)
      || (filter.status === "attention" && (state.low || state.expired.length > 0 || state.expiring.length > 0));
    return matches && searchable.includes(query);
  });
}

export function inventoryRefreshInterval(view: string) {
  return ["check", "legacy_check"].includes(view) ? 5000 : 60000;
}

export function recordedRepairCost(value: unknown) {
  if (value == null || value === "" || !Number.isFinite(Number(value))) return "Not recorded";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value));
}
