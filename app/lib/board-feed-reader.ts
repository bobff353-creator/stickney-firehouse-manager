import type { FeedRow } from './board-feed-store';
import { isFeedDue, nextFeedSlot, type FeedSource } from './feed-schedule';
import type { BoardFeeds, FeedSnapshot } from './board-feed-types';

export function feedSnapshot(source: FeedSource, row: FeedRow | undefined, now: number): FeedSnapshot {
  const nextScheduled = row?.next_scheduled_at ? new Date(row.next_scheduled_at).getTime() : nextFeedSlot(source, now);
  const attemptTime = row?.last_attempt_at ? new Date(row.last_attempt_at).getTime() : 0;
  const updating = row?.status === 'updating' && now - attemptTime < 300_000;
  return {
    data: row?.payload ?? null,
    lastSuccessAt: row?.last_success_at ?? null,
    lastAttemptAt: row?.last_attempt_at ?? null,
    nextScheduledAt: new Date(nextScheduled).toISOString(),
    status: updating ? 'updating' : !row?.payload ? 'unavailable' : row.status !== 'ok' || now >= nextScheduled ? 'stale' : 'current',
  };
}

export function assembleFeeds(sources: readonly FeedSource[], rows: FeedRow[], now = Date.now()): BoardFeeds {
  const feeds = Object.fromEntries(sources.map(source => [source, feedSnapshot(source, rows.find(row => row.source === source), now)]));
  // Give the scheduled retrieval a minute to finish. Retry only while a worker
  // is actively updating, not an external-source failure or a missed schedule.
  const waitingForCron = sources.some(source => isFeedDue(source, now) && now % 900_000 < 300_000 &&
    Date.parse(rows.find(row => row.source === source)?.attempted_slot ?? '') !== Math.floor(now / 900_000) * 900_000);
  const updating = waitingForCron || Object.values(feeds).some(feed => feed.status === 'updating');
  const next = updating ? now + 30_000 : Math.min(...sources.map(source => nextFeedSlot(source, now))) + 60_000;
  return { feeds, readAt: new Date(now).toISOString(), nextCheckAt: new Date(next).toISOString() };
}

export function createFeedReader(read: (sources: readonly FeedSource[]) => Promise<FeedRow[]>, clock = Date.now) {
  // Bounded by the six known sources; coalesce simultaneous reads in one worker.
  const cache = new Map<string, { until: number; value: BoardFeeds }>();
  const pending = new Map<string, Promise<BoardFeeds>>();
  return async (sources: readonly FeedSource[]): Promise<BoardFeeds> => {
    const key = [...sources].sort().join(',');
    const hit = cache.get(key);
    if (hit && hit.until > clock()) return hit.value;
    const active = pending.get(key);
    if (active) return active;
    const request = read(sources).then(rows => {
      const value = assembleFeeds(sources, rows, clock());
      // Only a short origin read cache. Durable rows, not memory, are authority.
      if (cache.size >= 8) cache.delete(cache.keys().next().value!);
      cache.set(key, { value, until: clock() + 10_000 });
      return value;
    }).finally(() => pending.delete(key));
    pending.set(key, request);
    return request;
  };
}
