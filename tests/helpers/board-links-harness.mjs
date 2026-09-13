// Isolated HTTP/API -> actual store/SQL -> real PostgreSQL. No live credentials.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
const require = createRequire(import.meta.url);
function compile(path, imports) {
  const source = readFileSync(new URL('../../'+path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const target = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => name in imports ? imports[name] : require(name), target, target.exports);
  return target.exports;
}
const training = compile('app/lib/training-parsers.ts', {});
export const model = compile('app/board-links.ts', { './lib/training-parsers': training });
export const store = compile('app/board-links-store.ts', { './board-links': model });
const sqlLiteral = compile('db/sql-literal.ts', {});
const adapter = compile('db/postgres-adapter.ts', { '../app/supabase-server': {}, './sql-literal': sqlLiteral });
export async function boardLinksHarness() {
  const pg = new PGlite();
  await pg.exec('CREATE SCHEMA firehouse; SET search_path=firehouse; CREATE TABLE system_meta(key text PRIMARY KEY,value text NOT NULL,updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP);');
  const stats = { reads: 0, writes: 0, failedWrites: 0, failNext: false };
  const db = adapter.createPostgresD1Adapter(async () => ({ rpc: async (_name, { p_sql, p_mode }) => {
    try {
      // Same signed SQL text guard; payloads must not inject SQL/commands.
      if (p_sql.length > 200000 || /(;|--|\/\*|\*\/)/.test(p_sql) || /\b(create|alter|drop|truncate|grant|revoke|copy|call|show|reset|listen|notify|vacuum|analyze)\b/i.test(p_sql)) throw Error('Unsafe portal query');
      if (p_mode === 'run') { if (stats.failNext) { stats.failNext = false; stats.failedWrites++; throw Error('Simulated DB interruption'); } }
      else stats.reads++;
      const result = await pg.query(p_sql);
      if (p_mode === 'run') { stats.writes += result.affectedRows; return { data: { success: true, meta: { changes: result.affectedRows } }, error: null }; }
      return { data: p_mode === 'first' ? result.rows[0] ?? null : result.rows, error: null };
    } catch (error) { return { data: null, error: { message: error.message } }; }
  } }));
  // Session/department verification is the production proxy's responsibility;
  // these explicit local identities test the handler's current permission gate.
  const hasPermission = async request => request.headers.get('x-fixture-role') === 'admin';
  const hasAnyPermission = async request => ['admin', 'member'].includes(request.headers.get('x-fixture-role'));
  const api = compile('app/api/board-links/route.ts', {
    '../../../db/bootstrap': { ensureDatabase: async () => db },
    '../../server-permissions': { hasPermission, hasAnyPermission },
    '../../board-links': model, '../../board-links-store': store,
  });
  return { pg, db, api, stats, request(method, payload, role = 'admin') {
    return api[method](new Request('http://localhost/api/board-links', { method, headers: { 'content-type': 'application/json', 'x-fixture-role': role, 'oai-authenticated-user-email': `${role}@example.invalid` }, ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}) }));
  }, close: () => pg.close() };
}
