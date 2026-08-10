// libSQL data access.
//
// One client backs the whole app. In development it points at a local SQLite
// file (CAD_DATABASE_URL=file:./cad.db); in production it points at a Turso
// database (libsql://…) with an auth token. The helpers below return plain
// objects and coerce `undefined` args to null, which libSQL requires.

import { createClient, type Client, type InArgs, type Row } from "@libsql/client";

type Value = string | number | boolean | null | undefined;

let client: Client | null = null;

function getClient(): Client {
  if (client) return client;
  const url = process.env.CAD_DATABASE_URL?.trim() || "file:./cad.db";
  const authToken = process.env.CAD_DATABASE_AUTH_TOKEN?.trim() || undefined;
  client = createClient({ url, authToken });
  return client;
}

function normalize(args: Value[]): InArgs {
  return args.map((value) => (value === undefined ? null : value)) as InArgs;
}

function toObject<T>(row: Row): T {
  const record: Record<string, unknown> = {};
  for (const key of Object.keys(row)) record[key] = (row as unknown as Record<string, unknown>)[key];
  return record as T;
}

export async function query<T = Record<string, unknown>>(sql: string, args: Value[] = []): Promise<T[]> {
  const result = await getClient().execute({ sql, args: normalize(args) });
  return result.rows.map((row) => toObject<T>(row));
}

export async function get<T = Record<string, unknown>>(sql: string, args: Value[] = []): Promise<T | null> {
  const rows = await query<T>(sql, args);
  return rows[0] ?? null;
}

export async function run(sql: string, args: Value[] = []): Promise<{ changes: number; lastInsertRowid: number }> {
  const result = await getClient().execute({ sql, args: normalize(args) });
  return { changes: result.rowsAffected, lastInsertRowid: Number(result.lastInsertRowid ?? 0) };
}

export async function batch(statements: Array<{ sql: string; args?: Value[] }>): Promise<void> {
  await getClient().batch(statements.map((statement) => ({ sql: statement.sql, args: normalize(statement.args ?? []) })), "write");
}
