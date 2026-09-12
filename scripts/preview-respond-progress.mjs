import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

const server = await createServer({ configFile: false, root: process.cwd(), plugins: [react(), {
  name: 'progress-fixture-isolation', enforce: 'pre',
  resolveId(source, importer) { if (source === './supabase-browser' && importer?.includes('/app/')) return resolve('tests/fixtures/location-supabase.ts'); },
}], server: { host: '127.0.0.1', port: 4196, strictPort: true, watch: { ignored: ['**/.next/**', '**/outputs/**'] } } });
await server.listen();
console.log('Fictional progress: http://127.0.0.1:4196/tests/fixtures/respond-progress.html');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.close(); process.exit(0); });
