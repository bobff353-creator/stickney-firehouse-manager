import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The Vite project and deployment configuration live together in power-apps/.
// Resolve the pinned CLI from this checkout rather than a global installation.
const require = createRequire(import.meta.url);
const packagePath = require.resolve('@microsoft/power-apps-cli/package.json');
const cliPackage = JSON.parse(readFileSync(packagePath, 'utf8'));
const cliPath = resolve(dirname(packagePath), cliPackage.bin.pa);
const result = spawnSync(process.execPath, [cliPath, ...process.argv.slice(2)], {
  cwd: fileURLToPath(new URL('../power-apps/', import.meta.url)),
  stdio: 'inherit',
});
if (result.error) {
  console.error(result.error.message);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
