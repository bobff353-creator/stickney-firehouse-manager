import type { ensureDatabase } from '../db/bootstrap';
import { getPortalDepartment } from './department-portal';
import { emptyScheduleSafetyRules, validateScheduleSafetyRules, type ScheduleSafetyRules } from './schedule-safety';
type Database = Awaited<ReturnType<typeof ensureDatabase>>;
export type SavedScheduleSafety = { revision: string; updatedAt: string; rules: ScheduleSafetyRules };
export class ScheduleSafetyConflict extends Error {}
async function readRow(db: Database) {
  const department = await getPortalDepartment();
  const key = `schedule-safety:${department.id}:v1`;
  const row = await db.prepare('SELECT value FROM system_meta WHERE key=? LIMIT 1').bind(key).first<{ value: string }>();
  if (!row) return { key, encoded: null, saved: { revision: '', updatedAt: '', rules: emptyScheduleSafetyRules() } };
  const raw = JSON.parse(Buffer.from(row.value, 'base64').toString('utf8')) as SavedScheduleSafety;
  if (typeof raw.revision !== 'string' || typeof raw.updatedAt !== 'string') throw Error('Schedule review rules could not be confirmed.');
  return { key, encoded: row.value, saved: { revision: raw.revision, updatedAt: raw.updatedAt, rules: validateScheduleSafetyRules(raw.rules) } };
}
export async function readScheduleSafety(db: Database): Promise<SavedScheduleSafety> { return (await readRow(db)).saved; }
export async function saveScheduleSafety(db: Database, input: unknown, revision: string, actor: string) {
  const rules = validateScheduleSafetyRules(input);
  const current = await readRow(db);
  if (current.saved.revision !== revision) throw new ScheduleSafetyConflict('Another administrator saved review rules. Your inputs are kept. Refresh before saving.');
  if (JSON.stringify(rules) === JSON.stringify(current.saved.rules)) return current.saved;
  const saved = { revision: crypto.randomUUID(), updatedAt: new Date().toISOString(), rules };
  const encoded = Buffer.from(JSON.stringify({ ...saved, updatedBy: actor })).toString('base64');
  const writes = [current.encoded === null
    ? db.prepare('INSERT INTO system_meta(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO NOTHING').bind(current.key, encoded).expectChanges(1)
    : db.prepare('UPDATE system_meta SET value=?,updated_at=CURRENT_TIMESTAMP WHERE key=? AND value=?').bind(encoded, current.key, current.encoded).expectChanges(1),
    db.prepare("INSERT INTO record_revisions(id,record_type,record_id,revision_number,action,summary,actor) SELECT ?,'schedule-safety',?,COALESCE(MAX(revision_number),0)+1,'Review rules updated',?,? FROM record_revisions WHERE record_type='schedule-safety' AND record_id=?")
      .bind(crypto.randomUUID(), current.key, `Rest: ${rules.minimumRestHours ?? 'off'}, continuous hours: ${rules.maximumContinuousHours ?? 'off'}`, actor, current.key),
  ];
  try { await db.batch(writes); }
  catch (error) { if (error instanceof Error && error.message.includes('SAVE_CONFLICT')) throw new ScheduleSafetyConflict('Another administrator saved first. Refresh before retrying.'); throw error; }
  return saved;
}
