import { serviceScheduleInput } from "./inventory-service-schedule.ts";

const textFields = ["name", "asset_number", "scba_asset_kind", "compartment_id", "sku", "manufacturer", "model", "serial_number", "barcode", "scba_check_slot", "scba_notes"] as const;
const dateFields = ["purchase_date", "in_service_date", "expiration_date", "hydro_test_date", "hydro_due_date"] as const;
export function airAssetInput(input: unknown): Record<string, string | number | null> {
  if (!input || typeof input !== "object") throw new Error("Enter the asset details.");
  const source = input as Record<string, unknown>;
  const result: Record<string, string | number | null> = {};
  for (const key of textFields) {
    const value = typeof source[key] === "string" ? source[key].trim() : "";
    const limit = key === "scba_notes" ? 2000 : ["asset_number", "serial_number", "barcode", "sku"].includes(key) ? 80 : 240;
    if (value.length > limit) throw new Error(`${key.replaceAll("_", " ")} must be ${limit} characters or fewer.`);
    result[key] = value || null;
  }
  for (const key of dateFields) {
    const value = source[key];
    if (value && (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw new Error("Enter valid calendar dates.");
    result[key] = typeof value === "string" && value ? value : null;
  }
  if (!result.name || !result.asset_number || !result.compartment_id || !["pack", "bottle"].includes(String(result.scba_asset_kind || ""))) throw new Error("Choose pack or bottle, a unique ID, a name, and a location.");
  if (result.hydro_test_date && result.hydro_due_date && result.hydro_due_date < result.hydro_test_date) throw new Error("Hydro due date cannot be before the recorded test date.");
  // Older clients must not erase a service schedule they did not load.
  return { ...result, ...("service_interval_months" in source ? serviceScheduleInput(source) : {}) };
}

export function airSaveError(error: { code?: string; message?: string }) {
  if (error.code === "23505") return { status: 409, error: "That ID, barcode, or checklist position is already assigned. Choose a different one." };
  if (error.code === "40001") return { status: 409, error: "This record changed on another screen. Reopen it before saving." };
  if (error.code === "42501") return { status: 403, error: "Your current Inventory permission does not allow this change." };
  if (error.code === "P0001") return { status: 400, error: error.message || "Review the air asset details." };
  if (error.code?.startsWith("22") || error.code === "23514") return { status: 400, error: "Review the dates and numbers. The record was not saved." };
  return { status: 503, error: "Air asset records could not be saved. Your entries are still here; try again." };
}
