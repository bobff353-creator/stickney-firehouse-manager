export const RESPOND_DEVICE_STORAGE_KEY = "stickney-respond-device-settings";
export const RESPOND_ALERT_DURATION_SECONDS = 90;
export const APPARATUS_UNITS = ["1201", "1203", "1204", "1205", "1207"] as const;

export type RespondDeviceMode = "standard" | "apparatus" | "operations-alert";
export type RespondDeviceSettings = {
  mode: RespondDeviceMode;
  apparatus: string;
  deviceName: string;
};

export const defaultRespondDeviceSettings: RespondDeviceSettings = {
  mode: "standard",
  apparatus: APPARATUS_UNITS[0],
  deviceName: "",
};

type KeyValueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function normalizeApparatusUnit(value: unknown) {
  return String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20);
}

export function respondingUnitsIncludeUnit(respondingUnits: unknown, apparatus: unknown) {
  const unit = normalizeApparatusUnit(apparatus);
  if (!unit) return true;
  const tokens = String(respondingUnits ?? "").toUpperCase().split(/[^A-Z0-9-]+/).filter(Boolean);
  return tokens.includes(unit);
}

export function readRespondDeviceSettings(store: Pick<KeyValueStore, "getItem">): RespondDeviceSettings {
  try {
    const parsed = JSON.parse(store.getItem(RESPOND_DEVICE_STORAGE_KEY) || "{}") as Partial<RespondDeviceSettings>;
    const mode: RespondDeviceMode = parsed.mode === "apparatus" || parsed.mode === "operations-alert" ? parsed.mode : "standard";
    return {
      mode,
      apparatus: normalizeApparatusUnit(parsed.apparatus) || defaultRespondDeviceSettings.apparatus,
      deviceName: String(parsed.deviceName ?? "").trim().slice(0, 60),
    };
  } catch {
    return { ...defaultRespondDeviceSettings };
  }
}

export function writeRespondDeviceSettings(store: Pick<KeyValueStore, "setItem">, settings: RespondDeviceSettings) {
  const normalized: RespondDeviceSettings = {
    mode: settings.mode,
    apparatus: normalizeApparatusUnit(settings.apparatus) || defaultRespondDeviceSettings.apparatus,
    deviceName: settings.deviceName.trim().slice(0, 60),
  };
  store.setItem(RESPOND_DEVICE_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}
