import { savedFeedResponse } from '../../lib/board-feed-response';
import { feedGroups } from '../../lib/feed-schedule';
import { boardFeedStore } from '../../lib/board-feed-store';
import { assembleFeeds } from '../../lib/board-feed-reader';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const group = new URL(request.url).searchParams.get('group');
  if (group !== 'weather' && group !== 'bulletins') return Response.json({ error: 'Unknown feed group' }, { status: 400 });
  // An explicit admin publication invalidates the scheduled snapshot. Only
  // read saved public data here; no request can trigger an external import.
  const revision = new URL(request.url).searchParams.get('revision');
  if (group === 'bulletins' && revision && /^[a-f0-9-]{36}$/.test(revision)) {
    try { return Response.json(assembleFeeds(feedGroups.bulletins, await boardFeedStore.read(feedGroups.bulletins)), { headers: { 'Cache-Control': 'no-store' } }); }
    catch { return Response.json({ error: 'Saved classes are temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
  }
  return savedFeedResponse(feedGroups[group]);
}
