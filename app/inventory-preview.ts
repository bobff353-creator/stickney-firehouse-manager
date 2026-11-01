type InventoryRow = Record<string, string | number | boolean | string[] | null>;

/** Saved template only. Preview IDs are never persisted or used to start checks. */
export function inventoryPreviewItems(equipment: InventoryRow[], compartments: InventoryRow[], apparatusId: string, checkType: string): InventoryRow[] {
  const locations = new Map(compartments.map(row => [String(row.id), row]));
  return equipment.filter(row => row.apparatus_id === apparatusId && !row.retired_at && Array.isArray(row.check_types) && row.check_types.includes(checkType))
    .sort((a,b) => Number(locations.get(String(a.compartment_id))?.sort_order ?? Number.MAX_SAFE_INTEGER) - Number(locations.get(String(b.compartment_id))?.sort_order ?? Number.MAX_SAFE_INTEGER)
      || String(locations.get(String(a.compartment_id))?.label ?? '').localeCompare(String(locations.get(String(b.compartment_id))?.label ?? ''), undefined, {numeric:true})
      || Number(a.item_order ?? 0) - Number(b.item_order ?? 0))
    .map(row => ({...row, id:`preview-${row.id}`, equipment_id:row.id, equipment_name:row.name, compartment_label:locations.get(String(row.compartment_id))?.label ?? 'Location not assigned', result:'pending', numeric_reading:null, checked_by:null, checked_at:null,
      drug_schema:checkType==='drug'||row.response_type==='medication'?JSON.stringify({version:1,title:row.name,mode:row.response_type||'pass_fail',expectedQuantity:Number(row.quantity_required||1),location:[row.apparatus_name,locations.get(String(row.compartment_id))?.label].filter(Boolean).join(' · ')}):null,
    }));
}
