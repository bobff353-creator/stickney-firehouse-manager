import test from 'node:test';
import assert from 'node:assert/strict';
import { indexFirstBy, groupByKey, sortCheckItems, rowValue, equipmentNameOrder } from '../app/inventory-index.ts';
import { inventoryFixture, previousCheckSort } from './fixtures/inventory-performance-data.mjs';

test('indexed check ordering matches the prior order for missing, duplicate, tied, and mixed-type records', () => {
  const { items, equipment, compartments } = inventoryFixture(240);
  equipment.push({ ...equipment[0], item_order: -99 }); // First match must win.
  compartments.push({ ...compartments[0], sort_order: -99 });
  equipment[2].compartment_id = 'removed-cabinet';
  equipment[3].item_order = '4';
  equipment[4].item_order = null;
  compartments[5].sort_order = null;
  compartments[6].sort_order = '1';
  items.push({ id: 'removed-equipment', equipment_id: 'missing' }, { id: 'tie', equipment_id: items[0].equipment_id });
  const original = structuredClone({ items, equipment, compartments });
  const actual = sortCheckItems(items, indexFirstBy(equipment, item => rowValue(item, 'id')), indexFirstBy(compartments, item => rowValue(item, 'id')));
  assert.deepEqual(actual, previousCheckSort(items, equipment, compartments));
  assert.deepEqual({ items, equipment, compartments }, original);
  assert.deepEqual(sortCheckItems([], new Map(), new Map()), []);
});

test('photo and stock indexes preserve first matches, input order, and empty groups', () => {
  const photos = [{ id: 'newest', equipment_id: 'a' }, { id: 'older', equipment_id: 'a' }, { id: 'only', equipment_id: 'b' }];
  const lookup = indexFirstBy(photos, row => row.equipment_id);
  assert.equal(lookup.get('a'), photos[0]);
  assert.equal(lookup.get('b'), photos[2]);
  assert.equal(lookup.get('missing'), undefined);
  const lots = [{ stock_item_id: 'a', quantity: 0 }, { stock_item_id: 'b', quantity: 3 }, { stock_item_id: 'a', quantity: 5 }];
  const grouped = groupByKey(lots, lot => lot.stock_item_id);
  assert.deepEqual(grouped.get('a'), [lots[0], lots[2]]);
  assert.deepEqual(grouped.get('b'), [lots[1]]);
  assert.equal(grouped.get('missing'), undefined);
  assert.equal(groupByKey([], row => row.id).size, 0);
});

test('reused equipment collator preserves natural, case-insensitive ordering', () => {
  const names = ['Engine 10', 'engine 2', 'Cabinet 02', 'cabinet 2', 'Áir pack', 'Air pack', '', 'Hose 1'];
  assert.deepEqual([...names].sort(equipmentNameOrder.compare), [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })));
});
