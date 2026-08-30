import { ensureDatabase } from "../../../db/bootstrap";
import { hasPermission } from "../../server-permissions";
import { getSupabaseAdminClient } from "../../supabase-admin";

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

  let admin: ReturnType<typeof getSupabaseAdminClient> | null = null;
  try {
    admin = getSupabaseAdminClient();
    const usersResult = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersResult.error) throw usersResult.error;
    checks.push({
      id: "users",
      label: "Verified portal users",
      state: "healthy",
      value: String(usersResult.data.users.length),
      detail: usersResult.data.users.length === 1000 ? "At least 1,000 accounts; pagination is required for a final total." : "Counted directly from the authentication provider.",
      verifiedAt: checkedAt,
    });

  } catch {
    checks.push({ id: "users", label: "Verified portal users", state: "warning", value: "Unavailable", detail: "The server-side authentication health check is not available.", verifiedAt: checkedAt });
  }

  try {
    if (!admin) admin = getSupabaseAdminClient();
    const bucketsResult = await admin.storage.listBuckets();
    if (bucketsResult.error) throw bucketsResult.error;
    checks.push({
      id: "file-storage",
      label: "File storage",
      state: "healthy",
      value: "Online",
      detail: `${bucketsResult.data.length} storage bucket${bucketsResult.data.length === 1 ? "" : "s"} reachable. Stored-object usage is verified separately below.`,
      verifiedAt: checkedAt,
    });
  } catch {
    checks.push({ id: "file-storage", label: "File storage", state: "warning", value: "Unavailable", detail: "The server-side storage health check is not available.", verifiedAt: checkedAt });
  }

  try {
    const databaseUsage = await db.prepare(
      "SELECT pg_database_size(current_database()) AS bytes",
    ).first<{ bytes: number | string }>();
    if (databaseUsage?.bytes === undefined || databaseUsage?.bytes === null) throw new Error("Database size was not returned.");
    checks.push({
      id: "database-usage",
      label: "Database used",
      state: "healthy",
      value: formatBytes(databaseUsage.bytes),
      detail: "Measured live from the Supabase PostgreSQL database. Plan capacity remains in the provider billing dashboard.",
      verifiedAt: checkedAt,
    });
  } catch {
    checks.push(unavailable("database-usage", "Database used", "The live PostgreSQL size query is not available.", checkedAt));
  }

  try {
    const storageUsage = await db.prepare(
      "SELECT COUNT(*) AS object_count, COALESCE(SUM(CASE WHEN (metadata->>'size') ~ '^[0-9]+$' THEN (metadata->>'size')::bigint ELSE 0 END),0) AS bytes FROM storage.objects",
    ).first<{ object_count: number | string; bytes: number | string }>();
    if (storageUsage?.bytes === undefined || storageUsage?.bytes === null) throw new Error("Storage size was not returned.");
    const objectCount = Number(storageUsage.object_count ?? 0);
    checks.push({
      id: "storage-usage",
      label: "File storage used",
      state: "healthy",
      value: formatBytes(storageUsage.bytes),
      detail: `${Number.isFinite(objectCount) ? objectCount : 0} stored object${objectCount === 1 ? "" : "s"} measured live. Plan capacity remains in the provider billing dashboard.`,
      verifiedAt: checkedAt,
    });
  } catch {
    checks.push(unavailable("storage-usage", "File storage used", "The live Supabase Storage size query is not available.", checkedAt));
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
    unavailable("failed-logins", "Failed logins · last 24 hours", "A complete authentication audit event feed has not been connected, so the portal will not claim zero failures.", checkedAt),
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
