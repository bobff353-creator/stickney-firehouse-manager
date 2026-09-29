import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
export function buildReleaseMetadata(env = process.env) {
  let git = '', prepared = {};
  try { git = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
  try { prepared = JSON.parse(readFileSync('.release-source.json', 'utf8')); } catch {}
  const sha = [env.APP_RELEASE_SHA, env.VERCEL_GIT_COMMIT_SHA, git, prepared.commit].find(v => typeof v === 'string' && /^[a-f0-9]{40}$/i.test(v));
  return { APP_BUILD_SHA: sha || '', APP_BUILT_AT: new Date().toISOString() };
}
