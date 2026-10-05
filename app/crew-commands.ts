import type { PortalPage, PortalRecord } from "./portal-navigation";

const commands: Array<{ id: string; title: string; detail: string; page: PortalPage; permission?: string; record?: PortalRecord }> = [
  { id: "crew", title: "View today’s crew", detail: "Today · staffing and shift overview", page: "Dashboard" },
  { id: "log", title: "Add daily log item", detail: "Open the existing shift log", page: "Daily Log", permission: "daily_log.manage" },
  { id: "check", title: "Start apparatus check", detail: "Operations · due vehicle checks", page: "Inventory", permission: "inventory.check" },
  { id: "repair", title: "Review work orders", detail: "Operations · equipment and repair work", page: "Inventory", record: { adminTask: "service" } },
  { id: "schedule", title: "Request time off or trade", detail: "Schedule · availability and requests", page: "Scheduling" },
  { id: "incident", title: "Open active incident", detail: "Response · current calls and preplans", page: "Respond" },
  { id: "training", title: "Add training", detail: "Open the private training workspace", page: "Training" },
  { id: "inspection", title: "Start inspection", detail: "Open the private fire inspection workspace", page: "Fire Inspections" },
];

export function crewCommands(pages: readonly PortalPage[], permissions: readonly string[]) {
  return commands.filter(command => pages.includes(command.page) && (!command.permission || permissions.includes(command.permission)));
}
