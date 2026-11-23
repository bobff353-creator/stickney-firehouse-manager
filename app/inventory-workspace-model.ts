export const inventoryWorkspaceViews = ["due", "fleet", "inventory", "check", "equipment", "air", "reports", "readiness", "service", "maintenance", "stock", "setup", "apparatus"] as const;
export type InventoryWorkspaceView = typeof inventoryWorkspaceViews[number];

export function inventoryWorkspaceView(input: unknown): InventoryWorkspaceView | "" {
  return typeof input === "string" && inventoryWorkspaceViews.includes(input as InventoryWorkspaceView) ? input as InventoryWorkspaceView : "";
}

export function inventoryWorkspaceUrl(href: string, view: InventoryWorkspaceView, apparatusId = "") {
  const url = new URL(href);
  for (const key of ["check", "resume", "report", "equipment", "workOrder", "adminTask", "view", "apparatus"]) url.searchParams.delete(key);
  if (view !== "due") url.searchParams.set("view", view);
  if (apparatusId) url.searchParams.set("apparatus", apparatusId);
  return `${url.pathname}${url.search}${url.hash}`;
}
