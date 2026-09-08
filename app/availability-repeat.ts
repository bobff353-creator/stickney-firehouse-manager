/** Expand calendar dates in UTC so daylight-saving changes never move an occurrence. */
export function expandAvailabilityDates(seeds: string[], interval: number, through: string): string[] {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Choose a valid date.");
    const time = Date.parse(`${value}T00:00:00Z`);
    if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new Error("Choose a valid date.");
    return time;
  };
  if (!Number.isInteger(interval) || interval < 0 || interval > 365) throw new Error("Choose a repeat interval from 1 to 365 days.");
  if (!seeds.length) return [];
  const starts = [...new Set(seeds)].map(parse);
  const end = interval ? parse(through) : Math.max(...starts);
  if (interval && end < Math.max(...starts)) throw new Error("Repeat through must be on or after every selected day.");
  if (interval && end - Math.min(...starts) > 366 * 86400000) throw new Error("Choose an end date within one year of the first selected day.");
  const dates = new Set<string>();
  for (const start of starts) {
    for (let time = start; time <= (interval ? end : start); time += (interval || 1) * 86400000) {
      dates.add(new Date(time).toISOString().slice(0, 10));
      if (dates.size > 93) throw new Error("This pattern exceeds 93 dates. Choose an earlier end date or save in smaller batches.");
    }
  }
  return [...dates].sort();
}
