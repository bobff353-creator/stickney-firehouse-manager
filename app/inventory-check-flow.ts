export type CheckSection = { id: string; label: string; total: number; pending: number };

/** Start at an unfinished section, but never move the crew when a result saves. */
export function initialCheckSection(sections: CheckSection[]) {
  return sections.find(section => section.pending > 0)?.id || sections[0]?.id || "review";
}

export function canSubmitInspection(total: number, pending: number, dirty: boolean, busy: boolean, allowed: boolean) {
  return total > 0 && pending === 0 && !dirty && !busy && allowed;
}

export function stockExpiryDays(date: unknown, now = Date.now()): number | null {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const expiry = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(expiry) || new Date(expiry).toISOString().slice(0, 10) !== date || !Number.isFinite(now)) return null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
  return Math.round((expiry - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}
