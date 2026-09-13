import { feedGroups, nextFeedSlot, type FeedGroup } from './lib/feed-schedule';
import type { BoardFeeds, FeedSnapshot } from './lib/board-feed-types';

export type BoardFeedState = { feeds: BoardFeeds['feeds']; unconfirmed: Partial<Record<FeedGroup, boolean>> };
export const emptyBoardFeeds: BoardFeedState = { feeds: {}, unconfirmed: {} };
type Environment = {
  now: () => number;
  request: (group: FeedGroup, signal: AbortSignal) => Promise<BoardFeeds>;
  setTimer: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clearTimer: (timer: ReturnType<typeof setTimeout>) => void;
  active: () => boolean;
  online: () => boolean;
  restore: (group: FeedGroup) => BoardFeeds | null;
  persist: (group: FeedGroup, data: BoardFeeds) => void;
};
export function validBoardFeeds(value: unknown): value is BoardFeeds {
  if (!value || typeof value !== 'object') return false;
  const item = value as BoardFeeds;
  return Boolean(item.feeds && typeof item.feeds === 'object' && Number.isFinite(Date.parse(item.readAt)) && Number.isFinite(Date.parse(item.nextCheckAt)) &&
    Object.values(item.feeds).every(feed => feed && typeof feed === 'object' && 'data' in feed &&
      (feed.lastSuccessAt === null || Number.isFinite(Date.parse(feed.lastSuccessAt))) && Number.isFinite(Date.parse(feed.nextScheduledAt)) &&
      ['current','stale','unavailable','updating'].includes(feed.status)));
}

// One shared, bounded scheduler for all board instances in this browser. These
// are cached portal reads, never provider requests or operational polling.
export function createBoardFeedClient(env: Environment) {
  let state: BoardFeedState = emptyBoardFeeds;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Map<() => void, boolean>();
  const next: Record<FeedGroup, number> = { weather: 0, bulletins: 0 };
  const pending = new Map<FeedGroup, AbortController>();
  const groups = Object.keys(feedGroups) as FeedGroup[];
  function merge(group: FeedGroup, value: BoardFeeds) {
    const feeds = { ...state.feeds };
    for (const source of feedGroups[group]) {
      const feed = value.feeds[source];
      if (!feed) continue;
      // A missing saved copy must not clear a last-successful browser copy.
      feeds[source] = !feed.data && feeds[source]?.data
        ? { ...feeds[source]!, status: 'stale' } : feed;
    }
    state = { feeds, unconfirmed: { ...state.unconfirmed, [group]: false } };
  }
  for (const group of groups) {
    const saved = env.restore(group);
    if (validBoardFeeds(saved) && Date.parse(saved.readAt) <= env.now() + 60_000) {
      merge(group, saved);
      // Don't trust unbounded/future browser storage to suppress updates.
      next[group] = Math.min(Date.parse(saved.nextCheckAt), nextFeedSlot(feedGroups[group][0], env.now()) + 60_000);
    }
  }
  function publish() { listeners.forEach((_, callback) => callback()); }
  function enabled() { return listeners.size > 0 && env.online() && (env.active() || [...listeners.values()].some(Boolean)); }
  function schedule() {
    if (timer !== undefined) env.clearTimer(timer);
    timer = undefined;
    if (!enabled()) return;
    const due = groups.filter(group => !pending.has(group)).map(group => next[group]);
    if (due.length) timer = env.setTimer(tick, Math.max(0, Math.min(...due) - env.now()));
  }
  async function refresh(group: FeedGroup) {
    const controller = new AbortController();
    pending.set(group, controller);
    try {
      const value = await env.request(group, controller.signal);
      if (controller.signal.aborted || !validBoardFeeds(value)) throw new Error('Invalid saved feed response');
      merge(group, value);
      const nextSlot = nextFeedSlot(feedGroups[group][0], env.now()) + 60_000;
      // An already-expired CDN response is checked once more after a short delay,
      // never spun in a tight loop and never marked newly confirmed.
      next[group] = Math.max(env.now() + 30_000, Math.min(Date.parse(value.nextCheckAt), nextSlot));
      env.persist(group, { ...value, feeds: Object.fromEntries(feedGroups[group].map(source => [source, state.feeds[source]])), nextCheckAt: new Date(next[group]).toISOString() });
      publish();
    } catch {
      if (!controller.signal.aborted) {
        state = { ...state, unconfirmed: { ...state.unconfirmed, [group]: true } };
        next[group] = env.now() + 300_000;
        publish();
      }
    } finally {
      if (pending.get(group) === controller) pending.delete(group);
      schedule();
    }
  }
  function tick() {
    timer = undefined;
    if (enabled()) for (const group of groups) if (!pending.has(group) && next[group] <= env.now()) void refresh(group);
    schedule();
  }
  return {
    snapshot: () => state,
    resume: () => schedule(),
    invalidateBulletins() {
      pending.get('bulletins')?.abort(); pending.delete('bulletins');
      next.bulletins = 0; schedule();
    },
    subscribe(callback: () => void, alwaysOn = false) {
      listeners.set(callback, alwaysOn); schedule();
      return () => {
        listeners.delete(callback);
        if (!listeners.size) { pending.forEach(controller => controller.abort()); pending.clear(); }
        schedule();
      };
    },
  };
}

export function savedFeedLabel(feed: FeedSnapshot | undefined, unconfirmed = false, now = Date.now()) {
  if (!feed?.lastSuccessAt) return 'Awaiting scheduled update';
  const stamp = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(feed.lastSuccessAt));
  const stale = unconfirmed || feed.status !== 'current' || Date.parse(feed.nextScheduledAt) <= now;
  return `${stale ? 'Last saved' : 'Updated'} ${stamp}`;
}
