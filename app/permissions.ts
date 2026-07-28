export const permissionCatalog = [
  { key: "dashboard.view", label: "View dashboard", group: "General" },
  { key: "operations_board.view", label: "View Live Operations Board", group: "Operations" },
  { key: "command_center.view", label: "View Command Center", group: "Operations" },
  { key: "daily_log.view", label: "View Daily Log", group: "Operations" },
  { key: "daily_log.manage", label: "Edit and approve Daily Log", group: "Operations" },
  { key: "scheduling.view", label: "View scheduling", group: "Scheduling" },
  { key: "scheduling.manage", label: "Manage schedules and requests", group: "Scheduling" },
  { key: "payroll.view_own", label: "View own timesheet", group: "Payroll" },
  { key: "payroll.manage", label: "Manage payroll and rates", group: "Payroll" },
  { key: "employees.view", label: "View employee directory", group: "Personnel" },
  { key: "employees.manage", label: "Manage employee records", group: "Personnel" },
  { key: "contacts.view", label: "View employee contacts", group: "Personnel" },
  { key: "documents.view", label: "View policies, duties, and box cards", group: "Documents" },
  { key: "policies.manage", label: "Add and edit policies", group: "Documents" },
  { key: "box_cards.manage", label: "Add and edit Box Cards", group: "Documents" },
  { key: "settings.manage", label: "Manage department settings", group: "Settings" },
  { key: "permissions.manage", label: "Manage permissions and test views", group: "Settings" },
] as const;

export type PermissionKey = typeof permissionCatalog[number]["key"];

const allPermissions = permissionCatalog.map((permission) => permission.key);
const memberPermissions: PermissionKey[] = ["dashboard.view", "operations_board.view", "scheduling.view", "payroll.view_own", "documents.view"];
const firefighterPermissions: PermissionKey[] = [...memberPermissions, "daily_log.view", "daily_log.manage"];
const officerPermissions: PermissionKey[] = [...firefighterPermissions, "employees.view", "contacts.view"];

export function defaultPermissionsForRank(rank: string, isAdmin = false): PermissionKey[] {
  const value = rank.trim().toLowerCase();
  if (isAdmin || value.includes("chief")) return [...allPermissions];
  if (value.includes("captain") || value.includes("lieutenant")) return [...officerPermissions, "command_center.view", "scheduling.manage"];
  if (value.includes("firefighter") || value === "ff") return [...firefighterPermissions];
  return [...memberPermissions];
}
