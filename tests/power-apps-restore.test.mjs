import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { buildRestoreMigration } from '../scripts/power-apps-restore-plan.mjs';

const passphrase = 'fixture-only-not-a-deployment-key-'.repeat(3);
const catalog = {
  source_project: 'datqzdndkrfyovhwppuq',
  relations: [{ schema: 'firehouse', name: 'pay_scales', kind: 'r' }, { schema: 'firehouse', name: 'employees', kind: 'r' }],
  constraints: ['pay_scales', 'employees'].map(table => ({ schema: 'firehouse', table, type: 'p', definition: 'PRIMARY KEY (id)' })),
  columns: ['pay_scales', 'employees'].flatMap(table => (table === 'pay_scales' ? ['id', 'label', 'rate'] : ['id', 'pay_scale_id', 'name', 'reference_number', 'updated_at']).map((name, position) => ({ schema: 'firehouse', table, name, position }))),
  triggers: [{ schema: 'firehouse', table: 'employees', name: 'stamp_and_audit', enabled: 'O' }],
};
async function fixture() {
  const pg = new PGlite({ extensions: { pgcrypto } });
  await pg.exec(`SET timezone='UTC'; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
    CREATE SCHEMA private; CREATE SCHEMA firehouse; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
    CREATE TABLE public.portal_pin_credentials(id int);
    CREATE TABLE firehouse.pay_scales(id text PRIMARY KEY,label text,rate numeric(12,2));
    CREATE TABLE firehouse.employees(id text PRIMARY KEY,pay_scale_id text REFERENCES firehouse.pay_scales(id),name text,reference_number bigint,updated_at timestamptz);
    CREATE TABLE firehouse.restore_probe(message text);
    CREATE FUNCTION firehouse.stamp_and_audit() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN NEW.updated_at=now(); INSERT INTO firehouse.restore_probe VALUES ('application write'); RETURN NEW; END$$;
    CREATE TRIGGER stamp_and_audit BEFORE INSERT OR UPDATE ON firehouse.employees FOR EACH ROW EXECUTE FUNCTION firehouse.stamp_and_audit();`);
  await pg.exec(buildRestoreMigration(catalog, ['firehouse.pay_scales', 'firehouse.employees']));
  async function snapshot({ invalidForeignKey = false, corruptHash = false, parts = 1 } = {}) {
    const sourceRows = {
      'firehouse.pay_scales': ['{"id":"fixture-scale","label":"Fixture","rate":123.45}'],
      'firehouse.employees': [`{"id":"fixture-employee","name":"Fixture member","pay_scale_id":"${invalidForeignKey ? 'missing' : 'fixture-scale'}","reference_number":9007199254740993,"updated_at":"2026-11-17T12:00:00+00:00"}`, '{"id":"fixture-employee-2","name":"Another fixture member","pay_scale_id":"fixture-scale","reference_number":9007199254740995,"updated_at":"2026-11-17T13:00:00+00:00"}'],
    };
    const tables = {};
    for (const [key, rows] of Object.entries(sourceRows)) {
      const canonical = await Promise.all(rows.map(async row => (await pg.query(`SELECT to_jsonb(r)::text AS value FROM jsonb_populate_record(NULL::${key},$1::jsonb) r`, [row])).rows[0].value));
      tables[key] = { rows: canonical, count: String(canonical.length), sha256: createHash('sha256').update(canonical.join('\n')).digest('hex') };
    }
    if (corruptHash) tables['firehouse.employees'].sha256 = '0'.repeat(64);
    const data = JSON.stringify({ source_project: catalog.source_project, captured_at: '2026-11-17T12:00:00Z', identities: [], tables });
    const cipher = (await pg.query("SELECT extensions.pgp_sym_encrypt($1,$2,'cipher-algo=aes256,compress-algo=1') AS bytes", [data, passphrase])).rows[0].bytes;
    const id = (await pg.query("INSERT INTO private.review_import_runs(source_project,target_project,cipher_sha256,byte_size,parts) VALUES($1,'qizfnynrspsydiuwkkex',$2,$3,$4) RETURNING id", [catalog.source_project, createHash('sha256').update(cipher).digest('hex'), cipher.length, parts])).rows[0].id;
    await pg.query('INSERT INTO private.review_import_chunks VALUES($1,0,$2)', [id, cipher]);
    return id;
  }
  return { pg, snapshot };
}

test('the atomic restore retains exact bigint, money and timestamps without fabricating application audit events', async () => {
  const f = await fixture();
  try {
    const id = await f.snapshot();
    await f.pg.exec("SET timezone='America/Chicago'");
    const result = (await f.pg.query('SELECT private.restore_review_snapshot($1,$2) AS result', [id, passphrase])).rows[0].result;
    assert.equal(result.tables.length, 2);
    const member = (await f.pg.query("SELECT reference_number::text AS ref,(updated_at AT TIME ZONE 'UTC')::text AS stamp FROM firehouse.employees WHERE id='fixture-employee'")).rows[0];
    assert.equal(member.ref, '9007199254740993'); assert.match(member.stamp, /^2026-11-17 12:00:00/);
    assert.equal((await f.pg.query('SELECT count(*)::int AS count FROM firehouse.restore_probe')).rows[0].count, 0);
    await f.pg.exec("UPDATE firehouse.employees SET name='Fixture update' WHERE id='fixture-employee'");
    assert.equal((await f.pg.query('SELECT count(*)::int AS count FROM firehouse.restore_probe')).rows[0].count, 1, 'The original trigger must be restored.');
    const again = (await f.pg.query('SELECT private.restore_review_snapshot($1,$2) AS result', [id, passphrase])).rows[0].result;
    assert.deepEqual(again, result, 'A completed import returns verification without replacing subsequent work.');
  } finally { await f.pg.close(); }
});

for (const [name, options, expected] of [['invalid foreign key', { invalidForeignKey: true }, /foreign key/], ['mismatched hash', { corruptHash: true }, /hash differs/], ['missing encrypted chunk', { parts: 2 }, /incomplete/]]) {
  test(`${name} rolls back the complete restore and keeps triggers active`, async () => {
    const f = await fixture();
    try {
      const id = await f.snapshot(options);
      await assert.rejects(f.pg.query('SELECT private.restore_review_snapshot($1,$2)', [id, passphrase]), expected);
      assert.equal((await f.pg.query('SELECT count(*)::int AS count FROM firehouse.pay_scales')).rows[0].count, 0);
      assert.equal((await f.pg.query("SELECT tgenabled FROM pg_trigger WHERE tgname='stamp_and_audit'")).rows[0].tgenabled, 'O');
      assert.equal((await f.pg.query('SELECT status FROM private.review_import_runs WHERE id=$1', [id])).rows[0].status, 'uploading');
    } finally { await f.pg.close(); }
  });
}

test('members cannot execute the restore, read its private chunks, or restore after PIN activation', async () => {
  const f = await fixture();
  try {
    const rights = (await f.pg.query("SELECT has_function_privilege('authenticated','private.restore_review_snapshot(uuid,text)','EXECUTE') AS can_execute,has_table_privilege('authenticated','private.review_import_chunks','SELECT') AS can_read")).rows[0];
    assert.equal(rights.can_execute, false); assert.equal(rights.can_read, false);
    const id = await f.snapshot(); await f.pg.exec('INSERT INTO public.portal_pin_credentials VALUES(1)');
    await assert.rejects(f.pg.query('SELECT private.restore_review_snapshot($1,$2)', [id, passphrase]), /before member PIN activation/);
  } finally { await f.pg.close(); }
});
