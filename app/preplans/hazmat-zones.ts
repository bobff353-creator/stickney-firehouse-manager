// HazMat isolation/evacuation zone domain logic (Preplan 2.0).
// Pure functions only — no database access.
//
// IMPORTANT — no fabricated safety distances: this module never suggests a
// radius. It only validates and labels zones an authorized user entered
// themselves (a fixed preset like 100/300/500/1000 ft, or a custom value).
// Automatically recommending an isolation distance would require verified
// official data and the incident's specific variables (wind, quantity,
// release type, etc.) — neither of which this system has, so it must never
// guess. See app/preplans/hazmat.ts for the same rule applied to ERG data.

export type ZoneType = "hot" | "warm" | "cold" | "isolation" | "evacuation" | "custom";
export type ZoneShape = "circle" | "polygon";

export type HazmatZonePoint = { lat: number; lng: number };

export type HazmatZone = {
  id: string;
  preplanId: string;
  levelId: string | null;
  hazmatId: string | null;
  zoneType: ZoneType;
  shape: ZoneShape;
  label: string;
  centerLat: number | null;
  centerLng: number | null;
  radiusFeet: number | null;
  polygon: HazmatZonePoint[];
  lineColor: string;
  lineWidth: number;
  lineStyle: "solid" | "dashed";
  fillOpacity: number;
  effectiveAt: string | null;
  expiresAt: string | null;
  createdBy: string;
  createdAt?: string;
  updatedBy: string;
  updatedAt?: string;
};

/** Common presets an editor can pick instead of typing a number — never a suggestion, just a shortcut for a value they choose. */
export const RADIUS_PRESETS_FEET = [100, 300, 500, 1000] as const;

const MAX_REASONABLE_RADIUS_FEET = 50_000; // ~9.5 miles — a generous sanity ceiling, not an operational limit

export function isValidRadius(feet: number): boolean {
  return Number.isFinite(feet) && feet > 0 && feet <= MAX_REASONABLE_RADIUS_FEET;
}

export function isValidCircleZone(zone: Pick<HazmatZone, "shape" | "centerLat" | "centerLng" | "radiusFeet">): boolean {
  if (zone.shape !== "circle") return false;
  if (zone.centerLat == null || zone.centerLng == null) return false;
  if (zone.centerLat < -90 || zone.centerLat > 90 || zone.centerLng < -180 || zone.centerLng > 180) return false;
  return zone.radiusFeet != null && isValidRadius(zone.radiusFeet);
}

const MAX_POLYGON_POINTS = 200;

export function isValidPolygonZone(zone: Pick<HazmatZone, "shape" | "polygon">): boolean {
  if (zone.shape !== "polygon") return false;
  if (zone.polygon.length < 3 || zone.polygon.length > MAX_POLYGON_POINTS) return false;
  return zone.polygon.every((point) => point.lat >= -90 && point.lat <= 90 && point.lng >= -180 && point.lng <= 180);
}

export function isValidZoneGeometry(zone: Pick<HazmatZone, "shape" | "centerLat" | "centerLng" | "radiusFeet" | "polygon">): boolean {
  return zone.shape === "circle" ? isValidCircleZone(zone) : isValidPolygonZone(zone);
}

const ZONE_TYPE_LABELS: Record<ZoneType, string> = {
  hot: "Hot Zone",
  warm: "Warm Zone",
  cold: "Cold Zone",
  isolation: "Isolation Zone",
  evacuation: "Evacuation Zone",
  custom: "Custom Zone",
};
export function zoneTypeLabel(zoneType: ZoneType): string {
  return ZONE_TYPE_LABELS[zoneType] ?? zoneType;
}

/** Most restrictive zones (hot) sort first for operational display. */
const ZONE_SEVERITY_RANK: Record<ZoneType, number> = { hot: 0, isolation: 1, warm: 2, evacuation: 3, cold: 4, custom: 5 };
export function sortZonesBySeverity<T extends Pick<HazmatZone, "zoneType">>(zones: T[]): T[] {
  return [...zones].sort((a, b) => ZONE_SEVERITY_RANK[a.zoneType] - ZONE_SEVERITY_RANK[b.zoneType]);
}

export function zoneDistanceLabel(zone: Pick<HazmatZone, "shape" | "radiusFeet">): string {
  if (zone.shape === "circle" && zone.radiusFeet != null) return `${zone.radiusFeet.toLocaleString()} ft radius`;
  return "Custom outline";
}
