export const RESPOND_PROGRESS_STORAGE_KEY = "stickney-respond-progress-v1";

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

function progressKey(reportNumber: unknown, apparatus: unknown) {
  return `${String(reportNumber ?? "").trim()}::${String(apparatus ?? "portal").trim() || "portal"}`;
}

function isProgressStatus(value: unknown): value is RespondProgressStatus {
  return respondProgressSteps.includes(value as RespondProgressStatus);
}

function readAll(store: Pick<KeyValueStore, "getItem">) {
  try {
    const parsed = JSON.parse(
      store.getItem(RESPOND_PROGRESS_STORAGE_KEY) || "{}",
    ) as Record<string, Partial<RespondProgress>>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function readRespondProgress(
  store: Pick<KeyValueStore, "getItem">,
  reportNumber: unknown,
  apparatus: unknown,
): RespondProgress | null {
  const saved = readAll(store)[progressKey(reportNumber, apparatus)];
  if (!saved || !isProgressStatus(saved.status)) return null;
  return {
    status: saved.status,
    updatedAt: String(saved.updatedAt ?? ""),
  };
}

export function writeRespondProgress(
  store: KeyValueStore,
  reportNumber: unknown,
  apparatus: unknown,
  status: RespondProgressStatus,
  updatedAt = new Date().toISOString(),
) {
  const all = readAll(store);
  const progress = { status, updatedAt } satisfies RespondProgress;
  all[progressKey(reportNumber, apparatus)] = progress;
  store.setItem(RESPOND_PROGRESS_STORAGE_KEY, JSON.stringify(all));
  return progress;
}
