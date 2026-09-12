/** Shared saved-check preview. Existing checklist positions remain until an admin edits them. */
export type AirRow = Record<string, string | number | boolean | string[] | null>;
export type AirCheckLine = { section: "pack" | "rit" | "spare"; label: string; slot: string; equipment_id: string | null; asset_number: string | null; location: string | null };

export function airTemplateLines(template?: AirRow): AirCheckLine[] {
  if (!template || template.active === false) return [];
  const lines: AirCheckLine[] = [];
  const add = (section: AirCheckLine["section"], label: string) => lines.push({ section, label, slot: `${section}:${label}`, equipment_id: null, asset_number: null, location: null });
  if (Array.isArray(template.pack_positions)) template.pack_positions.forEach(label => add("pack", label));
  if (template.include_rit) add("rit", "R.I.T. Bag");
  for (let index = 0; index < Number(template.spare_bottle_count || 0); index++) add("spare", `Spare #${index + 1}`);
  return lines;
}

export function airCheckLines(template: AirRow | undefined, equipment: AirRow[], apparatusId: string): AirCheckLine[] {
  const lines = airTemplateLines(template);
  const assets = equipment.filter(item => item.apparatus_id === apparatusId && item.scba_asset_kind && !item.retired_at)
    .sort((a, b) => String(a.asset_number).localeCompare(String(b.asset_number)));
  for (const asset of assets) {
    const matched = lines.find(line => line.slot === asset.scba_check_slot && !line.equipment_id);
    const label = matched?.label || String(asset.name);
    const line: AirCheckLine = {
      section: matched?.section || (asset.scba_asset_kind === "pack" ? "pack" : "spare"),
      label: `${label} · ID ${asset.asset_number}`,
      slot: matched?.slot || "", equipment_id: String(asset.id), asset_number: String(asset.asset_number),
      location: String(asset.compartment_label || ""),
    };
    if (matched) Object.assign(matched, line); else lines.push(line);
  }
  return lines;
}
