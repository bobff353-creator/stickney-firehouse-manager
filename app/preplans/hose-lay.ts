// Hose-lay planning domain logic (Preplan 2.0).
// Pure functions only — no database access.
//
// Scenario D from the spec: a source hydrant, a multi-segment measured
// route, a configured reserve, and a comparison against verified apparatus
// hose capacity — with missing inventory reported as "not verified", never
// silently treated as zero.

export type HoseLaySegment = { fromLat: number; fromLng: number; toLat: number; toLng: number };

export type HoseLayPlan = {
  id: string;
  preplanId: string;
  levelId: string | null;
  sourceHydrantId: string | null;
  destinationLat: number | null;
  destinationLng: number | null;
  destinationSide: string;
  destinationFeatureId: string | null;
  segments: HoseLaySegment[];
  hoseSizeInches: number;
  sectionLengthFeet: number;
  reserveFeet: number;
  supplyLineLabel: string;
  assignedApparatusId: string | null;
  notes: string;
  createdBy: string;
  createdAt?: string;
  updatedBy: string;
  updatedAt?: string;
};

const EARTH_RADIUS_FEET = 20_902_231;

/** Geodesic distance in feet between two lat/lng points (haversine). */
export function segmentDistanceFeet(segment: HoseLaySegment): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(segment.toLat - segment.fromLat);
  const dLng = radians(segment.toLng - segment.fromLng);
  const lat1 = radians(segment.fromLat);
  const lat2 = radians(segment.toLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_FEET * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function totalDistanceFeet(segments: HoseLaySegment[]): number {
  return segments.reduce((sum, segment) => sum + segmentDistanceFeet(segment), 0);
}

/**
 * Recommended hose length: measured distance plus the configured reserve,
 * rounded UP to the nearest whole section so the crew never comes up short.
 * Example from the spec: 642 ft measured + 100 ft reserve = 742 ft needed,
 * rounded up to 800 ft at 100 ft sections.
 */
export function recommendedHoseFeet(measuredFeet: number, reserveFeet: number, sectionLengthFeet: number): number {
  if (sectionLengthFeet <= 0) return Math.ceil(measuredFeet + reserveFeet);
  const needed = measuredFeet + reserveFeet;
  return Math.ceil(needed / sectionLengthFeet) * sectionLengthFeet;
}

export type CapacityComparison =
  | { status: "sufficient"; recommendedFeet: number; availableFeet: number; deficitFeet: 0 }
  | { status: "deficit"; recommendedFeet: number; availableFeet: number; deficitFeet: number }
  | { status: "unverified"; recommendedFeet: number };

/**
 * Compares the recommended hose length against verified apparatus hose
 * inventory. Missing/stale inventory data must NEVER be treated as zero
 * capacity (which would falsely report every plan as deficient) — it is
 * reported as "unverified" instead, per the spec's explicit requirement.
 */
export function compareToApparatusCapacity(recommendedFeet: number, availableFeet: number | null | undefined): CapacityComparison {
  if (availableFeet == null || !Number.isFinite(availableFeet)) return { status: "unverified", recommendedFeet };
  if (availableFeet >= recommendedFeet) return { status: "sufficient", recommendedFeet, availableFeet, deficitFeet: 0 };
  return { status: "deficit", recommendedFeet, availableFeet, deficitFeet: recommendedFeet - availableFeet };
}

export function isValidSegments(segments: HoseLaySegment[]): boolean {
  if (!segments.length) return false;
  return segments.every((segment) =>
    Math.abs(segment.fromLat) <= 90 && Math.abs(segment.toLat) <= 90
    && Math.abs(segment.fromLng) <= 180 && Math.abs(segment.toLng) <= 180);
}

const STANDARD_HOSE_SIZES = [1.75, 2.5, 3, 4, 5] as const;
export function isValidHoseSize(inches: number): boolean {
  return (STANDARD_HOSE_SIZES as readonly number[]).includes(inches);
}
