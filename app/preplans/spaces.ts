// Interior building-space (room) domain logic (Preplan 2.0).
// Pure functions only — no database access — so this stays independently testable.

export type SpaceType =
  | "room"
  | "classroom"
  | "office"
  | "stairway"
  | "elevator_lobby"
  | "corridor"
  | "mechanical"
  | "electrical"
  | "boiler_room"
  | "sprinkler_room"
  | "storage"
  | "gymnasium"
  | "roof_access"
  | "basement"
  | "other";

export type NormalizedPoint = { x: number; y: number }; // normalized 0..1 floor-plan coordinates

export type PreplanSpace = {
  id: string;
  preplanId: string;
  levelId: string;
  displayName: string;
  roomNumber: string;
  spaceType: SpaceType;
  aliases: string[];
  cadKeywords: string[];
  geometry: NormalizedPoint[]; // polygon/rectangle in normalized floor-plan coordinates
  labelPosition: NormalizedPoint | null;
  typicalOccupancy: number | null;
  peakOccupancy: number | null;
  specialPopulationNotes: string;
  accessNotes: string;
  fireProtectionNotes: string;
  hazards: string;
  createdBy: string;
  createdAt?: string;
  updatedBy: string;
  updatedAt?: string;
};

/** Splits a comma/semicolon/newline separated alias field into normalized, deduped tokens. */
export function parseAliasList(raw: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of raw.split(/[,;\n]/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

/**
 * Every name a room can be found by for CAD matching: display name, room
 * number, explicit aliases, and derived variants ("Room 205", "RM 205",
 * "Rm. 205", "Classroom 205" all point at the same space). Deterministic —
 * no AI/external service involved, per the requirement that matching be
 * testable and dependency-free.
 */
export function searchableNames(space: Pick<PreplanSpace, "displayName" | "roomNumber" | "aliases" | "cadKeywords">): string[] {
  const names = new Set<string>();
  const add = (value: string) => {
    const trimmed = value.trim();
    if (trimmed) names.add(trimmed.toLowerCase());
  };
  add(space.displayName);
  for (const alias of space.aliases) add(alias);
  for (const keyword of space.cadKeywords) add(keyword);
  if (space.roomNumber) {
    const number = space.roomNumber.trim();
    add(number);
    add(`room ${number}`);
    add(`rm ${number}`);
    add(`rm. ${number}`);
    add(`classroom ${number}`);
    add(`suite ${number}`);
    add(`unit ${number}`);
  }
  return [...names];
}

const MINIMUM_POLYGON_POINTS = 3;

export function isValidGeometry(geometry: NormalizedPoint[]): boolean {
  if (geometry.length < MINIMUM_POLYGON_POINTS) return false;
  return geometry.every((point) => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1);
}

/** Centroid used for default label placement when none is set explicitly. */
export function polygonCentroid(geometry: NormalizedPoint[]): NormalizedPoint | null {
  if (!geometry.length) return null;
  const sum = geometry.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / geometry.length, y: sum.y / geometry.length };
}

const SPACE_TYPE_LABELS: Record<SpaceType, string> = {
  room: "Room",
  classroom: "Classroom",
  office: "Office",
  stairway: "Stairway",
  elevator_lobby: "Elevator Lobby",
  corridor: "Corridor",
  mechanical: "Mechanical Room",
  electrical: "Electrical Room",
  boiler_room: "Boiler Room",
  sprinkler_room: "Sprinkler Room",
  storage: "Storage",
  gymnasium: "Gymnasium",
  roof_access: "Roof Access",
  basement: "Basement Storage",
  other: "Other",
};

export function spaceTypeLabel(spaceType: SpaceType): string {
  return SPACE_TYPE_LABELS[spaceType] ?? spaceType;
}
