type ExpirationDatabase = {
  prepare(sql: string): {
    all<T>(): Promise<{ results: T[] }>;
  };
};

type ExpirationRow = {
  id: string;
  preplanId: string;
  preplanName: string;
  recordName: string;
  expiresAt: string;
};

export type ExpirationState = "expired" | "upcoming" | "future" | "invalid";

export function expirationState(
  expiresAt: string,
  now = new Date(),
  warningDays = 30,
): ExpirationState {
  const expires = new Date(expiresAt);
  if (!Number.isFinite(expires.getTime())) return "invalid";
  if (expires.getTime() <= now.getTime()) return "expired";
  return expires.getTime() <= now.getTime() + warningDays * 86_400_000
    ? "upcoming"
    : "future";
}

const sources = [
  { kind: "alert", table: "field_preplan_alerts", name: "title" },
  { kind: "hazmat", table: "field_preplan_hazmat", name: "chemical_name" },
  { kind: "zone", table: "field_preplan_hazmat_zones", name: "label" },
  { kind: "annotation", table: "field_preplan_annotations", name: "name" },
] as const;

export async function evaluatePreplanExpirations(
  db: ExpirationDatabase,
  now = new Date(),
) {
  const groups = await Promise.all(
    sources.map(async (source) => {
      const rows = await db
        .prepare(
          `SELECT item.id,item.preplan_id preplanId,plan.business_name preplanName,item.${source.name} recordName,item.expires_at expiresAt FROM ${source.table} item JOIN field_preplans plan ON plan.id=item.preplan_id WHERE item.archived=0 AND item.expires_at IS NOT NULL AND trim(item.expires_at)<>'' AND COALESCE(plan.publication_status,'published')='published'`,
        )
        .all<ExpirationRow>();
      return rows.results.map((row) => ({
        ...row,
        kind: source.kind,
        state: expirationState(row.expiresAt, now),
      }));
    }),
  );
  const records = groups.flat();
  const expired = records.filter((record) => record.state === "expired");
  const upcoming = records.filter((record) => record.state === "upcoming");
  const invalid = records.filter((record) => record.state === "invalid");
  return {
    evaluatedAt: now.toISOString(),
    expired,
    upcoming,
    invalid,
    reviewCount: expired.length + upcoming.length + invalid.length,
  };
}
