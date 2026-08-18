// D1-compatible adapter over Postgres (Supabase).
//
// The entire app talks to the database through Cloudflare D1's prepared-
// statement API: `db.prepare(sql).bind(...args).first()/.all()/.run()` plus
// `db.batch([...])`. This module backs that exact shape with a Postgres
// client so the app runs unchanged against Supabase's Postgres database.
//
// Required env: DATABASE_URL (a Postgres connection string, e.g. Supabase's
// "Connection string" from Project Settings -> Database, using the pooler
// host for serverless environments like Vercel).
//
// SQLite/D1 SQL text is largely accepted as-is by Postgres (TEXT/INTEGER/
// REAL types, `ON CONFLICT(...) DO UPDATE SET col=excluded.col`, `CREATE
// TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` are all valid in both).
// Three real differences are bridged at the database level instead of by
// rewriting every call site across the app:
//   1. `?` positional placeholders -> Postgres `$1,$2,...` (translated here).
//   2. `COLLATE NOCASE` -> a Postgres collation literally named NOCASE,
//      created once via ensurePostgresCompat() (see db/postgres-compat.sql).
//   3. SQLite's `datetime(...)` function -> a matching Postgres function of
//      the same name, also created once via ensurePostgresCompat().
// Both compat objects must exist before any bootstrap SQL runs; see
// ensurePostgresCompat() below.

import { Pool, type QueryResultRow } from "pg";

type Value = string | number | boolean | null | ArrayBuffer | Uint8Array;

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add your Supabase Postgres connection string as DATABASE_URL in the environment.",
    );
  }
  pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 5 });
  return pool;
}

/**
 * Converts SQLite/D1-flavored SQL text to Postgres-compatible text:
 *  - `?` positional placeholders -> `$1,$2,...`
 *  - `INSERT OR IGNORE INTO` -> `INSERT INTO ... ON CONFLICT DO NOTHING`
 *    (semantically identical: SQLite's OR IGNORE silently skips a row that
 *    would violate any constraint, same as an unqualified ON CONFLICT DO
 *    NOTHING in Postgres).
 */
function toPostgresSql(sql: string): string {
  let index = 0;
  const withPlaceholders = sql.replace(/\?/g, () => `$${++index}`);
  if (/^\s*INSERT\s+OR\s+IGNORE\s+INTO/i.test(withPlaceholders)) {
    return withPlaceholders.replace(/^(\s*)INSERT\s+OR\s+IGNORE\s+INTO/i, "$1INSERT INTO") + " ON CONFLICT DO NOTHING";
  }
  return withPlaceholders;
}

function normalizeArgs(args: Value[]): unknown[] {
  return args.map((value) => (value === undefined ? null : value));
}

/** Postgres returns native booleans/numbers; D1 callers expect SQLite's 0/1 integer convention for boolean columns, so leave values as Postgres returns them — callers already use Boolean(value)/truthiness checks throughout the app, which works for both `0/1` and `false/true`. */
function toObject<T extends QueryResultRow>(row: T): T {
  return row;
}

export class PgPreparedStatement {
  constructor(private readonly sql: string, private readonly args: Value[] = []) {}

  bind(...args: Value[]): PgPreparedStatement {
    return new PgPreparedStatement(this.sql, args);
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const result = await getPool().query(toPostgresSql(this.sql), normalizeArgs(this.args));
    const row = result.rows[0];
    return row ? toObject<T & QueryResultRow>(row as T & QueryResultRow) : null;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: true; meta: { changes: number; last_row_id: number } }> {
    const result = await getPool().query(toPostgresSql(this.sql), normalizeArgs(this.args));
    return {
      results: result.rows.map((row) => toObject<T & QueryResultRow>(row as T & QueryResultRow)),
      success: true,
      meta: { changes: result.rowCount ?? 0, last_row_id: 0 },
    };
  }

  async run(): Promise<{ success: true; meta: { changes: number; last_row_id: number } }> {
    const result = await getPool().query(toPostgresSql(this.sql), normalizeArgs(this.args));
    return { success: true, meta: { changes: result.rowCount ?? 0, last_row_id: 0 } };
  }

  /** Internal: the statement form used by batch(). */
  toStatement(): { sql: string; args: unknown[] } {
    return { sql: toPostgresSql(this.sql), args: normalizeArgs(this.args) };
  }
}

export class PgDatabase {
  prepare(sql: string): PgPreparedStatement {
    return new PgPreparedStatement(sql);
  }

  /** Runs every statement inside one transaction, matching D1's all-or-nothing batch semantics. */
  async batch(statements: PgPreparedStatement[]): Promise<Array<{ success: true; meta: { changes: number; last_row_id: number }; results: Record<string, unknown>[] }>> {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const outcomes: Array<{ success: true; meta: { changes: number; last_row_id: number }; results: Record<string, unknown>[] }> = [];
      for (const statement of statements) {
        const { sql, args } = statement.toStatement();
        const result = await client.query(sql, args);
        outcomes.push({
          success: true,
          meta: { changes: result.rowCount ?? 0, last_row_id: 0 },
          results: result.rows,
        });
      }
      await client.query("COMMIT");
      return outcomes;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async exec(sql: string): Promise<{ count: number }> {
    await getPool().query(sql);
    return { count: 0 };
  }
}

let database: PgDatabase | null = null;

/** Returns the process-wide D1-compatible database handle backed by Postgres. */
export function getPg(): PgDatabase {
  database ??= new PgDatabase();
  return database;
}

let compatEnsured = false;

/**
 * Creates the Postgres-side compatibility objects (a NOCASE collation and a
 * datetime() function matching SQLite's semantics for the modifier patterns
 * this app actually uses) so the app's existing SQL text — written for
 * SQLite/D1 — runs unchanged. Idempotent; safe to call on every cold start.
 */
export async function ensurePostgresCompat(): Promise<void> {
  if (compatEnsured) return;
  const client = await getPool().connect();
  try {
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_collation WHERE collname = 'nocase') THEN
          CREATE COLLATION NOCASE (provider = icu, deterministic = false, locale = 'und-u-ks-level2');
        END IF;
      END
      $$;
    `);
    await client.query(`
      CREATE OR REPLACE FUNCTION datetime(ts text, modifier text DEFAULT NULL)
      RETURNS timestamp AS $$
      DECLARE
        base timestamp;
      BEGIN
        IF ts = 'now' THEN
          base := now();
        ELSE
          base := ts::timestamp;
        END IF;
        IF modifier IS NULL THEN
          RETURN base;
        END IF;
        RETURN base + (modifier::interval);
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;
    `);
    await client.query(`
      CREATE OR REPLACE FUNCTION date(ts text, modifier text DEFAULT NULL)
      RETURNS date AS $$
      BEGIN
        RETURN datetime(ts, modifier)::date;
      END;
      $$ LANGUAGE plpgsql IMMUTABLE;
    `);
    compatEnsured = true;
  } finally {
    client.release();
  }
}
