export type StaffingQualifications = { rank?: string | null; driverStatus?: string | null; actingOfficerEligible?: boolean | number; singleRole?: boolean | number };
export const requiredStaffingRoles = ["Officer/AO", "Engine Driver", "Ambulance Driver", "FF/Attendant"] as const;
export function staffingRoles(employee: StaffingQualifications): string[] {
  if (employee.singleRole || /\bsingle[-\s]*role\b/i.test(employee.rank ?? "")) return [];
  if (/\b(chief|captain|lieutenant)\b/i.test(employee.rank ?? "") || employee.actingOfficerEligible) return [...requiredStaffingRoles];
  const driving = (employee.driverStatus ?? "").trim().toLowerCase();
  if (driving === "cleared") return requiredStaffingRoles.slice(1);
  if (driving === "ambulance only") return requiredStaffingRoles.slice(2);
  return ["FF/Attendant"];
}
export function staffingEligibilityReason(employee: StaffingQualifications, role: string): string {
  if (["Extra member", "Firefighter", "Training/Orientation"].includes(role)) return "";
  if (staffingRoles(employee).includes(role)) return "";
  if (employee.singleRole) return "Single-role members may work extra positions only.";
  return `Not cleared for ${role}. Update qualifications on Employees.`;
}
