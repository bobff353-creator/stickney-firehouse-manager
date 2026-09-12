import { savedFeedResponse } from '../../lib/board-feed-response';
export const dynamic = 'force-dynamic';
export async function GET() {
  return savedFeedResponse(['training_romeoville','training_ifsi','training_nipsta'], value => ({
    providers: Object.values(value.feeds).filter(feed => feed.data).map(feed => ({ ...feed.data, checkedAt: feed.lastSuccessAt, stale: feed.status !== 'current' })),
    nextCheckAt: value.nextCheckAt,
  }));
}
