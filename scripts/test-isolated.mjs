import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const files = process.argv.slice(2);
const tests = files.length ? files : readdirSync(new URL('../tests/', import.meta.url)).filter(name => name.endsWith('.test.mjs')).sort().map(name => `tests/${name}`);
// No inherited database, provider, deployment, or authentication configuration.
const env = Object.fromEntries(['PATH', 'LANG', 'LC_ALL', 'TMPDIR', 'TEMP', 'TMP', 'SystemRoot'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
const child = spawn(process.execPath, ['--import', './tests/helpers/deny-network.mjs', '--test', '--test-concurrency=2', ...tests], { cwd: root, env, stdio: 'inherit' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
