export type InventoryRow = Record<string, string | number | boolean | string[] | null>;

export function rowValue(row: InventoryRow | undefined, key: string) {
  const value = row?.[key];
  return value === null || value === undefined ? '' : String(value);
}

/** Preserve Array.find's first-match semantics, including already sorted photos. */
export function indexFirstBy<T, K>(rows: readonly T[], key: (row: T) => K): Map<K, T> {
  const index = new Map<K, T>();
  for (const row of rows) {
    const id = key(row);
    if (!index.has(id)) index.set(id, row);
  }
  return index;
}

/** Keep each group's original order without rescanning the complete collection. */
export function groupByKey<T, K>(rows: readonly T[], key: (row: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const row of rows) {
    const id = key(row), group = groups.get(id);
    if (group) group.push(row);
    else groups.set(id, [row]);
  }
  return groups;
}

const compartmentOrder = new Intl.Collator(undefined, { numeric: true });
export const equipmentNameOrder = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function sortCheckItems(
  items: readonly InventoryRow[], equipment: ReadonlyMap<string, InventoryRow>, compartments: ReadonlyMap<string, InventoryRow>,
) {
  return [...items].sort((left, right) => {
    const a = equipment.get(rowValue(left, 'equipment_id')), b = equipment.get(rowValue(right, 'equipment_id'));
    const ac = compartments.get(rowValue(a, 'compartment_id')), bc = compartments.get(rowValue(b, 'compartment_id'));
    return Number(ac?.sort_order ?? Number.MAX_SAFE_INTEGER) - Number(bc?.sort_order ?? Number.MAX_SAFE_INTEGER)
      || compartmentOrder.compare(rowValue(ac, 'label'), rowValue(bc, 'label'))
      || Number(a?.item_order ?? 0) - Number(b?.item_order ?? 0);
  });
}
