export type ContainerRow = Record<string, string | number | boolean | string[] | null>;
export const containerText = (row: ContainerRow, key: string) => String(row[key] ?? '');
export function isInventoryContainer(row: ContainerRow, equipment: ContainerRow[]) {
  return ['bag', 'kit', 'toolbox', 'container'].includes(containerText(row, 'item_type')) || equipment.some(item => item.parent_equipment_id === row.id && !item.retired_at);
}
export function containerEquipmentPage(equipment: ContainerRow[], container: ContainerRow, options: { query: string; scope: 'compartment' | 'rig'; grouping: 'all' | 'loose' | 'grouped'; page: number }) {
  const words = options.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const parents = new Map(equipment.map(item => [containerText(item, 'id'), item]));
  const containerIds = new Set(equipment.filter(item => !item.retired_at).map(item => containerText(item, 'parent_equipment_id')).filter(Boolean));
  const matches = equipment.filter(item => item.id !== container.id && item.parent_equipment_id !== container.id && !item.retired_at && !item.scba_asset_kind
    && item.apparatus_id === container.apparatus_id && !['bag','kit','toolbox','container'].includes(containerText(item,'item_type')) && !containerIds.has(containerText(item,'id'))
    && (options.scope === 'rig' || item.compartment_id === container.compartment_id)
    && (options.grouping === 'all' || (options.grouping === 'grouped' ? Boolean(item.parent_equipment_id) : !item.parent_equipment_id))
    && words.every(word => ['name','barcode','asset_number','serial_number','manufacturer','model','compartment_label'].map(key => containerText(item,key)).concat(containerText(parents.get(containerText(item,'parent_equipment_id')) || {},'name')).join(' ').toLowerCase().includes(word)))
    .sort((a,b) => Number(a.compartment_id !== container.compartment_id) - Number(b.compartment_id !== container.compartment_id) || containerText(a,'name').localeCompare(containerText(b,'name')) || containerText(a,'id').localeCompare(containerText(b,'id')));
  const pages = Math.max(1,Math.ceil(matches.length/8)), page = Math.max(1,Math.min(pages,options.page));
  return { rows: matches.slice((page-1)*8,page*8), total: matches.length, page, pages };
}
