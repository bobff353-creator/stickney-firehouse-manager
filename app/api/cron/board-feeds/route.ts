import { boardFeedStore } from '../../../lib/board-feed-store';
import { refreshBoardFeeds } from '../../../lib/board-feed-refresh';
import { loadCloseCallNews, loadTrainingProvider } from '../../../lib/external-feeds';
import { loadWeather } from '../../../lib/weather-source';
import { loadUsfa } from '../../../lib/usfa-source';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 });
  const results = await refreshBoardFeeds(boardFeedStore, {
    weather: loadWeather, close_calls: loadCloseCallNews, usfa: loadUsfa,
    training_romeoville: () => loadTrainingProvider('romeoville'),
    training_ifsi: () => loadTrainingProvider('ifsi'),
    training_nipsta: () => loadTrainingProvider('nipsta'),
  });
  return Response.json({ results }, { status: results.some(result => result.status === 'storage_unavailable' || result.status === 'retained') ? 207 : 200, headers: { 'Cache-Control': 'no-store' } });
}
