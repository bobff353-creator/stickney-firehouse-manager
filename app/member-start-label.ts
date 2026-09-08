export function joinedLabel(startDate: string, now = new Date()): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return "Start date unavailable";
  const start = Date.parse(`${startDate}T00:00:00Z`);
  if (!Number.isFinite(start) || new Date(start).toISOString().slice(0, 10) !== startDate) return "Start date unavailable";
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)?.value;
  const today = Date.parse(`${value("year")}-${value("month")}-${value("day")}T00:00:00Z`);
  const days = Math.round((today - start) / 86_400_000);
  if (days === 0) return "Started today";
  if (days < 0) return `Starts in ${-days} day${days === -1 ? "" : "s"}`;
  return `Joined ${days} day${days === 1 ? "" : "s"} ago`;
}
