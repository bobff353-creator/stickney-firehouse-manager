import type { FeedSource } from './feed-schedule';
export type FeedSnapshot<T = Record<string, unknown>> = {
  data: T | null;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  nextScheduledAt: string;
  status: 'current' | 'stale' | 'unavailable' | 'updating';
};
export type BoardFeeds = { feeds: Partial<Record<FeedSource, FeedSnapshot>>; readAt: string; nextCheckAt: string };
