// Deterministic CAD narrative → level/room matching (Preplan 2.0 Respond).
// Pure functions only — no database access, no external/AI service — so
// results are testable and reproducible from CAD text alone.

import { searchableNames, type PreplanSpace } from "./spaces.ts";
import { layerTypeLabel, type LevelLayerType, type PreplanLevel } from "./levels.ts";

export type RoomMatchLevelHint = { levelId: string; layerType: LevelLayerType; name: string; floorIndex: number } | null;

export type RoomMatchResult =
  | { kind: "unique"; space: PreplanSpace; level: RoomMatchLevelHint; explanation: string }
  | { kind: "ambiguous"; candidates: { space: PreplanSpace; level: RoomMatchLevelHint }[]; explanation: string }
  | { kind: "none" };

const FLOOR_WORD_PATTERN = /\b(?:floor|fl|division|div)\.?\s*(\d{1,2})\b|\b(\d{1,2})(?:st|nd|rd|th)\s*floor\b/i;
const BASEMENT_PATTERN = /\bbasement\b/i;
const ROOF_PATTERN = /\broof\b/i;

/** Extracts a floor-related hint (number or basement/roof) from free-text CAD narrative. */
export function extractFloorHint(narrative: string): { kind: "floor"; floorIndex: number } | { kind: "basement" } | { kind: "roof" } | null {
  if (BASEMENT_PATTERN.test(narrative)) return { kind: "basement" };
  if (ROOF_PATTERN.test(narrative)) return { kind: "roof" };
  const match = narrative.match(FLOOR_WORD_PATTERN);
  if (!match) return null;
  const floorIndex = Number(match[1] ?? match[2]);
  return Number.isFinite(floorIndex) && floorIndex > 0 ? { kind: "floor", floorIndex } : null;
}

/**
 * Finds every room-like token in CAD narrative text: "Classroom 205",
 * "Room 205", "RM 205", "Rm. 205", "Suite 4", "Unit 3B". Returns normalized
 * lowercase phrases suitable for comparison against `searchableNames()`.
 */
export function extractRoomMentions(narrative: string): string[] {
  const pattern = /\b(classroom|class room|room|rm\.?|suite|unit|apartment|apt\.?)\s*#?\s*([0-9]{1,4}[a-z]?)\b/gi;
  const mentions = new Set<string>();
  for (const match of narrative.matchAll(pattern)) {
    const label = match[1].toLowerCase().replace(/\.$/, "");
    const number = match[2].toLowerCase();
    mentions.add(`${label === "class room" ? "classroom" : label} ${number}`.trim());
    mentions.add(number);
  }
  return [...mentions];
}

function levelHintFromLevel(level: Pick<PreplanLevel, "id" | "layerType" | "name" | "floorIndex">): RoomMatchLevelHint {
  return { levelId: level.id, layerType: level.layerType, name: level.name, floorIndex: level.floorIndex };
}

/**
 * Matches CAD narrative text against a preplan's rooms/spaces.
 * - Exactly one space matches a mentioned name → "unique": auto-open that level/room.
 * - Multiple spaces plausibly match → "ambiguous": present as selectable suggestions.
 * - No room text found, or found but no space matches → "none": stay on Arrival.
 * A weak floor-only hint (e.g. "second floor" with no room number) never
 * triggers a unique match on its own — it only helps rank ambiguous results.
 */
export function matchCadToRoom(
  narrative: string,
  spaces: PreplanSpace[],
  levels: PreplanLevel[],
): RoomMatchResult {
  const text = narrative ?? "";
  const mentions = extractRoomMentions(text);
  const floorHint = extractFloorHint(text);
  if (!mentions.length) return { kind: "none" };

  const levelById = new Map(levels.map((level) => [level.id, level] as const));
  const matches = spaces.filter((space) => {
    const names = searchableNames(space);
    return mentions.some((mention) => names.includes(mention));
  });

  if (!matches.length) return { kind: "none" };

  if (matches.length === 1) {
    const space = matches[0];
    const level = levelById.get(space.levelId);
    const levelHint = level ? levelHintFromLevel(level) : null;
    const levelPhrase = level ? `${layerTypeLabel(level.layerType)} — ${level.name}` : "an unpublished level";
    return {
      kind: "unique",
      space,
      level: levelHint,
      explanation: `CAD matched "${mentions[0]}" to ${levelPhrase} — ${space.displayName}.`,
    };
  }

  // Multiple rooms share the mentioned number/name (e.g. "Room 205" exists on
  // two levels) — use a floor hint to disambiguate when present, otherwise
  // surface every plausible candidate rather than guessing.
  const ranked = floorHint?.kind === "floor"
    ? matches.filter((space) => levelById.get(space.levelId)?.floorIndex === floorHint.floorIndex)
    : matches;
  const finalMatches = ranked.length ? ranked : matches;

  if (finalMatches.length === 1) {
    const space = finalMatches[0];
    const level = levelById.get(space.levelId);
    const levelHint = level ? levelHintFromLevel(level) : null;
    const levelPhrase = level ? `${layerTypeLabel(level.layerType)} — ${level.name}` : "an unpublished level";
    return {
      kind: "unique",
      space,
      level: levelHint,
      explanation: `CAD matched "${mentions[0]}" to ${levelPhrase} — ${space.displayName}.`,
    };
  }

  return {
    kind: "ambiguous",
    candidates: finalMatches.map((space) => {
      const level = levelById.get(space.levelId);
      return { space, level: level ? levelHintFromLevel(level) : null };
    }),
    explanation: `CAD narrative mentions "${mentions[0]}", which matches ${finalMatches.length} rooms. Select the correct one.`,
  };
}
