// Transparent target-hazard / risk-assessment domain logic (Preplan 2.0).
// Pure functions only — no database access, no black-box scoring: every
// number here traces back to a named factor with a stored explanation, and
// an authorized officer can always override the computed classification.

export type RiskFactorKey =
  | "life_hazard" | "special_population" | "construction" | "building_size"
  | "fire_load" | "hazmat" | "access" | "water_supply" | "fire_protection"
  | "prior_incidents" | "vacancy_dangerous" | "below_grade" | "operational_complexity";

export type RiskScore = 0 | 1 | 2 | 3 | 4;

export type RiskFactor = {
  id: string;
  preplanId: string;
  factorKey: RiskFactorKey;
  score: RiskScore;
  explanation: string;
  source: string;
  createdBy: string;
  createdAt?: string;
  updatedBy: string;
  updatedAt?: string;
};

export type RiskClassification = "low" | "moderate" | "high" | "critical";

const FACTOR_LABELS: Record<RiskFactorKey, string> = {
  life_hazard: "Life Hazard",
  special_population: "Special Population",
  construction: "Building Construction",
  building_size: "Building Size",
  fire_load: "Fire Load",
  hazmat: "HazMat Present",
  access: "Access",
  water_supply: "Water Supply",
  fire_protection: "Fire Protection",
  prior_incidents: "Prior Incident History",
  vacancy_dangerous: "Vacancy / Dangerous Building",
  below_grade: "Below-Grade Hazards",
  operational_complexity: "Operational Complexity",
};

export function riskFactorLabel(key: RiskFactorKey): string {
  return FACTOR_LABELS[key] ?? key;
}

export function isValidRiskScore(value: number): value is RiskScore {
  return Number.isInteger(value) && value >= 0 && value <= 4;
}

/** Sum of every recorded factor's score — the transparent basis for classification, never hidden. */
export function totalRiskScore(factors: Pick<RiskFactor, "score">[]): number {
  return factors.reduce((sum, factor) => sum + factor.score, 0);
}

const MAX_SCORE_PER_FACTOR = 4;

/**
 * Classification thresholds as a percentage of the maximum possible score
 * across whatever factors have actually been recorded (an incomplete
 * assessment is scored against its own recorded factors, not a fixed count,
 * so a building with only 2 factors entered isn't unfairly diluted).
 */
export function classifyRisk(factors: Pick<RiskFactor, "score">[]): RiskClassification {
  if (!factors.length) return "low";
  const maxPossible = factors.length * MAX_SCORE_PER_FACTOR;
  const percent = totalRiskScore(factors) / maxPossible;
  if (percent >= 0.75) return "critical";
  if (percent >= 0.5) return "high";
  if (percent >= 0.25) return "moderate";
  return "low";
}

const CLASSIFICATION_LABELS: Record<RiskClassification, string> = {
  low: "Low", moderate: "Moderate", high: "High", critical: "Critical",
};
export function classificationLabel(classification: RiskClassification): string {
  return CLASSIFICATION_LABELS[classification] ?? classification;
}

export type RiskOverride = {
  classification: RiskClassification;
  reviewedBy: string;
  reviewedAt: string;
};

/**
 * The classification Respond should actually display: a manual override by
 * an authorized reviewer always wins over the computed value — an officer's
 * judgment about a specific building outranks the formula, per the spec's
 * "authorized officer can manually override" requirement.
 */
export function effectiveClassification(factors: Pick<RiskFactor, "score">[], override: RiskOverride | null): RiskClassification {
  return override?.classification ?? classifyRisk(factors);
}

/**
 * A target-hazard designation always needs at least one stated reason —
 * Respond must show reasons, not an unexplained flag (per the spec:
 * "without forcing users to interpret an unexplained number").
 */
export function isValidTargetHazardDesignation(reasons: string[]): boolean {
  return reasons.some((reason) => reason.trim().length > 0);
}

export function sortFactorsBySeverity<T extends Pick<RiskFactor, "score">>(factors: T[]): T[] {
  return [...factors].sort((a, b) => b.score - a.score);
}
