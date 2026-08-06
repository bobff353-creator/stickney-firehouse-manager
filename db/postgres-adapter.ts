import { getSupabaseServerClient } from "../app/supabase-server";

type BoundValue = string | number | boolean | null | undefined;
type QueryMode = "all" | "first" | "run";
type SupabaseClientFactory = typeof getSupabaseServerClient;
type PortalRpc = "firehouse_sql" | "firehouse_server_sql";

function sqlLiteral(value: BoundValue) {
  if (value == null) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("A database value was not finite.");
    return String(value);
  }
  if (typeof value === "boolean") return value ? "1" : "0";
  const sanitized = value.replaceAll("\0", "");
  if (!/(;|--|\/\*|\*\/)/.test(sanitized)) return `'${sanitized.replaceAll("'", "''")}'`;
  const bytes = new TextEncoder().encode(sanitized);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `convert_from(decode('${hex}', 'hex'), 'UTF8')`;
}

function bindSql(sql: string, values: BoundValue[]) {
  let output = "";
  let valueIndex = 0;
  let quote: "'" | '"' | null = null;
  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    if (quote) {
      output += character;
      if (character === quote) {
        if (sql[index + 1] === quote) output += sql[++index];
        else quote = null;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      output += character;
    } else if (character === "?") {
      if (valueIndex >= values.length) throw new Error("A portal query is missing a bound value.");
      output += sqlLiteral(values[valueIndex++]);
    } else {
      output += character;
    }
  }
  if (valueIndex !== values.length) throw new Error("A portal query received too many bound values.");
  return output;
}

function quoteCamelCaseIdentifiers(sql: string) {
  let output = "";
  let quote: "'" | '"' | null = null;
  for (let index = 0; index < sql.length;) {
    const character = sql[index];
    if (quote) {
      output += character;
      index += 1;
      if (character === quote) {
        if (sql[index] === quote) output += sql[index++];
        else quote = null;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      output += character;
      index += 1;
      continue;
    }
    const identifier = sql.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/)?.[0];
    if (identifier) {
      output += /[a-z][A-Z]/.test(identifier) ? `"${identifier}"` : identifier;
      index += identifier.length;
      continue;
    }
    output += character;
    index += 1;
  }
  return output;
}

function translateSql(sql: string, values: BoundValue[]) {
  let translated = bindSql(sql, values).trim();
  const ignoredInsert = /^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(translated);
  translated = translated.replace(/^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i, "INSERT INTO");
  translated = translated.replace(/\s+COLLATE\s+NOCASE\b/gi, "");
  translated = translated.replace(/\bGROUP_CONCAT\(([^,()]+),\s*('(?:''|[^'])*')\)/gi, "STRING_AGG($1, $2)");
  translated = translated.replace(/\bCURRENT_TIMESTAMP\b/gi, "to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')");
  translated = translated.replace(/\bdatetime\(\s*'now'\s*,\s*'(-?\d+)\s+(hours?|days?)'\s*\)/gi, "(CURRENT_TIMESTAMP + interval '$1 $2')");
  translated = translated.replace(/\bdatetime\(\s*'now'\s*\)/gi, "CURRENT_TIMESTAMP");
  translated = translated.replace(/\bdate\(\s*'now'\s*,\s*'(-?\d+)\s+(days?)'\s*\)/gi, "(CURRENT_DATE + interval '$1 $2')::date");
  translated = translated.replace(/\bdate\(\s*'now'\s*\)/gi, "CURRENT_DATE");
  translated = translated.replace(/\bdate\(\s*([^,()]+)\s*,\s*'(-?\d+)\s+(days?)'\s*\)/gi, "(($1)::date + interval '$2 $3')::date");
  translated = translated.replace(/\bdatetime\(\s*([A-Za-z_][A-Za-z0-9_.]*)\s*\)/gi, "($1)::timestamptz");
  translated = translated.replace(/\bdate\(\s*([A-Za-z_][A-Za-z0-9_.]*)\s*\)/gi, "($1)::date");
  translated = translated.replace(/\browid\b/gi, "ctid");
  translated = translated.replace(/\bLIKE\b/gi, "ILIKE");
  if (ignoredInsert && !/\bON\s+CONFLICT\b/i.test(translated)) {
    const returning = translated.match(/\s+RETURNING\s+/i);
    translated = returning
      ? `${translated.slice(0, returning.index)} ON CONFLICT DO NOTHING${translated.slice(returning.index!)}`
      : `${translated} ON CONFLICT DO NOTHING`;
  }
  return quoteCamelCaseIdentifiers(translated);
}

async function execute(
  sql: string,
  values: BoundValue[],
  mode: QueryMode,
  clientFactory: SupabaseClientFactory,
  rpc: PortalRpc,
  databaseSecret: string | null,
) {
  const supabase = await clientFactory();
  const { data, error } = await supabase.rpc(rpc, {
    p_sql: translateSql(sql, values),
    p_mode: mode,
    p_secret: databaseSecret,
  });
  if (error) throw new Error(`Portal database query failed: ${error.message}`);
  return data;
}

export class PostgresD1Statement {
  constructor(
    private readonly sql: string,
    private readonly values: BoundValue[] = [],
    private readonly clientFactory: SupabaseClientFactory = getSupabaseServerClient,
    private readonly rpc: PortalRpc = "firehouse_sql",
    private readonly databaseSecret: string | null = null,
  ) {}

  bind(...values: BoundValue[]) {
    return new PostgresD1Statement(this.sql, values, this.clientFactory, this.rpc, this.databaseSecret);
  }

  async all<T = Record<string, unknown>>() {
    return { results: (await execute(this.sql, this.values, "all", this.clientFactory, this.rpc, this.databaseSecret)) as T[] };
  }

  async first<T = Record<string, unknown>>() {
    return (await execute(this.sql, this.values, "first", this.clientFactory, this.rpc, this.databaseSecret)) as T | null;
  }

  async run() {
    return (await execute(this.sql, this.values, "run", this.clientFactory, this.rpc, this.databaseSecret)) as { success: boolean; meta: { changes: number } };
  }
}

export class PostgresD1Adapter {
  constructor(
    private readonly clientFactory: SupabaseClientFactory = getSupabaseServerClient,
    private readonly rpc: PortalRpc = "firehouse_sql",
    private readonly databaseSecret: string | null = null,
  ) {}

  prepare(sql: string) {
    return new PostgresD1Statement(sql, [], this.clientFactory, this.rpc, this.databaseSecret);
  }

  async batch(statements: PostgresD1Statement[]) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }
}

export function createPostgresD1Adapter(
  clientFactory: SupabaseClientFactory = getSupabaseServerClient,
  rpc: PortalRpc = "firehouse_sql",
  databaseSecret: string | null = null,
) {
  return new PostgresD1Adapter(clientFactory, rpc, databaseSecret);
}
