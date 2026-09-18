import type { ensureDatabase } from '../db/bootstrap';
import { emptyBoardConfiguration, validateBoardConfiguration, type SavedBoardConfiguration } from './board-configuration';
type Database = Awaited<ReturnType<typeof ensureDatabase>>;
export const boardConfigurationKey = 'board-configuration:stickney:v1';
export class BoardConfigurationConflict extends Error {}
async function readRow(db: Database) {
  const row = await db.prepare('SELECT value FROM system_meta WHERE key=? LIMIT 1').bind(boardConfigurationKey).first<{ value: string }>();
  if (!row) return { value: null, saved: emptyBoardConfiguration() };
  const raw = JSON.parse(Buffer.from(row.value, 'base64').toString('utf8')) as SavedBoardConfiguration;
  if (typeof raw.revision !== 'string' || typeof raw.updatedAt !== 'string') throw Error('Saved board configuration is unavailable.');
  return { value: row.value, saved: { revision: raw.revision, updatedAt: raw.updatedAt, configuration: validateBoardConfiguration(raw.configuration), previous: raw.previous ? validateBoardConfiguration(raw.previous) : null } };
}
export async function readBoardConfiguration(db: Database) { return (await readRow(db)).saved; }
export async function saveBoardConfiguration(db: Database, input: unknown, revision: string, actor: string) {
  const configuration = validateBoardConfiguration(input);
  const current = await readRow(db);
  if (current.saved.revision !== revision) throw new BoardConfigurationConflict('Another administrator published changes. Your draft is kept. Reload saved settings before publishing.');
  if (JSON.stringify(configuration) === JSON.stringify(current.saved.configuration)) return current.saved;
  const saved: SavedBoardConfiguration = { revision: crypto.randomUUID(), updatedAt: new Date().toISOString(), configuration, previous: current.saved.configuration };
  // One compare-and-swap commits settings, history, revision and editor together.
  // Encoded prose respects the existing private signed-SQL boundary.
  const encoded = Buffer.from(JSON.stringify({ ...saved, updatedBy: actor })).toString('base64');
  const result = current.value === null
    ? await db.prepare('INSERT INTO system_meta(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO NOTHING').bind(boardConfigurationKey, encoded).run()
    : await db.prepare('UPDATE system_meta SET value=?,updated_at=CURRENT_TIMESTAMP WHERE key=? AND value=?').bind(encoded, boardConfigurationKey, current.value).run();
  if (result.meta.changes !== 1) throw new BoardConfigurationConflict('Another administrator saved first. Your draft is kept. Reload saved settings before publishing.');
  return saved;
}
