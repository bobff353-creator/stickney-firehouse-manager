export type GeoPoint = { latitude: number; longitude: number };

const suffixes: Record<string, string> = {
  street: "st", avenue: "ave", road: "rd", boulevard: "blvd", drive: "dr",
  lane: "ln", court: "ct", parkway: "pkwy", highway: "hwy", place: "pl",
  terrace: "ter", circle: "cir",
};

export function normalizeResponseAddress(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(north|south|east|west)\b/g, (word) => word[0])
    .replace(/\b(street|avenue|road|boulevard|drive|lane|court|parkway|highway|place|terrace|circle)\b/g, (word) => suffixes[word] ?? word)
    .replace(/\b(?:apt|apartment|suite|unit|#)\s*[\w-]+.*$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function distanceFeet(a: GeoPoint, b: GeoPoint) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 20_902_231 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function rankPreplanMatch<T extends GeoPoint & { address: string }>(
  call: { address: string; latitude?: number | null; longitude?: number | null },
  plans: T[],
) {
  const callAddress = normalizeResponseAddress(call.address);
  const exact = callAddress ? plans.find((plan) => normalizeResponseAddress(plan.address) === callAddress) : undefined;
  if (exact) return { plan: exact, method: "address" as const, distanceFeet: 0 };

  const callPoint = Number.isFinite(call.latitude) && Number.isFinite(call.longitude)
    ? { latitude: Number(call.latitude), longitude: Number(call.longitude) }
    : null;
  if (!callPoint) return null;
  const nearest = plans
    .map((plan) => ({ plan, distanceFeet: distanceFeet(callPoint, plan) }))
    .sort((a, b) => a.distanceFeet - b.distanceFeet)[0];
  return nearest && nearest.distanceFeet <= 500
    ? { ...nearest, method: "gps" as const }
    : null;
}
