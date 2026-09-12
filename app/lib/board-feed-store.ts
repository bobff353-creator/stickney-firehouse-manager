import 'server-only';
import { createPostgresD1Adapter } from '../../db/postgres-adapter';
import { getSupabaseSystemClient } from '../supabase-system';
import { portalServerHeaders } from '../portal-server-headers';
import type { FeedSource } from './feed-schedule';

// Reuse the existing server credential and signed SQL boundary (also used by
// dispatch). Never use a browser's session or initialize operational schemas.
function database() {
  return createPostgresD1Adapter(getSupabaseSystemClient, 'firehouse_server_sql', portalServerHeaders()['x-firehouse-server-key']);
}
export type FeedRow = { source: FeedSource; payload: Record<string, unknown> | null; last_success_at: string | null; last_attempt_at: string | null; attempted_slot: string | null; next_scheduled_at: string | null; status: string };
export const boardFeedStore = {
  async read(sources: readonly FeedSource[]): Promise<FeedRow[]> {
    const { results } = await database().prepare(`SELECT source,payload,last_success_at,last_attempt_at,attempted_slot,next_scheduled_at,status FROM board_feed_cache WHERE source IN (${sources.map(() => '?').join(',')})`).bind(...sources).all<FeedRow>();
    return results;
  },
  async claim(source: FeedSource): Promise<string | null> {
    const row = await database().prepare('SELECT claim_board_feed(?) AS token').bind(source).first<{ token: string | null }>();
    return row?.token ?? null;
  },
  async finish(source: FeedSource, token: string, data: Record<string, unknown> | null): Promise<boolean> {
    // Encoding keeps public feed prose/URLs out of the legacy SQL text filter.
    const encoded = data === null ? null : Buffer.from(JSON.stringify(data)).toString('base64');
    const row = await database().prepare('SELECT finish_board_feed(?, ?::uuid, ?) AS saved').bind(source, token, encoded).first<{ saved: boolean }>();
    return row?.saved === true;
  },
};
