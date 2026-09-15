import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { getSupabaseBackupHealth } from '../app/lib/supabase-backup-health.ts';

// Read-only acceptance probe. Never log the token or raw provider response.
const config = parseEnv(readFileSync(new URL('../.env.supabase-backups.local', import.meta.url), 'utf8'));
const ref = 'datqzdndkrfyovhwppuq';
if (config.SUPABASE_BACKUP_PROJECT_REF !== ref) throw new Error('Dedicated Stickney project mismatch. No request made.');
if (!config.SUPABASE_BACKUP_ACCESS_TOKEN) {
  console.error('Add the scoped Backups Read token to the protected local file before testing. No request made.');
  process.exitCode = 1;
} else {
  const result = await getSupabaseBackupHealth({
    supabaseUrl: `https://${ref}.supabase.co`, projectRef: ref,
    token: config.SUPABASE_BACKUP_ACCESS_TOKEN,
    requiredAfter: config.SUPABASE_BACKUP_REQUIRED_AFTER,
  });
  console.log(JSON.stringify(result, null, 2));
  // Warning can be an authentic stale/pre-import receipt. verifiedAt proves only
  // that a well-formed provider response arrived, not that coverage is healthy.
  if (!result.verifiedAt) process.exitCode = 1;
}
