import type { ensureDatabase } from '../db/bootstrap';
import { defaultCisSettings, type CisSettings } from './cis-cad-routing';
type Database = Awaited<ReturnType<typeof ensureDatabase>>;
export const cisSettingsKey = 'cis-cad:stickney:v1';
export const encodeCisRecord = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64');
export async function readCisSettings(db: Database) {
  const row = await db.prepare('SELECT value FROM system_meta WHERE key=? LIMIT 1').bind(cisSettingsKey).first<{ value: string }>();
  const settings: CisSettings = row ? JSON.parse(Buffer.from(row.value, 'base64').toString('utf8')) : defaultCisSettings();
  if (!['disabled', 'shadow', 'live'].includes(settings.mode) || !Array.isArray(settings.agencies) || !Array.isArray(settings.units)) throw new Error('Invalid saved CIS configuration. Delivery remains blocked.');
  return { settings, value: row?.value ?? null };
}
export async function saveCisSettings(db: Database, settings: CisSettings, actor: string) {
  const current = await readCisSettings(db);
  if (settings.revision !== current.settings.revision) throw new Error('Settings changed. Reload before saving.');
  const next = { ...settings, revision: crypto.randomUUID() };
  const value = encodeCisRecord({ ...next, updatedBy: actor, updatedAt: new Date().toISOString() });
  const result = current.value === null
    ? await db.prepare('INSERT INTO system_meta (key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING').bind(cisSettingsKey, value).run()
    : await db.prepare('UPDATE system_meta SET value=?,updated_at=CURRENT_TIMESTAMP WHERE key=? AND value=?').bind(value, cisSettingsKey, current.value).run();
  if (result.meta.changes !== 1) throw new Error('Settings changed. Reload before saving.');
  return next;
}
