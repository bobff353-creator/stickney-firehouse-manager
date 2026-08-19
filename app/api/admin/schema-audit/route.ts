import { ensureDatabase } from "../../../../db/bootstrap";

// Read-only diagnostic: dumps every table/column Postgres actually has, so
// drift between a stale production table (see db/bootstrap.ts
// repairPostgresColumns) and the schema this codebase expects can be found
// in one request instead of one production error at a time.
const ownerAdminEmails = ["bobff353@gmail.com"];

export async function GET(request: Request) {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
  if (!ownerAdminEmails.includes(email)) return Response.json({ error: "Administrator permission required" }, { status: 403 });
  if (!process.env.DATABASE_URL?.trim()) return Response.json({ error: "Not running against Postgres" }, { status: 400 });

  const db = await ensureDatabase();
  const rows = await db.prepare(
    "SELECT table_name AS \"tableName\", column_name AS \"columnName\", data_type AS \"dataType\", is_nullable AS \"isNullable\" FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position"
  ).all<{ tableName: string; columnName: string; dataType: string; isNullable: string }>();

  const byTable: Record<string, Array<{ column: string; type: string; nullable: boolean }>> = {};
  for (const row of rows.results) {
    (byTable[row.tableName] ??= []).push({ column: row.columnName, type: row.dataType, nullable: row.isNullable === "YES" });
  }
  return Response.json({ tableCount: Object.keys(byTable).length, tables: byTable });
}
