import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

function load(file, dependencies = {}) {
  const source = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (!(name in dependencies)) throw Error('Unstubbed import: ' + name);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}

function fixture() {
  const sql = new DatabaseSync(':memory:');
  const bootstrap = fs.readFileSync(new URL('../db/bootstrap.ts', import.meta.url), 'utf8');
  for (const name of ['pay_scales', 'employees', 'employee_profiles']) {
    const source = bootstrap.split('\n').find(line => line.includes(`CREATE TABLE IF NOT EXISTS ${name} (`));
    sql.exec(JSON.parse(source.match(/db\.prepare\((".*")\)/)[1]));
  }
  sql.exec(`ALTER TABLE employee_profiles ADD COLUMN single_role INTEGER DEFAULT 0;
    INSERT INTO pay_scales VALUES('firefighter','Firefighter',23,34.5,34.5,1);
    INSERT INTO employees(id,name,pay_scale_id,sort_order) VALUES('fixture','Member, Test','firefighter',3);
    INSERT INTO employee_profiles(employee_id,email,phone,secondary_email,notes) VALUES('fixture','work@example.invalid','(708) 555-0101','old@example.invalid','Preserved note');`);
  const permissions = new Set(['employees.manage', 'employees.view', 'payroll.view_own', 'permissions.manage']);
  const db = { failSecondary: false, prepare(query) { return { query, args: [], bind(...args) { this.args = args; return this; },
    async first() { return sql.prepare(query).get(...this.args) ?? null; },
    async all() { return { results: sql.prepare(query).all(...this.args) }; },
    async run() { return sql.prepare(query).run(...this.args); },
  }; }, async batch(statements) {
    sql.exec('BEGIN');
    try {
      for (const statement of statements) {
        if (db.failSecondary && statement.query.startsWith('UPDATE employee_profiles SET secondary_email')) throw Error('Simulated write failure');
        await statement.run();
      }
      sql.exec('COMMIT');
    } catch (error) { sql.exec('ROLLBACK'); throw error; }
  } };
  const dependencies = { '../../../db/bootstrap': { ensureDatabase: async () => db }, '../../server-permissions': { permissionsForEmail: async email => email === 'work@example.invalid' ? permissions : new Set() } };
  const payroll = load('app/api/payroll/route.ts', { ...dependencies, '../../employee-names': load('app/employee-names.ts'), '../../phone-format': load('app/phone-format.ts'), '../../payroll-rounding': {}, '../../payroll-calculation': {} });
  const directory = load('app/api/employee-directory/route.ts', dependencies);
  const payload = { action: 'saveEmployee', id: 'fixture', lastName: 'Member', firstName: 'Test', payScaleId: 'firefighter', email: 'work@example.invalid', phone: '7085550101', notes: 'Preserved note' };
  const request = (body, email = 'work@example.invalid') => new Request('https://portal.test/api/payroll', { method: 'POST', headers: { 'content-type': 'application/json', 'oai-authenticated-user-email': email }, body: JSON.stringify(body) });
  const read = () => ({ ...sql.prepare('SELECT email,secondary_email,phone,notes,is_admin FROM employee_profiles').get() });
  return { sql, db, permissions, payroll, directory, payload, request, read };
}

test('employee editor saves a personal address separately and formats phone without changing login identity', async () => {
  const f = fixture(); try {
    const response = await f.payroll.POST(f.request({ ...f.payload, secondaryEmail: ' Personal@Example.Invalid ' }));
    assert.equal(response.status, 200, await response.text());
    assert.deepEqual(f.read(), { email: 'work@example.invalid', secondary_email: 'personal@example.invalid', phone: '(708) 555-0101', notes: 'Preserved note', is_admin: 0 });
    assert.equal((await f.payroll.POST(f.request({ ...f.payload, secondaryEmail: 'personal@example.invalid' }, 'personal@example.invalid'))).status, 403);
  } finally { f.sql.close(); }
});

test('older editors preserve a secondary address; an explicit blank clears it', async () => {
  const f = fixture(); try {
    assert.equal((await f.payroll.POST(f.request(f.payload))).status, 200);
    assert.equal(f.read().secondary_email, 'old@example.invalid');
    assert.equal((await f.payroll.POST(f.request({ ...f.payload, secondaryEmail: '' }))).status, 200);
    assert.equal(f.read().secondary_email, null);
  } finally { f.sql.close(); }
});

test('employee managers may edit personal contacts but cannot change login identity', async () => {
  const f = fixture(); try {
    f.permissions.delete('permissions.manage');
    assert.equal((await f.payroll.POST(f.request({ ...f.payload, secondaryEmail: 'personal@example.invalid' }))).status, 200);
    assert.equal((await f.payroll.POST(f.request({ ...f.payload, email: 'other@example.invalid', secondaryEmail: 'personal@example.invalid' }))).status, 403);
    assert.equal(f.read().email, 'work@example.invalid');
  } finally { f.sql.close(); }
});

test('invalid or multiple secondary addresses fail before changing the employee', async () => {
  const f = fixture(); try {
    const before = f.read();
    for (const secondaryEmail of ['bad-address', 'a@b.invalid,c@d.invalid', 'a@b.invalid; c@d.invalid', 'a@b.invalid\r\nBcc:x@y.invalid', 'a'.repeat(255) + '@b.invalid']) {
      assert.equal((await f.payroll.POST(f.request({ ...f.payload, notes: 'Must not save', secondaryEmail }))).status, 400);
      assert.deepEqual(f.read(), before);
    }
  } finally { f.sql.close(); }
});

test('a failed secondary-email write rolls back the entire employee save', async () => {
  const f = fixture(); try {
    const before = f.read(); f.db.failSecondary = true;
    assert.equal((await f.payroll.POST(f.request({ ...f.payload, notes: 'Must roll back', secondaryEmail: 'new@example.invalid' }))).status, 500);
    assert.deepEqual(f.read(), before);
  } finally { f.sql.close(); }
});

test('contact permission is required for both email addresses; basic directory never exposes them', async () => {
  const f = fixture(); try {
    const request = contacts => new Request('https://portal.test/api/employee-directory?contacts=' + contacts, { headers: { 'oai-authenticated-user-email': 'work@example.invalid' } });
    const basic = await (await f.directory.GET(request('0'))).json();
    assert.deepEqual(Object.keys(basic.employees[0]).sort(), ['id', 'name', 'rank']);
    assert.equal((await f.directory.GET(request('1'))).status, 403);
    f.permissions.add('contacts.view');
    const contacts = await (await f.directory.GET(request('1'))).json();
    assert.equal(contacts.employees[0].email, 'work@example.invalid');
    assert.equal(contacts.employees[0].secondaryEmail, 'old@example.invalid');
  } finally { f.sql.close(); }
});
