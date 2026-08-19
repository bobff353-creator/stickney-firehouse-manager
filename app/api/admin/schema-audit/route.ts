import { ensureDatabase } from "../../../../db/bootstrap";

// Read-only diagnostic: dumps every table/column Postgres actually has, so
// drift between a stale production table (see db/bootstrap.ts
// repairPostgresColumns) and the schema this codebase expects can be found
// in one request instead of one production error at a time.
const ownerAdminEmails = ["bobff353@gmail.com"];

export async function GET(request: Request) {
  try {
    const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
    if (!process.env.DATABASE_URL?.trim()) return Response.json({ error: "Not running against Postgres" }, { status: 400 });
    const db = await ensureDatabase();
    // Matches app/api/permissions/route.ts's requirePermissionAdmin(): allow the
    // hardcoded owner email, or anyone with is_admin=1 in employee_profiles —
    // not just the literal owner string, since that was rejecting the actual
    // signed-in admin.
    const isAdmin = ownerAdminEmails.includes(email)
      || Boolean((email ? await db.prepare("SELECT is_admin AS isAdmin FROM employee_profiles WHERE lower(email) = ? LIMIT 1").bind(email).first<{ isAdmin: number }>() : null)?.isAdmin);
    if (!isAdmin) return Response.json({ error: "Administrator permission required", receivedEmail: email || null }, { status: 403 });

    const rows = await db.prepare(
      "SELECT table_name AS \"tableName\", column_name AS \"columnName\", data_type AS \"dataType\", is_nullable AS \"isNullable\" FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position"
    ).all<{ tableName: string; columnName: string; dataType: string; isNullable: string }>();

    const byTable: Record<string, Array<{ column: string; type: string; nullable: boolean }>> = {};
    for (const row of rows.results) {
      (byTable[row.tableName] ??= []).push({ column: row.columnName, type: row.dataType, nullable: row.isNullable === "YES" });
    }
    return Response.json({ tableCount: Object.keys(byTable).length, tables: byTable });
  } catch (error) {
    // Every other route in this app wraps its handler this way; this one
    // didn't, so a thrown error (bad connection, a stale query) crashed the
    // whole function instead of returning JSON — showing up as a bare
    // browser "HTTP ERROR 500" page with no detail at all.
    return Response.json({ error: error instanceof Error ? error.message : "Schema audit failed" }, { status: 500 });
  }
}
