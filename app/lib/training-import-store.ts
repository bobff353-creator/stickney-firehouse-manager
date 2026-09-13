import { createHash } from 'node:crypto';
import type { ensureDatabase } from '../../db/bootstrap';
import { boardLinksKey, readBoardLinksRow } from '../board-links-store';
import type { TrainingProvider } from './external-feeds';
import type { TrainingSourceId } from './training-sources';
type Database = Awaited<ReturnType<typeof ensureDatabase>>;
type Preview = { id: string; attemptedAt: number; expiresAt: number; status: 'loading' | 'ready' | 'failed' | 'published'; expectedSuccess: string | null; data?: TrainingProvider };
const key = (id: TrainingSourceId) => `training-preview:stickney:${id}`;
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64');
const hash = (value: string) => createHash('md5').update(value).digest('hex'); // Equality only, not authentication.
export class TrainingImportError extends Error { constructor(message: string, public status = 409) { super(message); } }
async function previewRow(db: Database, id: TrainingSourceId) {
  const row = await db.prepare('SELECT value FROM system_meta WHERE key=? LIMIT 1').bind(key(id)).first<{ value: string }>();
  return row ? { raw: row.value, value: JSON.parse(Buffer.from(row.value, 'base64').toString('utf8')) as Preview } : null;
}
export async function previewTraining(db: Database, id: TrainingSourceId, loader: () => Promise<TrainingProvider>) {
  const previous = await previewRow(db, id);
  if (previous && Date.now() - previous.value.attemptedAt < 600_000) {
    if (previous.value.status === 'ready' && previous.value.data) return previous.value;
    throw new TrainingImportError('This provider was checked recently. Try again in 10 minutes; saved classes are unchanged.', 429);
  }
  const current = await db.prepare('SELECT last_success_at FROM board_feed_cache WHERE source=? LIMIT 1').bind(`training_${id}`).first<{ last_success_at: string | null }>();
  const now = Date.now();
  const preview: Preview = { id: crypto.randomUUID(), attemptedAt: now, expiresAt: now + 1_800_000, status: 'loading', expectedSuccess: current?.last_success_at ?? null };
  const pending = encode(preview);
  // Durable, bounded (three rows) cooldown claim BEFORE external I/O. No DB
  // transaction is held while a provider is slow. Failed checks consume cooldown.
  const claim = await db.prepare("INSERT INTO system_meta(key,value,updated_at) VALUES(?,?,clock_timestamp()::text) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=EXCLUDED.updated_at WHERE system_meta.updated_at::timestamptz < clock_timestamp()-interval '10 minutes'").bind(key(id), pending).run();
  if (claim.meta.changes !== 1) throw new TrainingImportError('Another administrator is checking this provider. Try again shortly.', 429);
  try {
    const data = await loader();
    if (data.id !== id || !data.available || !Array.isArray(data.upcoming)) throw Error('Invalid provider response');
    const ready: Preview = { ...preview, status: 'ready', data };
    const encoded = encode(ready);
    if (encoded.length > 150_000) throw Error('Class list too large');
    const result = await db.prepare('UPDATE system_meta SET value=? WHERE key=? AND value=?').bind(encoded, key(id), pending).run();
    if (result.meta.changes !== 1) throw Error('Preview replaced');
    return ready;
  } catch {
    await db.prepare('UPDATE system_meta SET value=? WHERE key=? AND value=?').bind(encode({ ...preview, status: 'failed' }), key(id), pending).run();
    throw new TrainingImportError('The official schedule could not be confirmed. Saved classes have not changed. Try again in 10 minutes.', 502);
  }
}
export async function publishTraining(db: Database, id: TrainingSourceId, previewId: string, actor: string) {
  const row = await previewRow(db, id);
  if (!row || row.value.id !== previewId) throw new TrainingImportError('This preview has been replaced. Test the source again.');
  const preview = row.value;
  if (preview.status === 'published') {
    const current = await db.prepare('SELECT attempt_id FROM board_feed_cache WHERE source=?').bind(`training_${id}`).first<{ attempt_id: string }>();
    if (current?.attempt_id === previewId) return (await readBoardLinksRow(db)).settings; // Lost-response retry, no new writes.
  }
  if (preview.status !== 'ready' || !preview.data || preview.expiresAt <= Date.now()) throw new TrainingImportError('Preview expired or is unavailable. Test the source again.');
  const links = await readBoardLinksRow(db);
  const settings = { ...links.settings, revision: crypto.randomUUID(), trainingRevision: previewId, updatedAt: new Date().toISOString() };
  const serializedLinks = JSON.stringify({ ...settings, updatedBy: actor });
  if (Buffer.byteLength(serializedLinks, 'utf8') > 60000) throw new TrainingImportError('The saved website shortcuts are too long. Shorten them before publishing classes.');
  const linkValue = encode({ ...settings, updatedBy: actor });
  const payload = encode(preview.data);
  const source = `training_${id}`;
  // One existing signed batch transaction: consume preview, publish confirmed
  // classes and signal other boards. Roll back ALL writes on any conflict/failure.
  try {
    await db.batch([
      db.prepare('UPDATE system_meta SET value=? WHERE key=? AND md5(value)=?').bind(encode({ ...preview, data: undefined, status: 'published' }), key(id), hash(row.raw)).expectChanges(1),
      db.prepare("INSERT INTO board_feed_cache AS cache(source,payload,last_success_at,last_attempt_at,attempted_slot,attempt_id,next_scheduled_at,status) VALUES(?,convert_from(decode(?,'base64'),'UTF8')::jsonb,?::timestamptz,?::timestamptz,to_timestamp(0),?::uuid,next_board_feed_slot(?,clock_timestamp()),'ok') ON CONFLICT(source) DO UPDATE SET payload=EXCLUDED.payload,last_success_at=EXCLUDED.last_success_at,last_attempt_at=EXCLUDED.last_attempt_at,attempt_id=EXCLUDED.attempt_id,next_scheduled_at=EXCLUDED.next_scheduled_at,status='ok',error_code=NULL WHERE cache.last_success_at IS NOT DISTINCT FROM ?::timestamptz AND cache.status<>'updating'").bind(source, payload, preview.data.checkedAt, preview.data.checkedAt, previewId, source, preview.expectedSuccess).expectChanges(1),
      links.value === null
        ? db.prepare('INSERT INTO system_meta(key,value,updated_at) VALUES(?,?,clock_timestamp()::text) ON CONFLICT(key) DO NOTHING').bind(boardLinksKey, linkValue).expectChanges(1)
        : db.prepare('UPDATE system_meta SET value=?,updated_at=clock_timestamp()::text WHERE key=? AND md5(value)=?').bind(linkValue, boardLinksKey, hash(links.value)).expectChanges(1),
    ]);
  } catch { throw new TrainingImportError('Save was not confirmed. A newer refresh, another edit, or a connection problem may have intervened. Your preview is preserved; reload before retrying.'); }
  return settings;
}
