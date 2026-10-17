import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { payrollDatabaseFixture } from './helpers/payroll-submission-db.mjs';
import { trainingModules } from './helpers/training-modules.mjs';

test('actual payroll API restricts employees to their own records and honors explicit manager permission', async () => {
  const f = await payrollDatabaseFixture();
  try {
    await f.pg.exec(`
      ALTER TABLE firehouse.employee_profiles ADD employee_number text,ADD start_date text,ADD end_date text;
      ALTER TABLE firehouse.record_revisions ADD changed_at text;
      ALTER TABLE firehouse.pay_scales ADD sort_order int DEFAULT 0;
      ALTER TABLE firehouse.pay_rate_history ADD created_by text,ADD created_at text;
      ALTER TABLE firehouse.payroll_settings ADD acting_officer_premium numeric DEFAULT 1;
      ALTER TABLE firehouse.pay_periods ADD created_by text,ADD created_at text,ADD updated_by text,ADD updated_at text,ADD finalized_by text,ADD finalized_at text;
      CREATE FUNCTION firehouse.employee_id_for_login(login_email text) RETURNS text LANGUAGE sql AS $$ SELECT employee_id FROM firehouse.employee_profiles WHERE email=login_email $$;
      INSERT INTO firehouse.time_entries VALUES('member-own','b','2026-09-11','2026-09-24','shift',6);
      INSERT INTO firehouse.daily_log_staffing VALUES('staff-a','2026-09-24','a','morning','06:00','12:00'),('staff-b','2026-09-24','b','afternoon','12:00','18:00');
    `);
    let manager = false;
    let permitted = true;
    const api = trainingModules({
      [resolve('db/bootstrap.ts')]: { ensureDatabase: async () => f.db },
      [resolve('app/server-permissions.ts')]: { permissionsForEmail: async () => new Set(permitted ? ['payroll.view_own', ...(manager ? ['payroll.manage'] : [])] : []) },
    })('app/api/payroll/route.ts');
    const request = (body) => new Request('https://fixture.invalid/api/payroll?period=2026-09-11&employeeId=a', {
      method: body ? 'POST' : 'GET', headers: { 'oai-authenticated-user-email':'member@example.test','content-type':'application/json' }, ...(body ? {body:JSON.stringify(body)} : {}),
    });
    const own = await api.GET(request());
    assert.equal(own.status, 200, await own.clone().text());
    const data = await own.json();
    assert.deepEqual(data.employees.map(row => row.id), ['b']);
    assert.ok(data.entries.length > 0 && data.entries.every(row => row.employeeId === 'b'));
    assert.ok(data.reviewStaffing.length > 0 && data.reviewStaffing.every(row => row.employeeId === 'b'));
    assert.deepEqual(data.rateHistory, []);
    const write = {action:'saveEntry',employeeId:'a',periodStart:'2026-09-11',workDate:'2026-09-24',category:'shift',hours:8};
    assert.equal((await api.POST(request(write))).status, 403);
    assert.equal((await api.POST(request({...write, employeeId:'b'}))).status, 403);
    manager = true;
    const managed = await (await api.GET(request())).json();
    assert.equal(managed.employees.length, 2);
    assert.ok(managed.entries.some(row => row.employeeId === 'a'));
    assert.ok(managed.entries.some(row => row.employeeId === 'b'));
    assert.ok(managed.rateHistory.length > 0);
    permitted = false;
    assert.equal((await api.GET(request())).status, 403);
  } finally { await f.pg.close(); }
});
