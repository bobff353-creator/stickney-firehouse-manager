// Secure preplan attachment domain logic (Preplan 2.0).
// Pure functions only — no database access, no storage access.
//
// Security requirement this module exists to satisfy: never trust a
// filename extension or a browser-supplied Content-Type header alone.
// verifyFileSignature() inspects the actual file bytes (magic numbers)
// against the declared MIME type, so a renamed .exe can't masquerade as a
// .jpg. Only JPG, PNG, WebP, and PDF are ever accepted — no HTML/SVG
// (script-executable formats), matching the spec's explicit prohibition.

export type AssetCategory =
  | "exterior_photo" | "feature_photo" | "feature_location_overview"
  | "interior_floor_plan" | "sprinkler_plan" | "fire_alarm_map" | "hose_lay_plan"
  | "sds" | "emergency_action_plan" | "evacuation_plan" | "elevator_instructions"
  | "inspection_document" | "general_operational_attachment";

export type PreplanAsset = {
  id: string;
  preplanId: string;
  featureId: string | null;
  hazmatId: string | null;
  levelId: string | null;
  category: AssetCategory;
  originalFilename: string;
  objectKey: string;
  mimeType: string;
  fileSizeBytes: number;
  caption: string;
  description: string;
  sortOrder: number;
  pinToRespond: boolean;
  version: number;
  archived: boolean;
  createdBy: string;
  createdAt?: string;
  updatedBy: string;
  updatedAt?: string;
};

const CATEGORY_LABELS: Record<AssetCategory, string> = {
  exterior_photo: "Exterior Photo",
  feature_photo: "Feature Photo",
  feature_location_overview: "Feature Location Overview",
  interior_floor_plan: "Interior Floor Plan",
  sprinkler_plan: "Sprinkler Plan",
  fire_alarm_map: "Fire Alarm Map",
  hose_lay_plan: "Hose-Lay Plan",
  sds: "SDS",
  emergency_action_plan: "Emergency Action Plan",
  evacuation_plan: "Evacuation Plan",
  elevator_instructions: "Elevator Instructions",
  inspection_document: "Inspection Document",
  general_operational_attachment: "General Operational Attachment",
};
export function assetCategoryLabel(category: AssetCategory): string {
  return CATEGORY_LABELS[category] ?? category;
}

export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export function isAllowedMimeType(mimeType: string): mimeType is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

export const MAX_ASSET_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export function isValidAssetSize(sizeBytes: number): boolean {
  return Number.isFinite(sizeBytes) && sizeBytes > 0 && sizeBytes <= MAX_ASSET_SIZE_BYTES;
}

const SIGNATURES: { mime: AllowedMimeType; check: (bytes: Uint8Array) => boolean }[] = [
  { mime: "image/jpeg", check: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", check: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  {
    mime: "image/webp",
    check: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
      && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
  { mime: "application/pdf", check: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 },
];

/**
 * Verifies the first bytes of a file match the actual signature for the
 * declared MIME type — the server-side check the spec requires so a
 * malicious upload can't rely on a spoofed Content-Type or a renamed
 * extension to get past the allowlist.
 */
export function verifyFileSignature(declaredMimeType: string, headerBytes: Uint8Array): boolean {
  const signature = SIGNATURES.find((entry) => entry.mime === declaredMimeType);
  if (!signature) return false;
  return signature.check(headerBytes);
}

/** Strips path separators and anything but safe filename characters, so a stored key can never escape its prefix. */
export function safeFilename(originalName: string, fallback = "attachment"): string {
  const base = originalName.split(/[/\\]/).pop() ?? "";
  const cleaned = base.replace(/[^\w.\- ]/g, "_").trim().slice(0, 140);
  return cleaned || fallback;
}

export function sortAssetsForDisplay<T extends Pick<PreplanAsset, "pinToRespond" | "sortOrder">>(assets: T[]): T[] {
  return [...assets].sort((a, b) => Number(b.pinToRespond) - Number(a.pinToRespond) || a.sortOrder - b.sortOrder);
}
