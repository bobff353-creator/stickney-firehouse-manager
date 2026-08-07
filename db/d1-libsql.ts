// D1-compatible adapter over libSQL / Turso.
//
// The entire app talks to the database through Cloudflare D1's prepared-
// statement API: `db.prepare(sql).bind(...args).first()/.all()/.run()` plus
// `db.batch([...])`. Rather than rewrite hundreds of queries, this module backs
// that exact shape with a libSQL client so the app runs unchanged on Vercel
// (Node runtime) against Turso.
//
// Required env: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN.

// Web/HTTP client — no native binary, safe on Vercel serverless. Talks to a
// remote Turso database over HTTPS.
import { createClient } from "@libsql/client/web";
import type { Client, InArgs, Row } from "@libsql/client";

type Value = string | number | boolean | null | ArrayBuffer | Uint8Array;

let client: Client | null = null;

function getClient(): Client {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL is not set. Provision a Turso database and add TURSO_DATABASE_URL and TURSO_AUTH_TOKEN to the environment.",
    );
  }
  client = createClient({ url, authToken });
  return client;
}

/** libSQL rows are array-like with named columns; normalize to a plain object. */
function toObject<T>(row: Row): T {
  const record: Record<string, unknown> = {};
  for (const key of Object.keys(row)) record[key] = (row as unknown as Record<string, unknown>)[key];
  return record as T;
}

// D1 accepts `.bind(a, b, c)`; libSQL wants a positional args array. `undefined`
// is not a valid libSQL arg, so coerce it to null (matches D1 leniency).
function normalizeArgs(args: Value[]): InArgs {
  return args.map((value) => (value === undefined ? null : value)) as InArgs;
}

export class D1PreparedStatement {
  constructor(private readonly sql: string, private readonly args: Value[] = []) {}

  bind(...args: Value[]): D1PreparedStatement {
    return new D1PreparedStatement(this.sql, args);
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const result = await getClient().execute({ sql: this.sql, args: normalizeArgs(this.args) });
    const row = result.rows[0];
    return row ? toObject<T>(row) : null;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: true; meta: { changes: number; last_row_id: number } }> {
    const result = await getClient().execute({ sql: this.sql, args: normalizeArgs(this.args) });
    return {
      results: result.rows.map((row) => toObject<T>(row)),
      success: true,
      meta: { changes: result.rowsAffected, last_row_id: Number(result.lastInsertRowid ?? 0) },
    };
  }

  async run(): Promise<{ success: true; meta: { changes: number; last_row_id: number } }> {
    const result = await getClient().execute({ sql: this.sql, args: normalizeArgs(this.args) });
    return { success: true, meta: { changes: result.rowsAffected, last_row_id: Number(result.lastInsertRowid ?? 0) } };
  }

  /** Internal: the libSQL statement form used by batch(). */
  toStatement(): { sql: string; args: InArgs } {
    return { sql: this.sql, args: normalizeArgs(this.args) };
  }
}

export class D1Database {
  prepare(sql: string): D1PreparedStatement {
    return new D1PreparedStatement(sql);
  }

  async batch(statements: D1PreparedStatement[]): Promise<Array<{ success: true; meta: { changes: number; last_row_id: number }; results: Record<string, unknown>[] }>> {
    const prepared = statements.map((statement) => statement.toStatement());
    const results = await getClient().batch(prepared, "write");
    return results.map((result) => ({
      success: true,
      meta: { changes: result.rowsAffected, last_row_id: Number(result.lastInsertRowid ?? 0) },
      results: result.rows.map((row) => toObject(row)),
    }));
  }

  async exec(sql: string): Promise<{ count: number }> {
    await getClient().executeMultiple(sql);
    return { count: 0 };
  }
}

let database: D1Database | null = null;

/** Returns the process-wide D1-compatible database handle backed by Turso. */
export function getD1(): D1Database {
  database ??= new D1Database();
  return database;
}

/** The underlying libSQL client, for Drizzle's libSQL driver. */
export function getLibsqlClient(): Client {
  return getClient();
}
