import type { PortalPage } from "./portal-navigation";

// Screens that render payroll entries, rates, or the payroll-linked roster.
// Independent tools must never wait for this request.
export function portalNeedsPayroll(page: PortalPage): boolean {
  return ["Dashboard", "Payroll", "Timesheets", "My Timesheet", "Employees", "Rates & Rules", "Daily Log"].includes(page);
}
