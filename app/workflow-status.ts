/** Database timestamps may be SQLite UTC or PostgreSQL offsets such as +00. */
export function parseSavedTime(value: unknown): Date | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  let text = value.trim().replace(" ", "T");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)) return null;
  text = text.replace(/([+-]\d{2})$/, "$1:00");
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) text += "Z";
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function savedTimeLabel(value: unknown, fallback = "Time unavailable") {
  return parseSavedTime(value)?.toLocaleTimeString("en-US", {
    timeZone: "America/Chicago", hour: "numeric", minute: "2-digit",
  }) ?? fallback;
}

export function operationalStatusLabel(value: unknown) {
  const text = String(value ?? "").trim().replaceAll("_", " ");
  return text ? text[0].toUpperCase() + text.slice(1).toLowerCase() : "Status not reported";
}

export function checkNextAction(active: boolean, total: number, pending: number) {
  return !active ? "Start check" : total === 0 ? "View checklist" : pending === 0 ? "Review & submit" : "Resume check";
}

export function hydrantLocationLabel(hydrant: { address?: string; hydrantNumber?: string; latitude?: number; longitude?: number }) {
  if (hydrant.address?.trim()) return hydrant.address.trim();
  const point = Number.isFinite(hydrant.latitude) && Number.isFinite(hydrant.longitude) && Math.abs(hydrant.latitude!) <= 90 && Math.abs(hydrant.longitude!) <= 180
    ? `${hydrant.latitude!.toFixed(5)}, ${hydrant.longitude!.toFixed(5)}` : "Map position unavailable";
  return `Hydrant ${hydrant.hydrantNumber?.trim() || "(unnumbered)"} · ${point}`;
}

// A live event subscription reconciles every 5 minutes. A quiet CAD feed is not
// a failure: age of the last incident must never stand in for connection health.
export function responseFreshness(lastReceived: Date | null, now: number, online: boolean, live: boolean, failed: boolean) {
  if (!online) return { warning: true, label: "Offline · saved information" };
  if (failed) return { warning: true, label: "Updates interrupted · verify by radio" };
  const age = lastReceived ? now - lastReceived.getTime() : Infinity;
  if (!Number.isFinite(age) || age > (live ? 360_000 : 45_000)) return { warning: true, label: "Information may be stale · retry updates" };
  return { warning: false, label: live ? "App feed connected · updates on changes" : "App feed · backup refresh active" };
}
