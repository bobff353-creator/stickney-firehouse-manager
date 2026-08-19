// Read-only diagnostic: dumps every table/column Postgres actually has in a
// given schema (default: this app's own `stickney_app` — see APP_SCHEMA in
// db/postgres-adapter.ts), so drift or a naming collision with the
// unrelated platform that owns `public` in this same Supabase project can
// be found in one request. Pass ?schema=public to check for new collisions.
//
// Deliberately does NOT go through db/bootstrap.ts's ensureDatabase() —
// that runs initializeDatabase() first, and if something in the target
// schema is broken enough to make that fail, this endpoint would fail with
// it before ever showing what's actually wrong. Talks to Postgres directly
// instead, so it stays usable exactly when it's needed most.
// The account actually signed into the live app is bwyant@stickneyfire.com,
// not the bobff353@gmail.com this route (and app/api/permissions/route.ts,
// app/server-permissions.ts) originally hardcoded — added here so this
// diagnostic is actually reachable during the production outage it exists
// to debug.
const ownerAdminEmails = ["bobff353@gmail.com", "bwyant@stickneyfire.com"];

export async function GET(request: Request) {
  try {
    const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() ?? "";
    if (!process.env.DATABASE_URL?.trim()) return Response.json({ error: "Not running against Postgres" }, { status: 400 });
    const { getPg, ensurePostgresCompat } = await import("../../../../db/postgres-adapter");
    await ensurePostgresCompat();
    const db = getPg();
    // Matches app/api/permissions/route.ts's requirePermissionAdmin(): allow the
    // hardcoded owner email, or anyone with is_admin=1 in employee_profiles —
    // not just the literal owner string, since that was rejecting the actual
    // signed-in admin. Tolerates employee_profiles itself being broken: an
    // admin-check failure shouldn't block the one tool that would show why.
    let isAdmin = ownerAdminEmails.includes(email);
    if (!isAdmin && email) {
      try {
        const row = await db.prepare("SELECT is_admin AS isAdmin FROM employee_profiles WHERE lower(email) = ? LIMIT 1").bind(email).first<{ isAdmin: number }>();
        isAdmin = Boolean(row?.isAdmin);
      } catch { /* fall through to the 403 below */ }
    }
    if (!isAdmin) return Response.json({ error: "Administrator permission required", receivedEmail: email || null }, { status: 403 });

    const { APP_SCHEMA } = await import("../../../../db/postgres-adapter");
    const schema = new URL(request.url).searchParams.get("schema") || APP_SCHEMA;
    const rows = await db.prepare(
      "SELECT table_name AS \"tableName\", column_name AS \"columnName\", data_type AS \"dataType\", is_nullable AS \"isNullable\" FROM information_schema.columns WHERE table_schema = ? ORDER BY table_name, ordinal_position"
    ).bind(schema).all<{ tableName: string; columnName: string; dataType: string; isNullable: string }>();

    const byTable: Record<string, Array<{ column: string; type: string; nullable: boolean }>> = {};
    for (const row of rows.results) {
      (byTable[row.tableName] ??= []).push({ column: row.columnName, type: row.dataType, nullable: row.isNullable === "YES" });
    }
    return Response.json({ schema, tableCount: Object.keys(byTable).length, tables: byTable });
  } catch (error) {
    // Every other route in this app wraps its handler this way; this one
    // didn't, so a thrown error (bad connection, a stale query) crashed the
    // whole function instead of returning JSON — showing up as a bare
    // browser "HTTP ERROR 500" page with no detail at all.
    return Response.json({ error: error instanceof Error ? error.message : "Schema audit failed" }, { status: 500 });
  }
}
