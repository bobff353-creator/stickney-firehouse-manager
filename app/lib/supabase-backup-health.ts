import type { HealthCheck } from "../system-health-model";

// Management API only. Never substitute the database/service-role API key.
// This module is imported exclusively by the administrator's server route.
const MAX_BACKUP_AGE_MS = 36 * 60 * 60 * 1000; // Daily backup + scheduling grace.
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

type BackupOptions = {
  supabaseUrl: string;
  projectRef?: string;
  token?: string;
  requiredAfter?: string;
  now?: number;
  fetcher?: typeof fetch;
};

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

export function supabaseProjectRef(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port
      || (parsed.pathname !== "/" && parsed.pathname !== "") || parsed.search || parsed.hash) return null;
    return /^([a-z]{20})\.supabase\.co$/.exec(parsed.hostname)?.[1] ?? null;
  } catch { return null; }
}

function instant(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) && time > 0 ? time : null;
}

function displayTime(time: number): string {
  return new Date(time).toLocaleString("en-US", {
    timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short",
  }) + " Central";
}

export function interpretSupabaseBackups(payload: unknown, now: number, requiredAfter?: string): Pick<HealthCheck, "state" | "value" | "detail"> {
  const data = object(payload);
  if (!data || !Array.isArray(data.backups) || typeof data.pitr_enabled !== "boolean") {
    throw new Error("Unrecognized backup response");
  }
  const minimum = requiredAfter ? instant(requiredAfter) : null;
  if (requiredAfter && minimum === null) throw new Error("Invalid backup coverage configuration");
  let latest: number | null = null;
  let newerIncomplete = false;
  for (const raw of data.backups) {
    const row = object(raw);
    const time = instant(row?.inserted_at);
    if (!row || time === null || time > now + MAX_FUTURE_SKEW_MS || typeof row.status !== "string") {
      throw new Error("Unrecognized backup record");
    }
    if (row.status === "COMPLETED") latest = Math.max(latest ?? 0, time);
  }
  const isPitr = data.pitr_enabled;
  if (isPitr) {
    const physical = object(data.physical_backup_data);
    const seconds = physical?.latest_physical_backup_date_unix;
    const earliest = physical?.earliest_physical_backup_date_unix;
    if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0
      || typeof earliest !== "number" || !Number.isFinite(earliest) || earliest <= 0 || earliest > seconds
      || seconds * 1000 > now + MAX_FUTURE_SKEW_MS) throw new Error("Recovery point unavailable");
    latest = seconds * 1000;
  } else {
    newerIncomplete = data.backups.some((raw) => {
      const row = object(raw)!;
      return row.status !== "COMPLETED" && (instant(row.inserted_at) ?? 0) >= (latest ?? 0);
    });
  }
  if (latest === null) return {
    state: "warning", value: "No completed backup yet",
    detail: "Supabase responded, but no completed database backup was returned. Check the provider dashboard. Photos and attachments need a separate backup.",
  };
  const value = `${isPitr ? "Recovery point · " : ""}${displayTime(latest)}`;
  if (minimum !== null && latest < minimum) return {
    state: "warning", value,
    detail: "This recovery point predates the latest data import/configuration. Wait for a newer Supabase backup before treating the imported data as protected. Photos and attachments are not included.",
  };
  if (now - latest > MAX_BACKUP_AGE_MS) return {
    state: "warning", value,
    detail: `${isPitr ? "The latest reported recovery point" : "The last completed backup"} is over 36 hours old. Confirm coverage in Supabase; it has not been verified as current. Photos and attachments are not included.`,
  };
  if (newerIncomplete) return {
    state: "warning", value,
    detail: "A previous completed backup exists, but a newer backup has not completed successfully. Check Supabase for its current status. Photos and attachments are not included.",
  };
  return {
    state: "healthy", value,
    detail: `Supabase confirmed this ${isPitr ? "recoverable point" : "completed database backup"}. Changes after this time are not covered by this result. Photos and attachments are not included; this is not a restore test.`,
  };
}

export async function getSupabaseBackupHealth(options: BackupOptions): Promise<HealthCheck> {
  const now = options.now ?? Date.now();
  const ref = supabaseProjectRef(options.supabaseUrl);
  const check: HealthCheck = {
    id: "database-backup", label: "Supabase database backup", state: "unavailable",
    value: "Automatic status not connected", verifiedAt: null,
    detail: "The portal needs a project-scoped Backups: Read token to display the actual backup date. This does not mean Supabase backups are disabled. Use Open Supabase backups to check directly.",
    ...(ref ? { action: { label: "Open Supabase backups", href: `https://supabase.com/dashboard/project/${ref}/database/backups/scheduled` } } : {}),
  };
  if (!ref) return { ...check, value: "Project cannot be verified", detail: "The configured Supabase URL is not a recognized hosted project. Backup status was not requested." };
  if (!options.projectRef && !options.token) return check;
  if (options.projectRef !== ref) return { ...check, value: "Backup project does not match", detail: "Backup monitoring must match the database serving this app. No provider request was made." };
  if (!options.token?.trim()) return check;
  // Require the scoped token format. Do not accept full-account classic tokens.
  if (!/^sbp_fc[A-Za-z0-9_-]+$/.test(options.token.trim())) return {
    ...check, value: "Scoped backup token required",
    detail: "Use a scoped Supabase Management token with Backups: Read only. Database API keys and full-account tokens are not accepted.",
  };
  if (options.requiredAfter && instant(options.requiredAfter) === null) return {
    ...check, value: "Backup coverage configuration needs attention", detail: "The minimum recovery date is invalid. Backup coverage cannot be confirmed.",
  };
  try {
    const response = await (options.fetcher ?? fetch)(`https://api.supabase.com/v1/projects/${ref}/database/backups`, {
      method: "GET", headers: { Authorization: `Bearer ${options.token.trim()}`, Accept: "application/json" },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return {
      ...check, value: "Backup status check failed", state: "warning",
      detail: response.status === 401 || response.status === 403
        ? "Supabase denied the monitoring request. Check the token's expiry, project scope and Backups: Read permission. No current backup success is claimed."
        : "Supabase could not return backup status. Try Refresh status or open Supabase backups. No current backup success is claimed.",
    };
    const result = interpretSupabaseBackups(await response.json(), now, options.requiredAfter);
    return { ...check, ...result, verifiedAt: new Date(now).toISOString() };
  } catch {
    return { ...check, state: "warning", value: "Backup status could not be verified", detail: "The backup request timed out or returned an invalid response. Try Refresh status or check Supabase directly. No current backup success is claimed." };
  }
}
