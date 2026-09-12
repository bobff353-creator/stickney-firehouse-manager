import { legacyFeedResponse } from '../../lib/board-feed-response';
export const dynamic = 'force-dynamic';
export async function GET() { return legacyFeedResponse('usfa'); }
