export type GeoPoint = { latitude: number; longitude: number };

const RIDGELAND_AVENUE_LONGITUDE = -87.7832;

function ridgelandSide(longitude: number | null | undefined, address: string) {
  if (Number.isFinite(longitude)) return Number(longitude) > RIDGELAND_AVENUE_LONGITUDE ? "e" : "w";
  if (/\bridgeland\b/i.test(address)) return null;
  const westGrid = address.match(/^\s*(\d{3,5})\s+(?:w(?:est)?\.?\s+)?/i);
  if (!westGrid) return null;
  return Number(westGrid[1]) < 6400 ? "e" : "w";
}

export function suggestedStickneyBoxCard(input: { callType?: unknown; category?: unknown; address?: unknown; longitude?: unknown }) {
  const incident = `${String(input.callType || "")} ${String(input.category || "")}`.toLowerCase();
  const address = String(input.address || "");
  const longitude = input.longitude == null ? null : Number(input.longitude);
  const isVehicleAccident = /\b(mva|mvc|vehicle accident|motor vehicle|traffic (?:accident|crash|collision)|car (?:accident|crash)|extrication|pin[ -]?in)\b/.test(incident);
  const isEms = /\b(ems|ambulance|mci|asher|medical|cardiac|chest pain|difficulty breathing|sick person|overdose|seizure|unconscious|diabetic|psychiatric|lift assist|patient)\b/.test(incident);
  const isFire = /\b(fire|smoke|alarm|burning|structure|appliance|electrical|gas leak|hazardous condition)\b/.test(incident);

  if (isVehicleAccident) {
    const side = ridgelandSide(longitude, address);
    return side ? `sfd-box-303-${side}` : null;
  }
  if (isEms) return "sfd-box-399";
  if (isFire) {
    const side = ridgelandSide(longitude, address);
    return side ? `sfd-box-300-${side}` : null;
  }
  return null;
}

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
