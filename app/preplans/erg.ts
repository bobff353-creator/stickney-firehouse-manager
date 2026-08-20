export const ERG_SOURCE = {
  edition: "ERG2024",
  publisher: "U.S. DOT Pipeline and Hazardous Materials Safety Administration",
  landingPage: "https://www.phmsa.dot.gov/training/hazmat/erg/emergency-response-guidebook-erg",
  publicPdf: "https://www.phmsa.dot.gov/sites/phmsa.dot.gov/files/2024-04/ERG2024-Eng-Web-a.pdf",
  effectiveDate: "2024-04-04",
} as const;

export type ErgMaterial = {
  idNumber: string;
  materialName: string;
  guideNumber: string;
  highlighted: boolean;
};

export type ErgProtectiveDistance = {
  idNumber: string;
  materialName: string;
  container: string;
  spillSize: "small" | "large";
  timeOfDay: "day" | "night";
  initialIsolationMeters: number;
  protectiveActionKilometers: number;
};

export type ErgDataset = {
  source: typeof ERG_SOURCE;
  importedAt: string;
  sourceSha256: string;
  materials: ErgMaterial[];
  protectiveDistances: ErgProtectiveDistance[];
};

export function normalizeErgId(value: string): string {
  return value.trim().toUpperCase().replace(/^(UN|NA)\s*/, "").padStart(4, "0");
}

export function lookupErgMaterial(query: string, dataset: ErgDataset): ErgMaterial[] {
  const normalizedId = normalizeErgId(query);
  const words = query.toLowerCase().trim();
  return dataset.materials.filter((material) =>
    normalizeErgId(material.idNumber) === normalizedId || material.materialName.toLowerCase().includes(words),
  ).slice(0, 25);
}

export function protectiveDistancesFor(idNumber: string, dataset: ErgDataset): ErgProtectiveDistance[] {
  const normalized = normalizeErgId(idNumber);
  return dataset.protectiveDistances.filter((row) => normalizeErgId(row.idNumber) === normalized);
}
