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
  const backupHealthy = checks.some((check) => check.id === "database-backup" && check.state === "healthy");
  return {
    state: coreHealthy && backupHealthy ? "healthy" : "attention",
    label: !coreHealthy ? "Some Supabase service checks need attention"
      : backupHealthy ? "Supabase services online · database backup verified"
        : "Supabase services online · database backup status needs attention",
    checkedAt,
  };
}
