export type ScheduleQualification = {
  rank: string;
  actingOfficerEligible: number | boolean;
  driverStatus?: string | null;
};

const normalized = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

export const isOfficerPosition = (role: string) => /\b(officer|acting\s+officer|ao|oic)\b/i.test(role);
export const isOfficerRank = (rank: string) => /\b(chief|captain|lieutenant)\b/i.test(rank);
export const isSingleRoleFirefighter = (rank: string) => /\b(single[-\s]*role|temp(?:orary)?\s+firefighter)\b/i.test(rank);

export function qualifiedForScheduleRole(employee: ScheduleQualification, role: string) {
  const position = normalized(role);
  const driverStatus = normalized(employee.driverStatus);
  const officerEligible = isOfficerRank(employee.rank) || Boolean(employee.actingOfficerEligible);

  if (isOfficerPosition(role)) return officerEligible;
  if (/\b(driver\/engineer|engine driver|engineer|apparatus driver)\b/i.test(position)) return driverStatus === "cleared";
  if (/\bambulance driver\b/i.test(position)) return driverStatus === "cleared" || driverStatus === "ambulance only";
  if (/\bambulance attendant\b/i.test(position)) return !isSingleRoleFirefighter(employee.rank);
  return true;
}
