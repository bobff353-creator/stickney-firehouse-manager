export const PREPLAN_PUBLICATION_STATUSES = ["draft", "in_review", "published", "archived"] as const;
export const PREPLAN_LEVEL_TYPES = ["arrival", "floor", "roof", "mezzanine", "basement", "site"] as const;
export const PREPLAN_SEVERITIES = ["informational", "caution", "warning", "critical"] as const;
export const PREPLAN_EXPIRATION_ACTIONS = ["hide", "mark_expired", "require_verification"] as const;

export type PublicationStatus = (typeof PREPLAN_PUBLICATION_STATUSES)[number];
export type PreplanSeverity = (typeof PREPLAN_SEVERITIES)[number];
export type ExpirationAction = (typeof PREPLAN_EXPIRATION_ACTIONS)[number];

export type Point = { lat: number; lng: number };
export type PlanPoint = { x: number; y: number };

export type LifecycleRecord = {
  effectiveAt?: string | null;
  expiresAt?: string | null;
  expirationAction?: ExpirationAction;
  verifiedAt?: string | null;
};

export type LifecycleState = "scheduled" | "active" | "expiring" | "expired";

export function lifecycleState(record: LifecycleRecord, now = new Date(), warningDays = 30): LifecycleState {
  const effective = parseInstant(record.effectiveAt);
  const expires = parseInstant(record.expiresAt);
  if (effective && effective.getTime() > now.getTime()) return "scheduled";
  if (!expires) return "active";
  if (expires.getTime() <= now.getTime()) return "expired";
  const warningAt = expires.getTime() - warningDays * 86_400_000;
  return now.getTime() >= warningAt ? "expiring" : "active";
}

export function isOperationallyVisible(record: LifecycleRecord, now = new Date()): boolean {
  const state = lifecycleState(record, now);
  return state !== "scheduled" && !(state === "expired" && record.expirationAction === "hide");
}

function parseInstant(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value.trim() === "") return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function normalizedLevelLabel(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) throw new Error("Level name is required");
  return trimmed.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);
}

export function assertNormalizedPlanPoint(point: PlanPoint): PlanPoint {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
    throw new Error("Plan coordinates must be normalized between 0 and 1");
  }
  return point;
}

export function polygonAreaSquareFeet(points: Point[]): number {
  if (points.length < 3) return 0;
  const meanLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const feetPerLat = 364_000;
  const feetPerLng = Math.cos(meanLat * Math.PI / 180) * 288_200;
  const projected = points.map((point) => ({ x: point.lng * feetPerLng, y: point.lat * feetPerLat }));
  const twiceArea = projected.reduce((sum, point, index) => {
    const next = projected[(index + 1) % projected.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0);
  return Math.abs(twiceArea) / 2;
}

export type HoseLayInput = {
  totalDistanceFeet: number;
  sectionLengthFeet: number;
  reserveFeet: number;
  apparatusCapacityFeet?: number | null;
};

export type HoseLayResult = {
  workingFeet: number;
  sections: number;
  recommendedFeet: number;
  withinApparatusCapacity: boolean | null;
};

export function calculateHoseLay(input: HoseLayInput): HoseLayResult {
  if (input.totalDistanceFeet < 0 || input.sectionLengthFeet <= 0 || input.reserveFeet < 0) throw new Error("Invalid hose-lay inputs");
  const workingFeet = input.totalDistanceFeet + input.reserveFeet;
  const sections = Math.ceil(workingFeet / input.sectionLengthFeet);
  const recommendedFeet = sections * input.sectionLengthFeet;
  return {
    workingFeet,
    sections,
    recommendedFeet,
    withinApparatusCapacity: input.apparatusCapacityFeet == null ? null : recommendedFeet <= input.apparatusCapacityFeet,
  };
}

export type RiskFactor = { factor: string; score: number; explanation: string; source: string; manualOverride?: boolean };

export function calculateTargetHazard(factors: RiskFactor[], override = 0) {
  const score = Math.max(0, Math.min(100, factors.reduce((sum, item) => sum + Math.max(-100, Math.min(100, item.score)), 0) + override));
  const level = score >= 75 ? "critical" : score >= 50 ? "high" : score >= 25 ? "moderate" : "low";
  return { score, level, reasons: factors.filter((item) => item.score !== 0).map((item) => `${item.factor}: ${item.explanation}`) };
}

export type FireAreaDemand = { id:string; name:string; codeFireFlowGpm:number; sprinklerDemandGpm?:number|null; hoseAllowanceGpm?:number|null; separationVerified:boolean };

export function calculateControllingFireFlow(areas:FireAreaDemand[]){
  if(!areas.length)return {controllingGpm:0,controllingAreaId:null,areas:[],warnings:["No fire areas are defined"]};
  const calculated=areas.map((area)=>{
    const code=Math.max(0,Number(area.codeFireFlowGpm)||0),sprinkler=Math.max(0,Number(area.sprinklerDemandGpm)||0),hose=Math.max(0,Number(area.hoseAllowanceGpm)||0);
    const sprinklerPlusHose=sprinkler+hose;
    return {...area,codeFireFlowGpm:code,sprinklerDemandGpm:sprinkler,hoseAllowanceGpm:hose,sprinklerPlusHoseGpm:sprinklerPlusHose,requiredGpm:Math.max(code,sprinklerPlusHose)};
  });
  const controlling=calculated.reduce((highest,item)=>item.requiredGpm>highest.requiredGpm?item:highest);
  const warnings=[...new Set(calculated.filter((item)=>!item.separationVerified).map((item)=>`${item.name}: fire-area separation is not verified`))];
  return {controllingGpm:controlling.requiredGpm,controllingAreaId:controlling.id,areas:calculated,warnings};
}

export type RoomCandidate = { id: string; name: string; aliases?: string[]; levelId?: string | null };

export function matchCadRoom(query: string, rooms: RoomCandidate[]): { room: RoomCandidate | null; confidence: number; reason: string } {
  const needle = normalizeWords(query);
  if (!needle) return { room: null, confidence: 0, reason: "CAD location did not include a room" };
  const ranked = rooms.map((room) => {
    const labels = [room.name, ...(room.aliases ?? [])].map(normalizeWords).filter(Boolean);
    const exact = labels.some((label) => label === needle);
    const contained = labels.some((label) => needle.includes(label) || label.includes(needle));
    const queryWords = new Set(needle.split(" "));
    const overlap = Math.max(0, ...labels.map((label) => label.split(" ").filter((word) => queryWords.has(word)).length / Math.max(1, label.split(" ").length)));
    return { room, score: exact ? 1 : contained ? 0.85 : overlap * 0.7 };
  }).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best || best.score < 0.5) return { room: null, confidence: best?.score ?? 0, reason: "No reliable room match" };
  if (ranked[1] && ranked[1].score === best.score) return { room: null, confidence: best.score, reason: "Multiple rooms matched equally" };
  return { room: best.room, confidence: best.score, reason: best.score === 1 ? "Exact room or alias match" : "Best normalized room match" };
}

function normalizeWords(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
