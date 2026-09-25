// This pilot is deliberately not a grantable rank/employee permission.
export const TRAINING_PILOT_EMAIL = "bobff353@gmail.com";
export function trainingPilotAccess(email: string | null | undefined) {
  return String(email ?? "").trim().toLowerCase() === TRAINING_PILOT_EMAIL;
}
export function trainingRequestAllowed(request: Request) {
  // proxy.ts strips caller-supplied identity and replaces it after verified auth,
  // department membership, PIN and required-acknowledgment checks.
  return trainingPilotAccess(request.headers.get("oai-authenticated-user-email"));
}
