import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { trainingModules } from './helpers/training-modules.mjs';
const permissions = trainingModules()('app/permissions.ts');
async function harness(role = 'Lieutenant') {
  const pg = new PGlite();
  await pg.exec(`CREATE SCHEMA firehouse;SET search_path=firehouse;
    CREATE TABLE daily_logs(log_date text PRIMARY KEY);CREATE TABLE daily_log_staffing(log_date text,shift_key text,employee_id text);
    CREATE TABLE daily_log_calls(id text,log_date text,call_type text,time_out text);CREATE TABLE daily_log_approvals(log_date text,sign_in_equipment text,sign_out_equipment text);
    CREATE TABLE employees(id text,pay_scale_id text);CREATE TABLE pay_scales(id text,label text,regular_rate numeric,overtime_rate numeric,holiday_rate numeric);
    CREATE TABLE employee_profiles(employee_id text,is_dpw integer);CREATE TABLE time_entries(employee_id text,period_start text,work_date text,category text,hours numeric);
    CREATE TABLE payroll_settings(id integer,overtime_threshold numeric,acting_officer_premium numeric,dpw_multiplier numeric);
    CREATE TABLE pay_rate_history(pay_scale_id text,effective_date text,regular_rate numeric,overtime_rate numeric,holiday_rate numeric);
    CREATE TABLE cad_inbound_receipts(provider text,status text,received_at text);`);
  const queries = [], allowed = new Set(permissions.defaultPermissionsForRank(role));
  const adapter = trainingModules({ [resolve('app/supabase-server.ts')]: {}, [resolve('app/department-portal.ts')]: { getPortalDepartment: async () => ({ id: 'fixture', isolated: false }) } });
  const db = adapter('db/postgres-adapter.ts').createPostgresD1Adapter(async () => ({ rpc: async (name, args) => {
    queries.push(args.p_sql);
    try { const result = await pg.query(args.p_sql); return { data: args.p_mode === 'first' ? result.rows[0] ?? null : result.rows, error: null }; } catch (error) { return { data: null, error: { message: error.message } }; }
  } }));
  const api = trainingModules({ [resolve('db/bootstrap.ts')]: { ensureDatabase: async () => db }, [resolve('app/server-permissions.ts')]: { hasPermission: async (request, database, key) => request.headers.get('oai-authenticated-user-email') === 'fixture@example.invalid' && allowed.has(key) } })('app/api/command-center/route.ts');
  const request = (query = '', email = 'fixture@example.invalid') => new Request(`http://localhost/api/command-center${query}`, { headers: { 'oai-authenticated-user-email': email } });
  return { pg, api, request, queries, allowed, close: () => pg.close() };
}
test('officer JSON and CSV never query or serialize payroll or administrator integration data', async () => {
  const h = await harness(); try {
    const response = await h.api.GET(h.request()); assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /private.*no-store/);
    const body = await response.json(); assert.equal(body.sources.payroll, 'restricted'); assert.equal(body.fiscalYear.payToDate, null); assert.equal(body.payrollSettings, null); assert.deepEqual(body.payrollDetails, []); assert.equal(body.integrations.cad.credentialsConfigured, null);
    const csv = await h.api.GET(h.request(`?format=csv&start=${body.coverage.latest}&end=${body.coverage.latest}`)); assert.equal(csv.status, 200); assert.ok((await csv.text()).includes('restricted'));
    assert.ok(!h.queries.some(query => /time_entries|pay_rate_history|payroll_settings|cad_inbound_receipts/.test(query)));
  } finally { await h.close(); }
});
test('denied Command Center or source permission cannot be bypassed with export parameters', async () => {
  const h = await harness(); try {
    assert.equal((await h.api.GET(h.request('?format=csv', 'unknown@example.invalid'))).status, 403); assert.equal(h.queries.length, 0);
    h.allowed.delete('daily_log.view'); const body = await (await h.api.GET(h.request())).json(); assert.equal(body.sources.calls, 'restricted'); assert.equal(body.sources.staffing, 'restricted'); assert.equal(body.sources.equipment, 'restricted'); assert.deepEqual(body.daily, []); assert.equal(h.queries.length, 0);
  } finally { await h.close(); }
});
test('one failed source leaves other authorized analytics usable and unknown values labelled unavailable', async () => {
  const h = await harness('Chief'); try {
    await h.pg.exec('DROP TABLE payroll_settings;DROP TABLE daily_log_staffing;');
    const body = await (await h.api.GET(h.request())).json(); assert.equal(body.sources.payroll, 'unavailable'); assert.equal(body.sources.staffing, 'unavailable'); assert.equal(body.sources.calls, 'ready'); assert.equal(body.sources.equipment, 'ready'); assert.equal(body.fiscalYear.payToDate, null);
    const date = body.coverage.latest; await h.pg.query('INSERT INTO daily_log_approvals VALUES($1,$2,$3)', [date, 'invalid', '{}']);
    const changed = await (await h.api.GET(h.request())).json(); assert.equal(changed.sources.equipment, 'unavailable'); assert.equal(changed.sources.calls, 'ready');
    const csv = await h.api.GET(h.request(`?format=csv&start=${date}&end=${date}`)); assert.ok((await csv.text()).includes('unavailable'));
  } finally { await h.close(); }
});
test('chief payroll includes earlier period entries when calculating a boundary-day overtime total', async () => {
  const h = await harness('Chief'); try {
    const before = await (await h.api.GET(h.request())).json(), earliest = before.coverage.earliest;
    const previous = new Date(`${earliest}T12:00:00Z`); previous.setUTCDate(previous.getUTCDate() - 1); const period = previous.toISOString().slice(0, 10);
    await h.pg.exec("INSERT INTO payroll_settings VALUES(1,106,1,1.5);INSERT INTO employees VALUES('private-employee','ff');INSERT INTO pay_scales VALUES('ff','Firefighter',20,30,40);");
    await h.pg.query('INSERT INTO time_entries VALUES($1,$2,$3,$4,$5),($1,$2,$6,$4,$7)', ['private-employee', period, period, 'shift', 100, earliest, 10]);
    const body = await (await h.api.GET(h.request())).json(); assert.equal(body.sources.payroll, 'ready'); assert.equal(body.payrollDetails.length, 1); assert.equal(body.payrollDetails[0].overtimeHours, 4); assert.equal(body.payrollDetails[0].cost, 240);
    assert.equal((await h.api.GET(h.request('?format=csv&start=2026-02-30&end=2026-03-01'))).status, 400);
    assert.equal(body.integrations.cad.liveVerified, false); assert.equal(body.integrations.neris.state, 'not_connected'); assert.equal(body.integrations.ai.state, 'not_enabled');
    await h.pg.exec('UPDATE payroll_settings SET overtime_threshold=NULL');
    const missing = await (await h.api.GET(h.request())).json(); assert.equal(missing.sources.payroll, 'unavailable'); assert.equal(missing.fiscalYear.payToDate, null);
  } finally { await h.close(); }
});
