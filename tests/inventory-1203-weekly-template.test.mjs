import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const sql = await readFile(new URL('../scripts/sql/1203-weekly-template-cleanup.sql', import.meta.url), 'utf8');
const department = '14a76771-4c24-481b-8def-e6cce005c17b';
const apparatus = '221ef2ce-2a51-4450-bc2a-62d6b6ecefe6';
const groups = [
  ['Driver Side Step', 6], ['Compartment 1 (Top)', 32], ['Compartment 1 (Bottom)', 31],
  ['Compartment 2', 5], ["Driver's Side Drawer", 10], ['Compartment 3', 13],
  ["Driver's Side", 3], ['Compartment 4', 6], ['Rear Compartment', 7],
  ['Compartment 5', 17], ['Compartment 6', 6], ["Officer's Side Drawer", 5],
  ['Compartment 7', 13], ["Officer's Side", 3], ["Officer's Side Step", 2],
  ['Top of Engine', 8], ['Hose', 9],
];

async function setup(t) {
  const pg = new PGlite();
  t.after(() => pg.close());
  await pg.exec(`
    create table departments (id text primary key, name text);
    create table inventory_apparatus_profiles (id text primary key, department_id text, name text);
    create table inventory_compartments (id text primary key, department_id text, apparatus_id text, label text);
    create table inventory_equipment (
      id text primary key, department_id text, apparatus_id text, compartment_id text,
      check_types text[], retired_at timestamptz, updated_at timestamptz default '2026-01-01'
    );
    create table inventory_checks (id text primary key, status text);
    create table inventory_check_items (id text primary key, check_id text, equipment_id text, result text);
    insert into inventory_checks values ('in-progress', 'in_progress'), ('history', 'completed');
    insert into inventory_check_items values
      ('snapshot', 'in-progress', 'target-0-0', 'pending'),
      ('past-result', 'history', 'target-0-0', 'pass');
  `);
  await pg.query('insert into departments values ($1, $2), ($3, $4)',
    [department, 'Stickney Fire Department', 'other-department', 'Another Department']);
  await pg.query('insert into inventory_apparatus_profiles values ($1, $2, $3), ($4, $2, $5), ($6, $7, $3)',
    [apparatus, department, '1203', 'other-rig', '1204', 'other-1203', 'other-department']);
  async function addGroup(id, label, count, tags, dept = department, rig = apparatus, retired = false) {
    await pg.query('insert into inventory_compartments values ($1, $2, $3, $4)', [id, dept, rig, label]);
    for (let i = 0; i < count; i++) {
      await pg.query(`insert into inventory_equipment
        (id, department_id, apparatus_id, compartment_id, check_types, retired_at)
        values ($1, $2, $3, $4, $5, $6)`,
      [`${id}-${i}`, dept, rig, id, tags, retired ? '2026-01-01' : null]);
    }
  }
  // Preview-only fixtures. Extra tags prove that only weekly is removed.
  for (const [index, [label, count]] of groups.entries()) {
    await addGroup(`target-${index}`, label, count, ['weekly', 'inventory', 'air_pack', 'daily']);
  }
  for (const [label, count] of [['Vehicle', 15], ['Front Tires', 2], ['Rear Tires', 4], ['Pump / Booster Tank', 3], ['SCBA', 11]]) {
    await addGroup(`keep-${label}`, label, count, ['weekly', 'inventory', 'air_pack']);
  }
  await addGroup('keep-retired', 'Hose', 1, ['weekly', 'inventory'], department, apparatus, true);
  await addGroup('keep-other-rig', 'Hose', 1, ['weekly', 'inventory'], department, 'other-rig');
  await addGroup('keep-other-department', 'Hose', 1, ['weekly', 'inventory'], 'other-department', 'other-1203');
  await addGroup('keep-without-inventory', 'Hose', 1, ['weekly']);
  await addGroup('keep-inventory-only', 'Hose', 1, ['inventory']);
  return pg;
}

const equipment = async (pg) => (await pg.query('select * from inventory_equipment order by id')).rows;
const snapshots = async (pg) => ({
  checks: (await pg.query('select * from inventory_checks order by id')).rows,
  items: (await pg.query('select * from inventory_check_items order by id')).rows,
});

test('1203 cleanup removes only the approved Weekly tags and preserves equipment and historical checks', async (t) => {
  const pg = await setup(t);
  const before = await equipment(pg);
  const history = await snapshots(pg);
  await pg.exec(sql);
  const after = await equipment(pg);
  assert.equal(after.length, before.length);
  let changed = 0;
  for (let i = 0; i < before.length; i++) {
    if (before[i].id.startsWith('target-')) {
      changed++;
      assert.deepEqual(after[i].check_types, before[i].check_types.filter((tag) => tag !== 'weekly'));
      assert.deepEqual({ ...after[i], check_types: before[i].check_types, updated_at: before[i].updated_at }, before[i]);
    } else {
      assert.deepEqual(after[i], before[i]);
    }
  }
  assert.equal(changed, 176);
  assert.deepEqual(await snapshots(pg), history);
  await pg.exec(sql);
  assert.deepEqual(await equipment(pg), after, 'a second run makes no changes');
});

test('unexpected partial target sets abort without saving any template changes', async (t) => {
  const pg = await setup(t);
  await pg.query("update inventory_equipment set check_types = array['inventory'] where id = 'target-0-0'");
  const before = await equipment(pg);
  await assert.rejects(pg.exec(sql), /expected 176 or 0 rows; got 175/);
  await pg.exec('rollback');
  assert.deepEqual(await equipment(pg), before);
});
