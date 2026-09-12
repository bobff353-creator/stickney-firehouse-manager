import { portalPages, type PortalPage } from "./portal-navigation";
type NavItem = PortalPage;
type IconName = "home" | "log" | "box" | "users" | "phone" | "payroll" | "clock" | "rates" | "document" | "holiday" | "settings" | "search" | "bell" | "menu" | "close" | "filter" | "export" | "back" | "next" | "save" | "warning" | "chevron";

export const featuredNavItems: Array<{ page: NavItem; label: string; tone: string }> = [
  { page: "Dashboard", label: "Home", tone: "home" },
  { page: "Respond", label: "Respond", tone: "respond" },
  { page: "Operations Board", label: "Live Operations", tone: "live" },
  { page: "Field Preplans", label: "Maps & Preplans", tone: "maps" },
  { page: "Daily Log", label: "Daily Log", tone: "log" },
  { page: "Scheduling", label: "Station Schedule", tone: "schedule" },
  { page: "Inventory", label: "Apparatus Checks", tone: "apparatus" },
];
export const featuredNavPages = new Set<NavItem>(featuredNavItems.map((item) => item.page));
export const adminNavGroups: Array<{ label: string; icon: IconName; items: Array<{ label: string; page: NavItem }> }> = [
  { label: "Operations", icon: "log", items: [{ label: "Command Center", page: "Command Center" }, { label: "Live Operations Board", page: "Operations Board" }, { label: "Activity Timeline", page: "Activity Timeline" }, { label: "Daily Log", page: "Daily Log" }, { label: "Box Cards", page: "Box Cards" }] },
  { label: "Field", icon: "search", items: [{ label: "Respond", page: "Respond" }, { label: "Command Board", page: "Command Board" }, { label: "Preplans", page: "Field Preplans" }, { label: "Road Closures", page: "Road Closures" }, { label: "Safety Inspections", page: "Safety Inspections" }] },
  { label: "Scheduling", icon: "clock", items: [{ label: "Station Scheduler", page: "Scheduling" }] },
  { label: "Personnel", icon: "users", items: [{ label: "Employees", page: "Employees" }, { label: "Contacts", page: "Employee Contacts" }] },
  { label: "Payroll", icon: "payroll", items: [{ label: "Payroll", page: "Payroll" }, { label: "Work Detail", page: "Work Details" }, { label: "Timesheets", page: "Timesheets" }, { label: "Callback Reviews", page: "Callback Reviews" }, { label: "Rates", page: "Rates & Rules" }] },
  { label: "Documents", icon: "document", items: [{ label: "Policies", page: "Policies" }, { label: "Holiday Policy", page: "Holiday Policy" }, { label: "EMS", page: "EMS" }] },
  { label: "Station Duties", icon: "clock", items: [{ label: "Daily Duties", page: "Daily Duties" }, { label: "Inventory & Apparatus Checks", page: "Inventory" }] },
  { label: "Administration", icon: "settings", items: [{ label: "System Health & Backups", page: "System Health" }, { label: "Departments", page: "Departments" }, { label: "Important Phone Numbers", page: "Phone Numbers" }, { label: "Permissions", page: "Permissions" }, { label: "CIS CAD Integration", page: "CAD Integration" }, { label: "Respond Device Modes", page: "Respond Device Modes" }, { label: "Test as Member", page: "Test View" }] },
];
export const navPermission: Partial<Record<NavItem, string>> = { Dashboard: "dashboard.view", "Command Center": "command_center.view", "Operations Board": "operations_board.view", "Activity Timeline": "command_center.view", Respond: "field_preplans.view", "Command Board": "incident_command.view", "Field Preplans": "field_preplans.view", "Road Closures": "road_closures.view", "Safety Inspections": "safety_inspections.view", Scheduling: "scheduling.view", Payroll: "payroll.manage", "Work Details": "scheduling.manage", "Daily Log": "daily_log.view", Timesheets: "payroll.manage", "Callback Reviews": "payroll.manage", "My Timesheet": "payroll.view_own", Employees: "employees.manage", "Employee Contacts": "contacts.view", Policies: "documents.view", "Box Cards": "documents.view", "Holiday Policy": "documents.view", EMS: "documents.view", "Daily Duties": "documents.view", Inventory: "inventory.view", "Phone Numbers": "settings.manage", "Rates & Rules": "payroll.manage", Departments: "settings.manage", "System Health": "settings.manage", Permissions: "permissions.manage", "CAD Integration": "settings.manage", "Respond Device Modes": "settings.manage", "Test View": "permissions.manage" };

export function portalNavigationForPermissions(permissions: readonly string[] | null) {
  if (!permissions) return [];
  return portalPages.filter(item => item === "Employees"
    ? permissions.includes("employees.view") || permissions.includes("employees.manage")
    : Boolean(navPermission[item] && permissions.includes(navPermission[item]!)));
}
