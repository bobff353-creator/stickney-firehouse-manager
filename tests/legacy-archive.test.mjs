import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('legacy preservation retains IDs and JSON while denying all app roles', async t => {
  const pg = new PGlite();
  t.after(() => pg.close());
  await pg.exec(`create role anon; create role authenticated; create role service_role;
    create table public.departments(id uuid primary key);
    insert into public.departments values ('00000000-0000-0000-0000-000000000001');`);
  await pg.exec(await readFile(new URL('../supabase/migrations/20261113025005_preserve_stickney_legacy_archive.sql', import.meta.url), 'utf8'));
  await pg.exec(`insert into stickney_legacy_archive.snapshots
    (id,department_id,source_project,captured_at,status,notes)
    values ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','fixture',now(),'copying','fixture');
    insert into stickney_legacy_archive.tables(snapshot_id,source_schema,source_table,records,source_metadata)
    values ('00000000-0000-0000-0000-000000000002','historical','reports','[{"id":"original-id","parent_id":"original-parent","results":[0,false,null]}]','{}');`);
  const {rows} = await pg.query('select records,record_count from stickney_legacy_archive.tables');
  assert.equal(rows[0].record_count,1);
  assert.deepEqual(rows[0].records,[{id:'original-id',parent_id:'original-parent',results:[0,false,null]}]);
  for (const role of ['anon','authenticated','service_role']) {
    const permissions = await pg.query(`select has_schema_privilege($1,'stickney_legacy_archive','USAGE') as allowed`,[role]);
    assert.equal(permissions.rows[0].allowed,false);
    await pg.exec(`set role ${role}`);
    await assert.rejects(pg.query('select * from stickney_legacy_archive.tables'), /permission denied/);
    await pg.exec('reset role');
  }
  const rls = await pg.query(`select relname,relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='stickney_legacy_archive' and relkind='r'`);
  assert.equal(rls.rows.length,3);
  assert.ok(rls.rows.every(row=>row.relrowsecurity));
});

test('private archive storage stays blocked even beside broad permissive policies', async t => {
  const pg=new PGlite();t.after(()=>pg.close());
  await pg.exec(`create role anon; create role authenticated; create schema storage;
    create table storage.objects(bucket_id text); alter table storage.objects enable row level security;
    grant usage on schema storage to anon,authenticated;
    grant select,insert on storage.objects to anon,authenticated;
    create policy broad_existing_policy on storage.objects for all to anon,authenticated using(true) with check(true);
    insert into storage.objects values('stickney-legacy-archive'),('existing-bucket');`);
  await pg.exec(await readFile(new URL('../supabase/migrations/20261113025456_guard_stickney_legacy_storage.sql',import.meta.url),'utf8'));
  for(const role of ['anon','authenticated']){
    await pg.exec(`set role ${role}`);
    assert.deepEqual((await pg.query('select * from storage.objects')).rows,[{bucket_id:'existing-bucket'}]);
    await assert.rejects(pg.exec("insert into storage.objects values('stickney-legacy-archive')"),/row-level security/);
    await pg.exec('reset role');
  }
});
