export type HealthState = "healthy" | "warning" | "unavailable";
export type HealthCheck = {
  id: string;
  label: string;
  state: HealthState;
  value: string;
  detail: string;
  verifiedAt: string | null;
  statusLabel?: string;
  action?: { label: string; href: string };
};
export type HealthPayload = {
  summary: { state: "healthy" | "attention"; label: string; checkedAt: string };
  checks: HealthCheck[];
};

export function summarizeHealth(checks: HealthCheck[], checkedAt: string): HealthPayload["summary"] {
  const coreIds = ["database", "users", "file-storage", "database-usage", "storage-usage"];
  const coreHealthy = coreIds.every((id) => checks.some((check) => check.id === id && check.state === "healthy"));
  const recoveryIds = ["database-backup", "file-backup", "offsite-backup", "backup-verification"];
  const recoveryHealthy = recoveryIds.every((id) => checks.some((check) => check.id === id && check.state === "healthy"));
  const allHealthy = checks.length > 0 && checks.every(check => check.state === "healthy");
  return {
    state: coreHealthy && recoveryHealthy && allHealthy ? "healthy" : "attention",
    label: !coreHealthy ? "Some service checks need attention"
      : !recoveryHealthy ? "Service checks passed · recovery readiness needs attention"
        : !allHealthy ? "Recovery checks passed · other checks need attention"
          : "All connected service and recovery checks passed",
    checkedAt,
  };
}

export function nonnegativeMeasurement(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function releaseIdentity(env: Record<string, string | undefined>) {
  const sha = [env.APP_RELEASE_SHA, env.VERCEL_GIT_COMMIT_SHA]
    .find(value => value && /^[a-f0-9]{40}$/i.test(value.trim()));
  return {
    environment: env.VERCEL_ENV || "local",
    commit: sha?.trim().slice(0, 12) ?? null,
  };
}
