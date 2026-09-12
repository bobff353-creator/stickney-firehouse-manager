import 'server-only';
import { boardFeedStore } from './board-feed-store';
import { createFeedReader } from './board-feed-reader';
import type { FeedSource } from './feed-schedule';
import type { BoardFeeds } from './board-feed-types';
const read = createFeedReader(boardFeedStore.read);
export async function savedFeedResponse(sources: readonly FeedSource[], project: (value: BoardFeeds) => unknown = value => value) {
  try {
    const value = await read(sources);
    const seconds = Math.max(0, Math.floor((Date.parse(value.nextCheckAt) - Date.now()) / 1000));
    return Response.json(project(value), { headers: { 'Cache-Control': `public, max-age=0, s-maxage=${seconds}, must-revalidate` } });
  } catch {
    return Response.json({ error: 'Saved feed information is temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
export function legacyFeedResponse(source: FeedSource) {
  return savedFeedResponse([source], value => {
    const snapshot = value.feeds[source]!;
    return { ...(snapshot.data ?? {}), checkedAt: snapshot.lastSuccessAt, lastSuccessAt: snapshot.lastSuccessAt, nextScheduledAt: snapshot.nextScheduledAt, stale: snapshot.status !== 'current', available: snapshot.data !== null };
  });
}
