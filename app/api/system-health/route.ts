import { ensureDatabase } from "../../../db/bootstrap";
import { hasPermission } from "../../server-permissions";

type HealthState = "healthy" | "warning" | "unavailable";

type HealthCheck = {
  id: string;
  label: string;
  state: HealthState;
  value: string;
  detail: string;
  verifiedAt: string;
};

const unavailable = (id: string, label: string, detail: string, checkedAt: string): HealthCheck => ({
  id,
  label,
  state: "unavailable",
  value: "Monitoring not connected",
  detail,
  verifiedAt: checkedAt,
});

function formatBytes(value: unknown) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return "Unavailable";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let amount = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && amount >= 1024; index += 1) {
    amount /= 1024;
    unit = units[index];
  }
  return `${amount >= 10 ? amount.toFixed(1) : amount.toFixed(2)} ${unit}`;
}

export async function GET(request: Request) {
  const checkedAt = new Date().toISOString();
  let db: Awaited<ReturnType<typeof ensureDatabase>>;
  try {
    db = await ensureDatabase();
  } catch {
    return Response.json({ error: "The system health check could not reach the portal database." }, { status: 503 });
  }

  if (!(await hasPermission(request, db, "settings.manage"))) {
    return Response.json({ error: "Administrator access is required." }, { status: 403 });
  }

  const checks: HealthCheck[] = [];
  try {
    const [database, activeMembers] = await Promise.all([
      db.prepare("SELECT 1 AS online").first<{ online: number }>(),
      db.prepare("SELECT COUNT(*) AS count FROM employees WHERE active=1").first<{ count: number }>(),
    ]);
    checks.push({
      id: "database",
      label: "Database",
      state: database?.online === 1 ? "healthy" : "warning",
      value: database?.online === 1 ? "Online" : "Unexpected response",
      detail: `${Number(activeMembers?.count ?? 0)} active employee records are available.`,
      verifiedAt: checkedAt,
    });
  } catch {
    checks.push({ id: "database", label: "Database", state: "warning", value: "Unavailable", detail: "The live verification query failed.", verifiedAt: checkedAt });
  }

  type ProviderUsage = {
    databaseBytes: number | string;
    storageBytes: number | string;
    objectCount: number | string;
    bucketCount: number | string;
    authUserCount: number | string;
  };

  let providerUsage: ProviderUsage | null = null;
  try {
    providerUsage = await db.prepare(
      "SELECT database_bytes AS databaseBytes, storage_bytes AS storageBytes, object_count AS objectCount, bucket_count AS bucketCount, auth_user_count AS authUserCount FROM system_health_usage()",
    ).first<ProviderUsage>();
    if (!providerUsage) throw new Error("Provider usage was not returned.");

    const authUserCount = Number(providerUsage.authUserCount ?? 0);
    checks.push({
      id: "users",
      label: "Authenticated accounts",
      state: "healthy",
      value: String(Number.isFinite(authUserCount) ? authUserCount : 0),
      detail: "Counted directly from Supabase Auth through a department-protected health function.",
      verifiedAt: checkedAt,
    });
  } catch {
    checks.push({ id: "users", label: "Authenticated accounts", state: "warning", value: "Unavailable", detail: "The protected Supabase health function is not available.", verifiedAt: checkedAt });
  }

  if (providerUsage) {
    const bucketCount = Number(providerUsage.bucketCount ?? 0);
    checks.push({
      id: "file-storage",
      label: "File storage",
      state: "healthy",
      value: "Online",
      detail: `${Number.isFinite(bucketCount) ? bucketCount : 0} storage bucket${bucketCount === 1 ? "" : "s"} reachable. Stored-object usage is verified separately below.`,
      verifiedAt: checkedAt,
    });
  } else {
    checks.push({ id: "file-storage", label: "File storage", state: "warning", value: "Unavailable", detail: "The server-side storage health check is not available.", verifiedAt: checkedAt });
  }

  if (providerUsage) {
    checks.push({
      id: "database-usage",
      label: "Database used",
      state: "healthy",
      value: formatBytes(providerUsage.databaseBytes),
      detail: "Measured live from the Supabase PostgreSQL database. Plan capacity remains in the provider billing dashboard.",
      verifiedAt: checkedAt,
    });
  } else {
    checks.push(unavailable("database-usage", "Database used", "The live PostgreSQL size query is not available.", checkedAt));
  }

  if (providerUsage) {
    const objectCount = Number(providerUsage.objectCount ?? 0);
    checks.push({
      id: "storage-usage",
      label: "File storage used",
      state: "healthy",
      value: formatBytes(providerUsage.storageBytes),
      detail: `${Number.isFinite(objectCount) ? objectCount : 0} stored object${objectCount === 1 ? "" : "s"} measured live. Plan capacity remains in the provider billing dashboard.`,
      verifiedAt: checkedAt,
    });
  } else {
    checks.push(unavailable("storage-usage", "File storage used", "The live Supabase Storage size query is not available.", checkedAt));
  }

  type LoginAudit = {
    monitoringSince: string;
    attemptCount24h: number | string;
    failedCount24h: number | string;
    lastEventAt: string | null;
  };

  try {
    const loginAudit = await db.prepare(
      "SELECT monitoring_since AS monitoringSince, attempt_count_24h AS attemptCount24h, failed_count_24h AS failedCount24h, last_event_at AS lastEventAt FROM system_health_login_audit()",
    ).first<LoginAudit>();
    if (!loginAudit?.monitoringSince) throw new Error("Portal login audit status was not returned.");

    const monitoringSince = new Date(loginAudit.monitoringSince);
    const coverageHours = Math.max(0, (Date.now() - monitoringSince.getTime()) / 3_600_000);
    const hasFullCoverage = Number.isFinite(coverageHours) && coverageHours >= 24;
    const attemptCount = Number(loginAudit.attemptCount24h ?? 0);
    const failedCount = Number(loginAudit.failedCount24h ?? 0);
    checks.push({
      id: "failed-logins",
      label: "Failed portal logins · last 24 hours",
      state: hasFullCoverage ? "healthy" : "warning",
      value: hasFullCoverage ? String(failedCount) : `${failedCount} since enabled`,
      detail: hasFullCoverage
        ? `${attemptCount} well-formed portal PIN attempt${attemptCount === 1 ? "" : "s"} audited in Supabase. No email address or PIN is stored in this security log.`
        : `Supabase audit recording is connected and building its first complete 24-hour window. Monitoring began ${monitoringSince.toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" })}.`,
      verifiedAt: checkedAt,
    });
  } catch {
    checks.push(unavailable("failed-logins", "Failed portal logins · last 24 hours", "The private portal login audit feed is not available.", checkedAt));
  }

  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "local";
  const environment = process.env.VERCEL_ENV || "local";
  const branch = process.env.VERCEL_GIT_COMMIT_REF?.trim();
  const repository = process.env.VERCEL_GIT_REPO_SLUG?.trim();
  checks.push({
    id: "deployment",
    label: "Application deployment",
    state: environment === "production" ? "healthy" : "warning",
    value: environment === "production" ? `Production · ${commit}` : `${environment} · ${commit}`,
    detail: environment === "production"
      ? `${repository ? `GitHub repository ${repository}` : "Git-connected source"}${branch ? ` · branch ${branch}` : ""}. This commit is serving the current request.`
      : "This is the application version serving the current request.",
    verifiedAt: checkedAt,
  });

  checks.push(
    unavailable("database-backup", "Last database backup", "Connect the database provider backup feed before displaying a successful backup date.", checkedAt),
    unavailable("file-backup", "Last file backup", "Connect an independent file-backup job and receipt feed before displaying a successful backup date.", checkedAt),
    unavailable("offsite-backup", "Off-site backup", "No independent off-site backup verification feed is connected.", checkedAt),
    unavailable("backup-verification", "Last backup verification", "No automated restore test or checksum verification receipt is connected.", checkedAt),
  );

  const allHealthy = checks.every((check) => check.state === "healthy");
  return Response.json({
    summary: {
      state: allHealthy ? "healthy" : "attention",
      label: allHealthy ? "All systems normal" : "Core systems online · backup proof needs attention",
      checkedAt,
    },
    checks,
  }, {
    headers: { "cache-control": "private, no-store, max-age=0", "x-content-type-options": "nosniff" },
  });
}
