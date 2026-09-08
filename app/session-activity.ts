// A shared activity hint, never an authorization token. The server still verifies the PIN lease.
export const sessionActivityKey = 'stickney-portal-activity-v1';
export function latestSessionActivity(local: number, stored: string | null, now: number): number {
  const shared = Number(stored);
  return Number.isFinite(shared) && shared > 0 && shared <= now ? Math.max(local, shared) : local;
}
export function sessionIsIdle(lastActivity: number, now: number, limit: number): boolean {
  return now - lastActivity >= limit;
}
