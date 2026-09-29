import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
if (dirty) throw new Error('Commit the reviewed release before deploying.');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
writeFileSync('.release-source.json', JSON.stringify({ commit }));
try {
  const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['--yes','vercel@61.0.0','deploy','--prod','--yes','--scope','fire-pre-plan-pro','--env',`APP_RELEASE_SHA=${commit}`,'--build-env',`APP_RELEASE_SHA=${commit}`], { stdio: 'inherit', shell: process.platform === 'win32' });
  process.exitCode = result.status ?? 1;
} finally { unlinkSync('.release-source.json'); }
