import { feedSources, isFeedDue, type FeedSource } from './feed-schedule';
type Store = { claim: (source: FeedSource) => Promise<string | null>; finish: (source: FeedSource, token: string, data: Record<string, unknown> | null) => Promise<boolean> };
export async function refreshBoardFeeds(store: Store, loaders: Record<FeedSource, () => Promise<Record<string, unknown>>>, now = Date.now()) {
  return Promise.all(feedSources.filter(source => isFeedDue(source, now)).map(async source => {
    try {
      const token = await store.claim(source);
      if (!token) return { source, status: 'skipped' };
      try {
        const data = await loaders[source]();
        const saved = await store.finish(source, token, data);
        return { source, status: saved ? 'updated' : 'superseded' };
      } catch {
        await store.finish(source, token, null);
        return { source, status: 'retained' };
      }
    } catch {
      return { source, status: 'storage_unavailable' };
    }
  }));
}
