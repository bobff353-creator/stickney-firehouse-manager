import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const project = 'qizfnynrspsydiuwkkex';
const config = JSON.parse(decodeURIComponent(process.argv[2] ?? ''));
if (config.url !== `https://${project}.supabase.co` || !config.key?.startsWith('sb_publishable_')) {
  throw new Error('The independent review project and its publishable key are required.');
}
const path = '.env.local';
if (!existsSync(path)) {
  const values = {
    NEXT_PUBLIC_SUPABASE_URL: config.url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: config.key,
    FIREHOUSE_DATABASE_SECRET: randomBytes(48).toString('hex'),
    PORTAL_PIN_PASSWORD_PEPPER: randomBytes(48).toString('hex'),
    POWER_APPS_SESSION_SECRET: randomBytes(32).toString('hex'),
    PAYROLL_DEPARTMENT_ID: '14a76771-4c24-481b-8def-e6cce005c17b',
  };
  writeFileSync(path, Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
}
const env = Object.fromEntries(readFileSync(path, 'utf8').trim().split(/\r?\n/).map(line => {
  const position = line.indexOf('=');
  return [line.slice(0, position), line.slice(position + 1)];
}));
if (env.NEXT_PUBLIC_SUPABASE_URL !== config.url || !env.FIREHOUSE_DATABASE_SECRET || !env.PORTAL_PIN_PASSWORD_PEPPER || !env.POWER_APPS_SESSION_SECRET) {
  throw new Error('Review environment configuration requires manual inspection; existing values were not overwritten.');
}
console.log(JSON.stringify({ project, proofHash: createHash('sha256').update(env.FIREHOUSE_DATABASE_SECRET).digest('hex'), credentialsWritten: true }));
