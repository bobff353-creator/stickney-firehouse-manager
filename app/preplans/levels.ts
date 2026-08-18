// Preplan operational levels/layers domain logic (Preplan 2.0).
// Pure functions only — no database access — so this stays independently testable.

export type LevelLayerType =
  | "arrival"
  | "floor"
  | "basement"
  | "roof"
  | "fire_protection"
  | "hazmat"
  | "iap"
  | "water_supply"
  | "technical_rescue"
  | "custom";

export type LevelGrade = "above_grade" | "below_grade" | "grade" | "n/a";

export type PreplanLevel = {
  id: string;
  preplanId: string;
  name: string;
  shortLabel: string;
  layerType: LevelLayerType;
  floorIndex: number;
  grade: LevelGrade;
  sortOrder: number;
  isDefault: boolean;
  respondVisible: boolean;
  hidden: boolean;
  backgroundType: "none" | "image" | "pdf";
  backgroundAssetKey: string | null;
  backgroundTransform: string; // JSON string: { rotationDeg, scale, offsetX, offsetY, opacity }
  createdBy: string;
  createdAt?: string;
  updatedBy: string;
  updatedAt?: string;
};

export const ARRIVAL_LEVEL_LAYER_TYPE: LevelLayerType = "arrival";
export const ARRIVAL_LEVEL_NAME = "Arrival / Ground";
export const ARRIVAL_LEVEL_SHORT_LABEL = "ARRIVAL";

/** The Arrival/Ground level every preplan must have. Cannot be permanently deleted. */
export function arrivalLevelDefaults(preplanId: string, actor: string, id: string): PreplanLevel {
  return {
    id,
    preplanId,
    name: ARRIVAL_LEVEL_NAME,
    shortLabel: ARRIVAL_LEVEL_SHORT_LABEL,
    layerType: ARRIVAL_LEVEL_LAYER_TYPE,
    floorIndex: 0,
    grade: "grade",
    sortOrder: 0,
    isDefault: true,
    respondVisible: true,
    hidden: false,
    backgroundType: "none",
    backgroundAssetKey: null,
    backgroundTransform: "{}",
    createdBy: actor,
    updatedBy: actor,
  };
}

export function isArrivalLevel(level: Pick<PreplanLevel, "layerType">): boolean {
  return level.layerType === ARRIVAL_LEVEL_LAYER_TYPE;
}

/** Arrival levels are permanent: block delete/archive attempts on them. */
export function canDeleteLevel(level: Pick<PreplanLevel, "layerType" | "isDefault">): boolean {
  return !isArrivalLevel(level) && !level.isDefault;
}

/** Reorders levels, always pinning the Arrival level to sortOrder 0. */
export function reorderLevels<T extends Pick<PreplanLevel, "id" | "layerType">>(
  levels: T[],
  orderedIds: string[],
): T[] {
  const arrival = levels.filter(isArrivalLevel);
  const rest = levels.filter((level) => !isArrivalLevel(level));
  const byId = new Map(rest.map((level) => [level.id, level] as const));
  const reordered = orderedIds
    .filter((id) => byId.has(id))
    .map((id) => byId.get(id)!);
  for (const level of rest) if (!reordered.includes(level)) reordered.push(level);
  return [...arrival, ...reordered];
}

export function nextSortOrder(existing: Pick<PreplanLevel, "sortOrder">[]): number {
  return existing.reduce((max, level) => Math.max(max, level.sortOrder), -1) + 1;
}

const LAYER_TYPE_LABELS: Record<LevelLayerType, string> = {
  arrival: "Arrival / Ground",
  floor: "Floor",
  basement: "Basement",
  roof: "Roof",
  fire_protection: "Fire Protection",
  hazmat: "HazMat",
  iap: "Incident Action Plan",
  water_supply: "Water Supply",
  technical_rescue: "Technical Rescue",
  custom: "Custom",
};

export function layerTypeLabel(layerType: LevelLayerType): string {
  return LAYER_TYPE_LABELS[layerType] ?? layerType;
}

export function duplicateLevel(
  source: PreplanLevel,
  newId: string,
  actor: string,
  sortOrder: number,
): PreplanLevel {
  return {
    ...source,
    id: newId,
    name: `${source.name} (Copy)`,
    isDefault: false,
    sortOrder,
    createdBy: actor,
    updatedBy: actor,
    createdAt: undefined,
    updatedAt: undefined,
  };
}
