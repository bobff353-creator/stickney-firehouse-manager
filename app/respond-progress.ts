import { normalizeApparatusUnit, respondingUnitsIncludeUnit } from "./respond-device";

// Do not reuse v1 browser-wide/portal records: they have no department identity.
export const RESPOND_PROGRESS_STORAGE_KEY = "stickney-respond-progress-v2";
export const RESPOND_PROGRESS_LIMIT = 100;

export type RespondProgressScope = { departmentId: string; reportNumber: string; apparatus: string };

export function assignedRespondProgressScope(apparatus: string, packet?: {
  departmentId: string;
  apparatusFilter: string | null;
  activeCall: { reportNumber: string; respondingUnits: string } | null;
} | null): RespondProgressScope | null {
  const unit = normalizeApparatusUnit(apparatus);
  const departmentId = packet?.departmentId.trim();
  const reportNumber = packet?.activeCall?.reportNumber.trim();
  if (!unit || !departmentId || !reportNumber
    || normalizeApparatusUnit(packet?.apparatusFilter) !== unit
    || !respondingUnitsIncludeUnit(packet?.activeCall?.respondingUnits, unit)) return null;
  return { departmentId, reportNumber, apparatus: unit };
}

export function respondProgressKey(scope: RespondProgressScope | null) {
  if (!scope?.departmentId.trim() || !scope.reportNumber.trim() || !normalizeApparatusUnit(scope.apparatus)) return null;
  return JSON.stringify([scope.departmentId.trim(), scope.reportNumber.trim(), normalizeApparatusUnit(scope.apparatus)]);
}

export const respondProgressSteps = [
  "acknowledged",
  "en_route",
  "on_scene",
  "cleared_scene",
  "in_service_on_air",
  "returning_to_quarters",
  "canceled",
] as const;

export type RespondProgressStatus = (typeof respondProgressSteps)[number];

export function nextRespondActions(status?: RespondProgressStatus): RespondProgressStatus[] {
  switch (status) {
    case "acknowledged": return ["en_route", "on_scene", "canceled"];
    case "en_route": return ["on_scene", "canceled"];
    case "on_scene": return ["cleared_scene", "canceled"];
    case "cleared_scene": return ["in_service_on_air", "returning_to_quarters", "canceled"];
    case "in_service_on_air":
    case "returning_to_quarters":
    case "canceled": return [];
    default: return ["acknowledged", "en_route", "on_scene"];
  }
}

export type RespondProgress = {
  status: RespondProgressStatus;
  updatedAt: string;
};

type KeyValueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function isProgressStatus(value: unknown): value is RespondProgressStatus {
  return respondProgressSteps.includes(value as RespondProgressStatus);
}

function readAll(store: Pick<KeyValueStore, "getItem">) {
  const raw = store.getItem(RESPOND_PROGRESS_STORAGE_KEY);
  try {
    const parsed = JSON.parse(
      raw || "{}",
    ) as Record<string, Partial<RespondProgress>>;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function readRespondProgress(
  store: Pick<KeyValueStore, "getItem">,
  scope: RespondProgressScope | null,
): RespondProgress | null {
  const key = respondProgressKey(scope);
  if (!key) return null;
  const saved = readAll(store)[key];
  if (!saved || !isProgressStatus(saved.status) || !Number.isFinite(Date.parse(String(saved.updatedAt)))) return null;
  return {
    status: saved.status,
    updatedAt: String(saved.updatedAt ?? ""),
  };
}

export function writeRespondProgress(
  store: KeyValueStore,
  scope: RespondProgressScope | null,
  status: RespondProgressStatus,
  updatedAt = new Date().toISOString(),
) {
  const key = respondProgressKey(scope);
  if (!key || !isProgressStatus(status) || !Number.isFinite(Date.parse(updatedAt))) throw new Error("A department, call and apparatus are required for valid response progress.");
  const all = readAll(store);
  const progress = { status, updatedAt } satisfies RespondProgress;
  // Bound local history without touching the legacy store or operational records.
  const recent = Object.entries(all).filter(([entryKey, value]) => entryKey !== key && value && isProgressStatus(value.status) && Number.isFinite(Date.parse(String(value.updatedAt))))
    .sort((a, b) => Date.parse(String(b[1].updatedAt)) - Date.parse(String(a[1].updatedAt)))
    .slice(0, RESPOND_PROGRESS_LIMIT - 1);
  store.setItem(RESPOND_PROGRESS_STORAGE_KEY, JSON.stringify({ ...Object.fromEntries(recent), [key]: progress }));
  return progress;
}
