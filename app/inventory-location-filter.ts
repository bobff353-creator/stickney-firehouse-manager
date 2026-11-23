type Row = Record<string, unknown>;
const text = (value: unknown) => value == null ? '' : String(value);
const containerTypes = new Set(['bag', 'kit', 'toolbox', 'container']);

/** Scope choices by saved IDs, never by potentially duplicated display names. */
export function inventoryLocationFilter<T extends Row>(equipment:T[], compartments:Row[], rigId:string, selection:{rigId:string;locationId:string;containerId:string}) {
  const items=equipment.filter(item=>text(item.apparatus_id)===rigId&&!item.retired_at);
  const locations=compartments.filter(row=>text(row.apparatus_id)===rigId).map(row=>({id:text(row.id),label:text(row.label)||'Unnamed location'}));
  // Keep orphaned location IDs reachable rather than hiding saved equipment.
  for(const item of items)if(item.compartment_id&&!locations.some(row=>row.id===text(item.compartment_id)))locations.push({id:text(item.compartment_id),label:text(item.compartment_label)||'Saved location (not configured)'});
  locations.sort((a,b)=>a.label.localeCompare(b.label,undefined,{numeric:true}));
  const requested=selection.rigId===rigId?selection.locationId:'';
  const locationId=requested==='unassigned'||locations.some(row=>row.id===requested)?requested:'';
  const inLocation=items.filter(item=>!locationId||(locationId==='unassigned'?!item.compartment_id:text(item.compartment_id)===locationId));
  const containers=locationId?inLocation.filter(item=>containerTypes.has(text(item.item_type))).sort((a,b)=>text(a.name).localeCompare(text(b.name),undefined,{numeric:true})):[];
  const containerId=locationId&&(selection.containerId==='loose'||containers.some(item=>text(item.id)===selection.containerId))?selection.containerId:'';
  return {locations,locationId,containers,containerId,hasUnassigned:items.some(item=>!item.compartment_id),items:inLocation.filter(item=>!containerId||(containerId==='loose'?!item.parent_equipment_id:text(item.id)===containerId||text(item.parent_equipment_id)===containerId))};
}
