export const feedSources = ['weather', 'close_calls', 'usfa', 'training_romeoville', 'training_ifsi', 'training_nipsta'] as const;
export type FeedSource = typeof feedSources[number];
export type FeedGroup = 'weather' | 'bulletins';
export const feedGroups: Record<FeedGroup, readonly FeedSource[]> = {
  weather: ['weather'],
  bulletins: ['close_calls', 'usfa', 'training_romeoville', 'training_ifsi', 'training_nipsta'],
};
const chicagoHour = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hourCycle: 'h23' });
export function nextFeedSlot(source: FeedSource, now = Date.now()): number {
  if (source === 'weather') return (Math.floor(now / 900_000) + 1) * 900_000;
  // Enumerate UTC hours, then match local hours. No fixed CST/CDT offset.
  for (let candidate = (Math.floor(now / 3_600_000) + 1) * 3_600_000; candidate <= now + 27 * 3_600_000; candidate += 3_600_000) {
    const hour = Number(chicagoHour.format(candidate));
    if (hour === 6 || ((source === 'close_calls' || source === 'usfa') && hour === 18)) return candidate;
  }
  throw new Error('Unable to calculate feed schedule');
}
export function isFeedDue(source: FeedSource, now = Date.now()): boolean {
  if (source === 'weather') return true;
  const minute = new Date(now).getUTCMinutes();
  const hour = Number(chicagoHour.format(now));
  return minute < 15 && (hour === 6 || ((source === 'close_calls' || source === 'usfa') && hour === 18));
}
