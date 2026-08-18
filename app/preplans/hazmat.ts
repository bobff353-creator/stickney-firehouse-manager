// Structured HazMat record domain logic (Preplan 2.0).
// Pure functions only — no database access, no external network calls.
//
// IMPORTANT — no fabricated safety data: this module never invents an
// evacuation/isolation distance, and never guesses at an ERG guide number.
// A record must either name its ERG guide/UN-NA number as manually verified
// entered data, or leave those fields blank pending manual entry. There is
// no automated "official" data source wired up in this slice — see the
// module-level note in app/preplans/hazmat-erg.ts (not yet built) for what a
// real ERG dataset integration would require: a documented PHMSA source,
// a version-stamped import script, and a manual-entry fallback that always
// stays available.

export type PhysicalState = "solid" | "liquid" | "gas" | "cryogenic" | "unknown";
export type ContainerType =
  | "cylinder" | "drum" | "tote" | "tank" | "cartridge" | "pipeline" | "bag" | "other";

export type Nfpa704Rating = 0 | 1 | 2 | 3 | 4;
export type Nfpa704SpecialHazard = "" | "OX" | "W" | "SA" | "COR" | "ACID" | "ALK" | "BIO" | "RA" | "CRY";

export type HazmatRecord = {
  id: string;
  preplanId: string;
  levelId: string | null;
  mapped: boolean;
  chemicalName: string;
  unNaNumber: string;
  ergGuideNumber: string;
  quantity: number | null;
  quantityUnit: string;
  containerType: ContainerType;
  physicalState: PhysicalState;
  exactLocation: string;
  nfpaHealth: Nfpa704Rating;
  nfpaFlammability: Nfpa704Rating;
  nfpaInstability: Nfpa704Rating;
  nfpaSpecial: Nfpa704SpecialHazard;
  sdsAssetId: string | null;
  photoAssetId: string | null;
  dateVerified: string | null;
  verifiedBy: string;
  effectiveAt: string | null;
  expiresAt: string | null;
  notes: string;
  createdBy: string;
  createdAt?: string;
  updatedBy: string;
  updatedAt?: string;
};

export function isValidNfpaRating(value: number): value is Nfpa704Rating {
  return Number.isInteger(value) && value >= 0 && value <= 4;
}

const UN_NA_PATTERN = /^(UN|NA)\d{4}$/i;

/** UN/NA numbers are always a 4-digit code prefixed with UN or NA (e.g. UN1017, NA9191). */
export function isValidUnNaNumber(value: string): boolean {
  return UN_NA_PATTERN.test(value.trim());
}

export function normalizeUnNaNumber(value: string): string {
  const trimmed = value.trim().toUpperCase().replace(/\s+/g, "");
  return isValidUnNaNumber(trimmed) ? trimmed : trimmed;
}

/** A record needs re-verification once its verification date is older than the given window (default 1 year). */
export function isVerificationStale(dateVerified: string | null, now: Date = new Date(), maxAgeDays = 365): boolean {
  if (!dateVerified) return true;
  const verified = new Date(dateVerified);
  if (Number.isNaN(verified.getTime())) return true;
  const ageMs = now.getTime() - verified.getTime();
  return ageMs > maxAgeDays * 24 * 60 * 60 * 1000;
}

/** The highest NFPA 704 rating across health/flammability/instability — used to flag the most severe records first. */
export function highestNfpaRating(record: Pick<HazmatRecord, "nfpaHealth" | "nfpaFlammability" | "nfpaInstability">): Nfpa704Rating {
  return Math.max(record.nfpaHealth, record.nfpaFlammability, record.nfpaInstability) as Nfpa704Rating;
}

export function sortHazmatBySeverity<T extends Pick<HazmatRecord, "nfpaHealth" | "nfpaFlammability" | "nfpaInstability">>(records: T[]): T[] {
  return [...records].sort((a, b) => highestNfpaRating(b) - highestNfpaRating(a));
}

const CONTAINER_LABELS: Record<ContainerType, string> = {
  cylinder: "Cylinder", drum: "Drum", tote: "Tote", tank: "Tank",
  cartridge: "Cartridge", pipeline: "Pipeline", bag: "Bag", other: "Other",
};
export function containerLabel(type: ContainerType): string {
  return CONTAINER_LABELS[type] ?? type;
}

const PHYSICAL_STATE_LABELS: Record<PhysicalState, string> = {
  solid: "Solid", liquid: "Liquid", gas: "Gas", cryogenic: "Cryogenic", unknown: "Unknown",
};
export function physicalStateLabel(state: PhysicalState): string {
  return PHYSICAL_STATE_LABELS[state] ?? state;
}

/**
 * A one-line operational summary for lists/quick-view panels — deliberately
 * plain text, no inferred hazard distance, no editorializing.
 */
export function hazmatSummaryLine(record: Pick<HazmatRecord, "unNaNumber" | "ergGuideNumber" | "quantity" | "quantityUnit" | "containerType">): string {
  const parts: string[] = [];
  if (record.unNaNumber) parts.push(record.unNaNumber);
  if (record.ergGuideNumber) parts.push(`ERG ${record.ergGuideNumber}`);
  if (record.quantity != null) parts.push(`${record.quantity} ${record.quantityUnit || ""}`.trim());
  parts.push(containerLabel(record.containerType));
  return parts.join(" · ");
}
