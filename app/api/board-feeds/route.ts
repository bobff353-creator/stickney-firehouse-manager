import { savedFeedResponse } from '../../lib/board-feed-response';
import { feedGroups } from '../../lib/feed-schedule';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const group = new URL(request.url).searchParams.get('group');
  if (group !== 'weather' && group !== 'bulletins') return Response.json({ error: 'Unknown feed group' }, { status: 400 });
  return savedFeedResponse(feedGroups[group]);
}
