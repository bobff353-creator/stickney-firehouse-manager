// Private pilot access is derived only from the verified server identity.
export const INSPECTION_PILOT_EMAIL = 'bobff353@gmail.com';
export function inspectionPilotAccess(email: string | null | undefined) {
  return String(email ?? '').trim().toLowerCase() === INSPECTION_PILOT_EMAIL;
}
