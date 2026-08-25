export const permissionCatalog = [
  { key: "dashboard.view", label: "View dashboard", group: "General" },
  { key: "operations_board.view", label: "View Live Operations Board", group: "Operations" },
  { key: "command_center.view", label: "View Command Center", group: "Operations" },
  { key: "daily_log.view", label: "View Daily Log", group: "Operations" },
  { key: "daily_log.manage", label: "Edit and approve Daily Log", group: "Operations" },
  { key: "field_preplans.view", label: "View Field preplans", group: "Field" },
  { key: "field_preplans.edit", label: "Capture and update Field preplans", group: "Field" },
  { key: "field_preplans.publish", label: "Publish operational preplans", group: "Field" },
  { key: "field_preplans.delete", label: "Archive or delete preplans", group: "Field" },
  { key: "field_preplans.review", label: "Review preplans and revisions", group: "Field" },
  { key: "field_preplans.manage_layers", label: "Manage levels, rooms, and floor plans", group: "Field" },
  { key: "field_preplans.manage_hazmat", label: "Manage HazMat and ERG records", group: "Field" },
  { key: "field_preplans.manage_attachments", label: "Manage preplan photos and attachments", group: "Field" },
  { key: "field_preplans.verify_expiring", label: "Verify expiring operational records", group: "Field" },
  { key: "field_preplans.manage_settings", label: "Manage preplan calculation settings", group: "Field" },
  { key: "incident_command.view", label: "View Incident Command Board", group: "Field" },
  { key: "incident_command.manage", label: "Operate Incident Command Board", group: "Field" },
  { key: "scheduling.view", label: "View scheduling", group: "Scheduling" },
  { key: "scheduling.manage", label: "Manage schedules and requests", group: "Scheduling" },
  { key: "payroll.view_own", label: "View own timesheet", group: "Payroll", required: true },
  { key: "payroll.manage", label: "Manage payroll and rates", group: "Payroll" },
  { key: "employees.view", label: "View employee directory", group: "Personnel" },
  { key: "employees.manage", label: "Manage employee records", group: "Personnel" },
  { key: "contacts.view", label: "View employee contacts", group: "Personnel" },
  { key: "documents.view", label: "View policies, duties, and box cards", group: "Documents" },
  { key: "policies.manage", label: "Add and edit policies", group: "Documents" },
  { key: "box_cards.manage", label: "Add and edit Box Cards", group: "Documents" },
  { key: "inventory.view", label: "View Inventory and Apparatus Checks", group: "Inventory & Apparatus Checks" },
  { key: "inventory.check", label: "Complete apparatus checks and inventory counts", group: "Inventory & Apparatus Checks" },
  { key: "inventory.repairs.manage", label: "Assign and update repair work", group: "Inventory & Apparatus Checks" },
  { key: "inventory.setup.manage", label: "Build inventory and apparatus check templates", group: "Inventory & Apparatus Checks" },
  { key: "settings.manage", label: "Manage department settings", group: "Settings" },
  { key: "permissions.manage", label: "Manage permissions and test views", group: "Settings" },
] as const;

export type PermissionKey = typeof permissionCatalog[number]["key"];

const allPermissions = permissionCatalog.map((permission) => permission.key);
const memberPermissions: PermissionKey[] = ["dashboard.view", "operations_board.view", "scheduling.view", "payroll.view_own", "documents.view", "field_preplans.view", "inventory.view", "inventory.check"];
const firefighterPermissions: PermissionKey[] = [...memberPermissions, "daily_log.view", "daily_log.manage", "field_preplans.edit", "incident_command.view"];
const officerPermissions: PermissionKey[] = [...firefighterPermissions, "field_preplans.review", "field_preplans.verify_expiring", "employees.view", "contacts.view", "incident_command.manage", "inventory.repairs.manage"];

export function defaultPermissionsForRank(rank: string, isAdmin = false): PermissionKey[] {
  const value = rank.trim().toLowerCase();
  if (isAdmin || value.includes("chief")) return [...allPermissions];
  if (value.includes("captain") || value.includes("lieutenant")) return [...officerPermissions, "command_center.view", "scheduling.manage"];
  if (value.includes("firefighter") || value === "ff") return [...firefighterPermissions];
  return [...memberPermissions];
}
