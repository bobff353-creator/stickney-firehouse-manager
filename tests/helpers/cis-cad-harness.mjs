import { PGlite } from '@electric-sql/pglite';
import { resolve } from 'node:path';
import { trainingModules } from './training-modules.mjs';
export async function cisHarness() {
  const pg = new PGlite();
  await pg.exec(`CREATE TABLE system_meta(key text PRIMARY KEY,value text,updated_at text DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE fleet_apparatus(unit_number text PRIMARY KEY,name text); INSERT INTO fleet_apparatus VALUES('1204','Fixture truck'),('1205','Fixture ambulance');
    CREATE TABLE cad_inbound_receipts(id text PRIMARY KEY,provider text,dedupe_key text,external_event_id text DEFAULT '',external_incident_id text DEFAULT '',event_type text DEFAULT '',payload_format text,raw_payload text,normalized_payload text,status text,error_message text DEFAULT '',duplicate_of text,received_at text,processed_at text,UNIQUE(provider,dedupe_key));
    CREATE TABLE dispatch_incidents(incident_id text PRIMARY KEY,resend_email_id text UNIQUE,call_type text,category text,address text,city text,narrative text,responding_units text,longitude real,latitude real,dispatched_at text,time_out text,attachment_count int DEFAULT 0,source_payload text,source_system text DEFAULT 'CAD email',received_at text DEFAULT CURRENT_TIMESTAMP,cleared_at text,active int);
    CREATE TABLE daily_logs(log_date text PRIMARY KEY,created_by text,updated_by text);
    CREATE TABLE daily_log_calls(id text PRIMARY KEY,log_date text,report_number text,time_out text,time_in text,responding_units text,address text,call_type text,sort_order int);
    CREATE FUNCTION enable_cad_push_outbox() RETURNS void LANGUAGE sql AS $$ SELECT set_config('fixture.cad_push','enabled',true)::text $$;`);
  const base = trainingModules({ [resolve('app/supabase-server.ts')]: {} });
  const { createPostgresD1Adapter } = base('db/postgres-adapter.ts');
  const stats = { queries: [], failBatchAt: -1, pushes: [] };
  const client = { rpc: async (name, args) => {
    try {
      const execute = async (target, sql, mode) => {
        stats.queries.push(sql);
        if (sql.length > 200000 || /(;|--|\/\*|\*\/)/.test(sql) || /\b(create|alter|drop|truncate|grant|revoke|copy|call|show|reset|listen|notify|vacuum|analyze)\b/i.test(sql)) throw Error('Unsafe portal query');
        const result = await target.query(sql);
        return { data: mode === 'first' ? result.rows[0] ?? null : mode === 'all' ? result.rows : { success: true, meta: { changes: result.affectedRows } }, changes: result.affectedRows };
      };
      if (name.endsWith('_batch')) return { error: null, data: await pg.transaction(async tx => {
        const results = [];
        for (const [index, statement] of args.p_statements.entries()) {
          if (index === stats.failBatchAt) { stats.failBatchAt = -1; throw Error('Simulated transaction failure'); }
          const result = await execute(tx, statement.sql, statement.mode);
          if (statement.requiredChanges !== null && statement.requiredChanges !== result.changes) throw Error('SAVE_CONFLICT: record changed');
          results.push(result.data);
        }
        return results;
      }) };
      return { error: null, data: (await execute(pg, args.p_sql, args.p_mode)).data };
    } catch (error) { return { data: null, error: { message: error.message } }; }
  } };
  const db = createPostgresD1Adapter(async () => client);
  const load = trainingModules({
    [resolve('db/bootstrap.ts')]: { ensureDatabase: async () => db },
    [resolve('app/supabase-server.ts')]: {},
    [resolve('app/supabase-system.ts')]: { getSupabaseSystemClient: async () => client },
    [resolve('app/server-permissions.ts')]: { hasPermission: async request => request.headers.get('x-fixture-role') === 'admin' },
    [resolve('app/cad-push-worker.ts')]: { scheduleCadPushDelivery: id => stats.pushes.push(id) },
    [resolve('app/api/suite-context/route.ts')]: { GET: async () => Response.json({ apparatus: [{ unitNumber: '1204', name: 'Fixture truck' }, { unitNumber: '1205', name: 'Fixture ambulance' }] }) },
  });
  return { pg, db, stats, load, ingest: load('app/cis-cad-ingest.ts').ingestCisDelivery, api: load('app/api/cad/cis/route.ts'), close: () => pg.close() };
}
