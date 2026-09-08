export type BoardOfficer = { id: string; name: string; rank: string };

// Match the department's existing officer/reviewer eligibility, including qualified AOs.
export const boardOfficerQuery = "SELECT e.id,e.name,p.label AS rank FROM employees e JOIN pay_scales p ON p.id=e.pay_scale_id LEFT JOIN employee_profiles ep ON ep.employee_id=e.id WHERE e.active=1 AND (lower(p.label) IN ('lieutenant','captain','chief','deputy chief','assistant chief') OR lower(p.id) LIKE 'deputy-chief%' OR COALESCE(ep.acting_officer_eligible,0)=1) ORDER BY e.name COLLATE NOCASE";

export function selectBoardOfficer(officers: BoardOfficer[], id: string) {
  const officer = officers.find((candidate) => candidate.id === id);
  if (!officer) throw new Error("Select a valid active officer for this note.");
  return officer;
}
