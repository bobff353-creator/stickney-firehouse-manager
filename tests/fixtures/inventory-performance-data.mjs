// Deterministic fictional records and the previous production ordering algorithm.
export function inventoryFixture(size) {
  const compartments = Array.from({ length: Math.max(2, Math.ceil(size / 20)) }, (_, i) => ({ id: `cab-${i}`, label: `Cabinet ${i}`, sort_order: i % 5 }));
  const equipment = Array.from({ length: size }, (_, i) => ({ id: `item-${i}`, compartment_id: compartments[i % compartments.length].id, item_order: i % 13 }));
  const items = equipment.map((item, i) => ({ id: `check-item-${i}`, equipment_id: item.id, check_id: 'check-1' })).reverse();
  return { compartments, equipment, items };
}

export function previousCheckSort(items, equipment, compartments) {
  const value = (row, key) => row?.[key] == null ? '' : String(row[key]);
  return [...items].sort((left, right) => {
    const a = equipment.find(item => value(item, 'id') === value(left, 'equipment_id'));
    const b = equipment.find(item => value(item, 'id') === value(right, 'equipment_id'));
    const ac = compartments.find(item => value(item, 'id') === value(a, 'compartment_id'));
    const bc = compartments.find(item => value(item, 'id') === value(b, 'compartment_id'));
    return Number(ac?.sort_order ?? Number.MAX_SAFE_INTEGER) - Number(bc?.sort_order ?? Number.MAX_SAFE_INTEGER)
      || value(ac, 'label').localeCompare(value(bc, 'label'), undefined, { numeric: true })
      || Number(a?.item_order ?? 0) - Number(b?.item_order ?? 0);
  });
}
