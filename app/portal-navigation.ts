export const portalPages = ["Dashboard", "Command Center", "Operations Board", "Activity Timeline", "Respond", "Command Board", "Field Preplans", "Road Closures", "Safety Inspections", "Scheduling", "Payroll", "Work Details", "Daily Log", "Timesheets", "Callback Reviews", "My Timesheet", "Employees", "Employee Contacts", "Policies", "Box Cards", "Holiday Policy", "EMS", "Daily Duties", "Inventory", "Phone Numbers", "Rates & Rules", "Departments", "System Health", "Permissions", "CAD Integration", "Respond Device Modes", "Test View"] as const;
export type PortalPage = typeof portalPages[number];
export type PortalRecord = { preplan?: string; hydrant?: string };
export function pageSlug(page: PortalPage) { return page.toLowerCase().replaceAll(" & ", "-").replaceAll(" ", "-"); }
export function portalPageFromSearch(search: string): PortalPage | null {
  const params = new URLSearchParams(search);
  if (params.get("display") === "tv") return "Operations Board";
  if (params.get("preplan") || params.get("hydrant")) return "Field Preplans";
  const slug = params.get("page")?.toLowerCase();
  if (slug === "monthly-safety-inspections") return "Safety Inspections";
  return portalPages.find(page => pageSlug(page) === slug) ?? null;
}
export function portalPageUrl(pathname: string, search: string, page: PortalPage, record?: PortalRecord) {
  const params = new URLSearchParams(search);
  params.set("page", pageSlug(page));
  params.set("display", "portal");
  for (const key of ["preplan", "hydrant", "edit"]) params.delete(key);
  if (page === "Field Preplans") {
    if (record?.preplan) params.set("preplan", record.preplan);
    else if (record?.hydrant) params.set("hydrant", record.hydrant);
  }
  return `${pathname}?${params.toString()}`;
}
export function portalPageLabel(page: PortalPage) {
  return ({ Dashboard: "Home", "Field Preplans": "Maps & Preplans", Scheduling: "Station Schedule", Inventory: "Apparatus Checks", "Operations Board": "Live Operations" } as Partial<Record<PortalPage,string>>)[page] ?? page;
}
