import type { ensureDatabase } from '../db/bootstrap';
import { boardLinkSections, defaultBoardLinks, validateBoardLinkSection, type BoardLinks, type BoardLinkSectionId, type BoardLinkSection } from './board-links';

// The existing firehouse schema is private to this verified Stickney deployment.
// Reuse its server-authenticated settings boundary; no new public table or grants.
export const boardLinksKey = 'board-links:stickney:v1';
type Database = Awaited<ReturnType<typeof ensureDatabase>>;
export class BoardLinksConflict extends Error {}
export class BoardLinksLimit extends Error {}
async function readRow(db: Database) {
  const row = await db.prepare('SELECT value FROM system_meta WHERE key = ? LIMIT 1').bind(boardLinksKey).first<{ value: string }>();
  if (!row) return { value: null, settings: defaultBoardLinks() };
  const data = JSON.parse(Buffer.from(row.value, 'base64').toString('utf8')) as BoardLinks;
  if (!data || typeof data.revision !== 'string' || typeof data.updatedAt !== 'string') throw new Error('Saved board links could not be read.');
  const sections = Object.fromEntries(boardLinkSections.map(({ id }) => [id, validateBoardLinkSection(data.sections?.[id])])) as BoardLinks['sections'];
  return { value: row.value, settings: { revision: data.revision, updatedAt: data.updatedAt, sections } };
}
export async function readBoardLinks(db: Database) { return (await readRow(db)).settings; }
export async function saveBoardLinks(db: Database, id: BoardLinkSectionId, section: BoardLinkSection, expectedRevision: string, actor: string) {
  const current = await readRow(db);
  if (current.settings.revision !== expectedRevision) throw new BoardLinksConflict('Another administrator changed these links. Reload saved links before saving. Your draft is still here.');
  if (JSON.stringify(current.settings.sections[id]) === JSON.stringify(section)) return current.settings;
  const settings: BoardLinks = { revision: crypto.randomUUID(), updatedAt: new Date().toISOString(), sections: { ...current.settings.sections, [id]: section } };
  // Encode administrator prose to pass the existing signed SQL text boundary.
  // The revision, editor identity and data commit in the SAME conditional write.
  const serialized = JSON.stringify({ ...settings, updatedBy: actor });
  // Bound the complete record and the two encoded values in the conditional
  // update, safely below the existing 200 KB signed-query limit.
  if (Buffer.byteLength(serialized, 'utf8') > 60000) throw new BoardLinksLimit('The board links are too long. Shorten website addresses or descriptions before saving.');
  const encoded = Buffer.from(serialized).toString('base64');
  const result = current.value === null
    ? await db.prepare('INSERT INTO system_meta (key,value,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO NOTHING').bind(boardLinksKey, encoded).run()
    : await db.prepare('UPDATE system_meta SET value=?,updated_at=CURRENT_TIMESTAMP WHERE key=? AND value=?').bind(encoded, boardLinksKey, current.value).run();
  if (result.meta.changes !== 1) throw new BoardLinksConflict('Another administrator saved first. Reload saved links before saving. Your draft is still here.');
  return settings;
}
