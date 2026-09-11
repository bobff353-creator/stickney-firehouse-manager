import { staffingRoles } from "./staffing-eligibility.ts";

export type ScheduleQualification = {
  rank: string;
  actingOfficerEligible: number | boolean;
  driverStatus?: string | null;
  singleRole?: number | boolean;
};

const normalized = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

export const isOfficerPosition = (role: string) => /\b(officer|acting\s+officer|ao|oic)\b/i.test(role);
export const isOfficerRank = (rank: string) => /\b(chief|captain|lieutenant)\b/i.test(rank);
export const isSingleRoleFirefighter = (rank: string) => /\b(single[-\s]*role|temp(?:orary)?\s+firefighter)\b/i.test(rank);

export function qualifiedForScheduleRole(employee: ScheduleQualification, role: string) {
  const position = normalized(role);
  const roles = staffingRoles(employee);
  if (isOfficerPosition(role)) return roles.includes("Officer/AO");
  if (/\b(driver\/engineer|engine driver|engineer|apparatus driver)\b/i.test(position)) return roles.includes("Engine Driver");
  if (/\bambulance driver\b/i.test(position)) return roles.includes("Ambulance Driver");
  if (/\b(ambulance attendant|ff\/attendant)\b/i.test(position)) return roles.includes("FF/Attendant");
  return true;
}
