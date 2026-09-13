import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { trainingModules } from './training-modules.mjs';
export async function trainingHarness() {
  const pg = new PGlite();
  await pg.exec('CREATE SCHEMA firehouse; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; SET search_path=firehouse; CREATE TABLE system_meta(key text PRIMARY KEY,value text NOT NULL,updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP);');
  await pg.exec(readFileSync(resolve('supabase/migrations/20260912104034_shared_board_feed_cache.sql'), 'utf8'));
  const stats = { reads: 0, writes: 0, imports: 0, failImport: false, failBatchAt: -1 };
  const base = trainingModules({ [resolve('app/supabase-server.ts')]: {} });
  const { createPostgresD1Adapter } = base('db/postgres-adapter.ts');
  function safe(sql) {
    if (sql.length > 200000 || /(;|--|\/\*|\*\/)/.test(sql) || /\b(create|alter|drop|truncate|grant|revoke|copy|call|show|reset|listen|notify|vacuum|analyze)\b/i.test(sql)) throw Error('Unsafe SQL');
  }
  const db = createPostgresD1Adapter(async () => ({ rpc: async (name, args) => {
    try {
      async function execute(target, sql, mode) {
        safe(sql); const result = await target.query(sql);
        if (mode !== 'run') stats.reads++;
        return { value: mode === 'first' ? result.rows[0] ?? null : mode === 'all' ? result.rows : { success: true, meta: { changes: result.affectedRows } }, changes: result.affectedRows };
      }
      if (name.endsWith('_batch')) {
        let writes = 0;
        const data = await pg.transaction(async tx => {
          const results = [];
          for (const [index, statement] of args.p_statements.entries()) {
            if (stats.failBatchAt === index) { stats.failBatchAt = -1; throw Error('Simulated transaction failure'); }
            const result = await execute(tx, statement.sql, statement.mode);
            if (statement.requiredChanges !== null && statement.requiredChanges !== result.changes) throw Error('Required changes mismatch');
            writes += result.changes; results.push(result.value);
          }
          return results;
        }); stats.writes += writes; return { data, error: null };
      }
      const result = await execute(pg, args.p_sql, args.p_mode);
      if (args.p_mode === 'run') stats.writes += result.changes;
      return { data: result.value, error: null };
    } catch (error) { return { data: null, error: { message: error.message } }; }
  } }));
  const { trainingSources } = base('app/lib/training-sources.ts');
  const loadTrainingProvider = async id => {
    stats.imports++; if (stats.failImport) throw Error('Simulated unavailable provider');
    const day = new Date(Date.now()+7*86400000).toISOString().slice(0,10);
    return { ...trainingSources[id], checkedAt: new Date().toISOString(), available: true, resources: [], upcoming: [0,1,2,3,4,5].map(index => ({ title: `Fixture ${id} class ${index+1}`, startDate: day, endDate: day, location: 'Preview-only test location', detail: 'Fictional verification record; not an actual class.', url: trainingSources[id].sourceUrl })) };
  };
  const load = trainingModules({
    [resolve('db/bootstrap.ts')]: { ensureDatabase: async () => db },
    [resolve('app/server-permissions.ts')]: { hasPermission: async request => request.headers.get('x-fixture-role') === 'admin', hasAnyPermission: async request => ['admin','member'].includes(request.headers.get('x-fixture-role')) },
    [resolve('app/lib/external-feeds.ts')]: { loadTrainingProvider },
  });
  const api = load('app/api/training-import/route.ts');
  return { pg, db, stats, load, sources: trainingSources, api, request: (payload, role = 'admin') => api.POST(new Request('http://localhost/api/training-import', { method: 'POST', headers: { 'x-fixture-role': role, 'content-type': 'application/json', 'oai-authenticated-user-email': `${role}@example.invalid` }, body: JSON.stringify(payload) })), close: () => pg.close() };
}
